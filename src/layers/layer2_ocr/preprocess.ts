// ============================================================================
//  OCR Image Preprocessing (OpenCV.js, self-hosted, zero-egress)
//
//  Loads the vendored OpenCV.js (public/opencv/opencv.js — embedded wasm, so
//  no network fetch) and cleans a document raster before OCR. Two modes:
//
//    'photo'    geometric correction only, colour preserved: perspective-warp
//               the detected card/page quad, then deskew. Used for the Surya
//               (neural) path — binarization hurts neural recognizers, but a
//               flat, upright document reads better and gives clean boxes.
//    'binarize' full cleanup for Tesseract: CLAHE illumination normalization,
//               perspective, denoise, adaptive threshold, deskew.
//
//  Every stage is guarded: a failed op or an unconfident detection is skipped
//  rather than degrading the image. If OpenCV can't load, the raw canvas is
//  returned unchanged.
// ============================================================================

type ProgressFn = (percent: number, status: string) => void;
export type PreprocessMode = 'binarize' | 'photo';

let cvPromise: Promise<any> | null = null;

export function loadOpenCV(): Promise<any> {
  if (cvPromise) return cvPromise;
  cvPromise = new Promise((resolve, reject) => {
    const w = window as any;
    const finalize = async () => {
      try {
        let c = w.cv;
        if (c && typeof c.then === 'function') c = await c; // UMD build resolves to a Promise
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
    if (w.cv && w.cv.Mat) {
      resolve(w.cv);
      return;
    }
    const existing = document.getElementById('opencv-js-runtime') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', finalize);
      existing.addEventListener('error', () => reject(new Error('OpenCV.js failed to load')));
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

function orderQuad(p: Pt[]): [Pt, Pt, Pt, Pt] {
  const sum = p.map((q) => q.x + q.y);
  const diff = p.map((q) => q.x - q.y);
  return [
    p[sum.indexOf(Math.min(...sum))],
    p[diff.indexOf(Math.max(...diff))],
    p[sum.indexOf(Math.max(...sum))],
    p[diff.indexOf(Math.min(...diff))],
  ];
}

const del = (m: any) => {
  try {
    m?.delete?.();
  } catch {
    /* ignore */
  }
};

// Detect a document quadrilateral on a grayscale Mat. Returns the perspective
// transform and output size, or null when no confident quad exists.
function findDocumentTransform(cv: any, gray: any): { M: any; w: number; h: number } | null {
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
    const maxW = Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y));
    const maxH = Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y));
    if (maxW < 80 || maxH < 80) return null;
    // Reject implausible quads (a card/page is never more than ~3:1 either way).
    const ratio = maxW / maxH;
    if (ratio > 3.2 || ratio < 0.31) return null;

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxW, 0, maxW, maxH, 0, maxH]);
    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    srcTri.delete();
    dstTri.delete();
    return { M, w: Math.round(maxW), h: Math.round(maxH) };
  } catch {
    return null;
  } finally {
    del(blur);
    del(edges);
    del(kernel);
    del(contours);
    del(hier);
  }
}

function warpPerspectiveMat(cv: any, src: any, M: any, w: number, h: number, border: any): any {
  const out = new cv.Mat();
  cv.warpPerspective(src, out, M, new cv.Size(w, h), cv.INTER_LINEAR, cv.BORDER_CONSTANT, border);
  return out;
}

// Estimate residual skew (degrees) from a binarized text mask. 0 = none/skip.
function estimateSkewDeg(cv: any, bin: any): number {
  let inv: any, pts: any;
  try {
    inv = new cv.Mat();
    cv.bitwise_not(bin, inv);
    pts = new cv.Mat();
    cv.findNonZero(inv, pts);
    if (!pts || pts.rows < 100) return 0;
    let angle = cv.minAreaRect(pts).angle;
    if (angle < -45) angle += 90;
    if (angle > 45) angle -= 90;
    if (Math.abs(angle) < 0.3 || Math.abs(angle) > 15) return 0;
    return angle;
  } catch {
    return 0;
  } finally {
    del(inv);
    del(pts);
  }
}

function rotateMat(cv: any, src: any, angleDeg: number, border: any): any {
  let M: any;
  try {
    const center = new cv.Point(src.cols / 2, src.rows / 2);
    M = cv.getRotationMatrix2D(center, angleDeg, 1);
    const out = new cv.Mat();
    cv.warpAffine(src, out, M, new cv.Size(src.cols, src.rows), cv.INTER_LINEAR, cv.BORDER_CONSTANT, border);
    return out;
  } finally {
    del(M);
  }
}

// Run the cleanup pipeline. Always returns a usable canvas: on any
// unrecoverable failure it returns the original `src` untouched.
export async function preprocessForOcr(
  src: HTMLCanvasElement,
  onProgress?: ProgressFn,
  opts?: { mode?: PreprocessMode }
): Promise<HTMLCanvasElement> {
  const mode: PreprocessMode = opts?.mode ?? 'binarize';
  let cv: any;
  try {
    onProgress?.(0, 'loading vision engine');
    cv = await loadOpenCV();
  } catch (e) {
    console.warn('OpenCV.js unavailable; skipping preprocessing:', e);
    return src;
  }

  const live: any[] = [];
  const track = (m: any) => {
    live.push(m);
    return m;
  };
  try {
    onProgress?.(15, 'analysing geometry');
    const rgba = track(cv.imread(src));
    const gray = track(new cv.Mat());
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);

    // Illumination-normalized gray for detection (and for the binarize output).
    let norm: any = track(new cv.Mat());
    try {
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      clahe.apply(gray, norm);
      clahe.delete();
    } catch {
      norm = track(gray.clone());
    }

    // Perspective correction, applied to gray (detection) and colour (photo mode).
    onProgress?.(40, 'correcting perspective');
    const white4 = new cv.Scalar(255, 255, 255, 255);
    const white1 = new cv.Scalar(255);
    let workGray: any = norm;
    let workColor: any = rgba;
    const t = findDocumentTransform(cv, norm);
    if (t) {
      workGray = track(warpPerspectiveMat(cv, norm, t.M, t.w, t.h, white1));
      if (mode === 'photo') workColor = track(warpPerspectiveMat(cv, rgba, t.M, t.w, t.h, white4));
      t.M.delete();
    }

    // Denoise + binarize (gray). Binarized mask also drives skew estimation.
    onProgress?.(65, 'denoising');
    const den = track(new cv.Mat());
    cv.medianBlur(workGray, den, 3);
    onProgress?.(80, 'estimating skew');
    const bin = track(new cv.Mat());
    cv.adaptiveThreshold(den, bin, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 15);
    const angle = estimateSkewDeg(cv, bin);

    onProgress?.(92, angle ? 'deskewing' : 'finalizing');
    let outMat: any;
    if (mode === 'photo') {
      outMat = angle ? track(rotateMat(cv, workColor, angle, white4)) : workColor;
    } else {
      outMat = angle ? track(rotateMat(cv, bin, angle, white1)) : bin;
    }

    const out = document.createElement('canvas');
    cv.imshow(out, outMat);
    onProgress?.(100, 'cleaned');
    return out;
  } catch (e) {
    console.warn('Preprocessing failed; using raw render:', e);
    return src;
  } finally {
    for (const m of live) del(m);
  }
}
