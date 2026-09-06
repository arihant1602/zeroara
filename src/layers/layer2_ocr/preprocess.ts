// ============================================================================
//  OCR Image Preprocessing (OpenCV.js, self-hosted, zero-egress)
//
//  Loads the vendored OpenCV.js (public/opencv/opencv.js — embedded wasm, so
//  no network fetch and CSP-safe under `script-src 'self' 'wasm-unsafe-eval'`)
//  and runs a document-cleanup pipeline tuned for scanned PDFs and phone
//  photos: illumination normalization -> perspective correction -> denoise ->
//  adaptive binarization -> deskew.
//
//  Every stage is individually guarded: if an OpenCV op fails or a detection
//  is not confident, that stage is skipped rather than degrading the image.
//  If OpenCV cannot load at all, callers fall back to the raw canvas.
// ============================================================================

type ProgressFn = (percent: number, status: string) => void;

let cvPromise: Promise<any> | null = null;

// Lazily inject and initialize the self-hosted OpenCV.js runtime (once).
export function loadOpenCV(): Promise<any> {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    const w = window as any;

    const finalize = async () => {
      try {
        let c = w.cv;
        // The UMD build assigns `window.cv` to a Promise of the module.
        if (c && typeof c.then === 'function') c = await c;
        // Some builds expose readiness via onRuntimeInitialized instead.
        if (c && !c.Mat && typeof c.onRuntimeInitialized !== 'undefined') {
          await new Promise<void>((r) => {
            c.onRuntimeInitialized = () => r();
          });
        }
        if (!c || !c.Mat) {
          reject(new Error('OpenCV loaded but runtime is not ready'));
          return;
        }
        w.cv = c;
        resolve(c);
      } catch (e) {
        reject(e);
      }
    };

    // Already present (e.g. loaded by a previous call).
    if (w.cv && w.cv.Mat) {
      resolve(w.cv);
      return;
    }

    const existing = document.getElementById('opencv-js-runtime') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', finalize);
      existing.addEventListener('error', () => reject(new Error('OpenCV.js failed to load')));
      // If it already finished loading, kick finalize directly.
      if (w.cv) finalize();
      return;
    }

    const script = document.createElement('script');
    script.id = 'opencv-js-runtime';
    script.src = '/opencv/opencv.js';
    script.async = true;
    script.onload = finalize;
    script.onerror = () => reject(new Error('OpenCV.js failed to load'));
    document.body.appendChild(script);
  });

  return cvPromise;
}

interface Pt {
  x: number;
  y: number;
}

// Order 4 quad points as [top-left, top-right, bottom-right, bottom-left].
function orderQuad(p: Pt[]): [Pt, Pt, Pt, Pt] {
  const sum = p.map((q) => q.x + q.y);
  const diff = p.map((q) => q.x - q.y);
  const tl = p[sum.indexOf(Math.min(...sum))];
  const br = p[sum.indexOf(Math.max(...sum))];
  const tr = p[diff.indexOf(Math.max(...diff))];
  const bl = p[diff.indexOf(Math.min(...diff))];
  return [tl, tr, br, bl];
}

// Detect a document quadrilateral and flatten it via perspective warp.
// Returns a new grayscale Mat on success, or null to skip (e.g. clean scan).
function tryPerspectiveWarp(cv: any, gray: any): any | null {
  let blur: any, edges: any, kernel: any, contours: any, hier: any;
  try {
    const W = gray.cols;
    const H = gray.rows;
    const imgArea = W * H;

    blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    edges = new cv.Mat();
    cv.Canny(blur, edges, 50, 150);
    kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.dilate(edges, edges, kernel);

    contours = new cv.MatVector();
    hier = new cv.Mat();
    cv.findContours(edges, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let bestQuad: Pt[] | null = null;
    let bestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const peri = cv.arcLength(c, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(c, approx, 0.02 * peri, true);
      if (approx.rows === 4) {
        const area = Math.abs(cv.contourArea(approx));
        if (area > bestArea && area > imgArea * 0.25 && area < imgArea * 0.99) {
          const d = approx.data32S;
          bestQuad = [
            { x: d[0], y: d[1] },
            { x: d[2], y: d[3] },
            { x: d[4], y: d[5] },
            { x: d[6], y: d[7] },
          ];
          bestArea = area;
        }
      }
      approx.delete();
      c.delete();
    }

    if (!bestQuad) return null;

    const [tl, tr, br, bl] = orderQuad(bestQuad);
    const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
    const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
    const maxW = Math.max(widthTop, widthBottom);
    const maxH = Math.max(heightLeft, heightRight);
    if (maxW < 80 || maxH < 80) return null;

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y,
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0, maxW, 0, maxW, maxH, 0, maxH,
    ]);
    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    const out = new cv.Mat();
    cv.warpPerspective(
      gray,
      out,
      M,
      new cv.Size(Math.round(maxW), Math.round(maxH)),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255)
    );
    srcTri.delete();
    dstTri.delete();
    M.delete();
    return out;
  } catch {
    return null;
  } finally {
    blur?.delete();
    edges?.delete();
    kernel?.delete();
    contours?.delete();
    hier?.delete();
  }
}

// Estimate skew from the binarized foreground and rotate to correct it.
// Returns a new Mat when a rotation is applied, otherwise the input `bin`.
function deskew(cv: any, bin: any): any {
  let inv: any, pts: any, M: any;
  try {
    inv = new cv.Mat();
    cv.bitwise_not(bin, inv); // text -> white for foreground detection
    pts = new cv.Mat();
    cv.findNonZero(inv, pts);
    if (!pts || pts.rows < 100) return bin;

    const rect = cv.minAreaRect(pts);
    let angle = rect.angle;
    if (angle < -45) angle += 90;
    if (angle > 45) angle -= 90;
    if (Math.abs(angle) < 0.3 || Math.abs(angle) > 15) return bin; // skip noise / implausible

    const center = new cv.Point(bin.cols / 2, bin.rows / 2);
    M = cv.getRotationMatrix2D(center, angle, 1);
    const out = new cv.Mat();
    cv.warpAffine(
      bin,
      out,
      M,
      new cv.Size(bin.cols, bin.rows),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255)
    );
    return out;
  } catch {
    return bin;
  } finally {
    inv?.delete();
    pts?.delete();
    M?.delete();
  }
}

// Run the full cleanup pipeline. Always returns a usable canvas: on any
// unrecoverable failure it returns the original `src` untouched.
export async function preprocessForOcr(
  src: HTMLCanvasElement,
  onProgress?: ProgressFn
): Promise<HTMLCanvasElement> {
  let cv: any;
  try {
    onProgress?.(0, 'loading vision engine');
    cv = await loadOpenCV();
  } catch (e) {
    console.warn('OpenCV.js unavailable; skipping preprocessing:', e);
    return src;
  }

  let srcMat: any, gray: any, norm: any, corrected: any = null;
  let working: any, den: any, bin: any, deskewed: any;
  try {
    onProgress?.(20, 'normalizing');
    srcMat = cv.imread(src);
    gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    srcMat.delete();
    srcMat = null;

    // Illumination normalization (uneven lighting on photos).
    norm = new cv.Mat();
    try {
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      clahe.apply(gray, norm);
      clahe.delete();
    } catch {
      norm.delete();
      norm = gray.clone();
    }
    gray.delete();
    gray = null;

    // Perspective correction (document quad) — skipped if none confident.
    onProgress?.(45, 'correcting geometry');
    corrected = tryPerspectiveWarp(cv, norm);
    working = corrected ?? norm;

    // Denoise.
    onProgress?.(65, 'denoising');
    den = new cv.Mat();
    cv.medianBlur(working, den, 3);

    // Free the pre-denoise mats now that `den` holds the data.
    if (corrected) corrected.delete();
    corrected = null;
    norm.delete();
    norm = null;
    working = null;

    // Adaptive binarization — robust to uneven illumination.
    onProgress?.(80, 'binarizing');
    bin = new cv.Mat();
    cv.adaptiveThreshold(
      den,
      bin,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      31,
      15
    );
    den.delete();
    den = null;

    // Deskew.
    onProgress?.(92, 'deskewing');
    deskewed = deskew(cv, bin);

    const out = document.createElement('canvas');
    cv.imshow(out, deskewed);

    if (deskewed !== bin) deskewed.delete();
    bin.delete();
    onProgress?.(100, 'cleaned');
    return out;
  } catch (e) {
    console.warn('Preprocessing failed; using raw render:', e);
    // Best-effort cleanup of any live mats.
    for (const m of [srcMat, gray, norm, corrected, den, bin]) {
      try {
        m?.delete?.();
      } catch {
        /* ignore */
      }
    }
    return src;
  }
}
