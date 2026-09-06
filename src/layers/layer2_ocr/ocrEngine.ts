import * as pdfjs from 'pdfjs-dist';
import {
  ExtractedSpatialToken,
  ClassifiedTarget,
  DocumentExtractionResult,
  OcrProgressFn,
} from './types';
import { preprocessForOcr } from './preprocess';
import {
  getScenario,
  DEFAULT_SCENARIO_ID,
  RE_CURRENCY as SCENARIO_CURRENCY,
  RE_DATE,
  RE_YEAR,
  type DocumentScenario,
} from '../../core/scenarios';

if (typeof window !== 'undefined' && (pdfjs as any)?.GlobalWorkerOptions) {
  (pdfjs as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

// Rendering / OCR resolution controls
const DISPLAY_WIDTH = 900; // canvas + coordinate space presented to the UI
const OCR_SUPERSAMPLE = 2.0; // spec Stage 2: 2.0x viewport scale for OCR fidelity
const OCR_MAX_WIDTH = 2200; // hard cap to bound Tesseract Wasm memory
const TEXT_LAYER_MIN_TOKENS = 5; // below this a PDF is treated as scanned -> OCR

interface RawOcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

function collectTesseractWords(data: any): RawOcrWord[] {
  const out: RawOcrWord[] = [];
  const push = (w: any) => {
    if (!w || !w.bbox) return;
    const text = (w.text || '').trim();
    if (!text) return;
    out.push({
      text,
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1,
      confidence: typeof w.confidence === 'number' ? w.confidence : 0,
    });
  };

  if (Array.isArray(data?.words) && data.words.length > 0) {
    data.words.forEach(push);
    return out;
  }

  for (const block of data?.blocks || []) {
    for (const para of block?.paragraphs || []) {
      for (const line of para?.lines || []) {
        for (const w of line?.words || []) push(w);
      }
    }
  }
  return out;
}

async function runTesseract(
  image: HTMLCanvasElement,
  onProgress?: OcrProgressFn
): Promise<{ words: RawOcrWord[]; rawText: string }> {
  const { createWorker } = await import('tesseract.js');
  const worker: any = await createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract', // directory: tesseract.js v7 appends its own *.wasm.js core loader
    langPath: '/tesseract',
    gzip: true,
    logger: (m: any) => {
      if (onProgress && typeof m.progress === 'number') {
        onProgress(Math.round(m.progress * 100), m.status || 'recognizing');
      }
    },
  });

  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });
  } catch {
    // parameter tuning is best-effort
  }

  // tesseract.js v6+: word/line geometry is only returned when the `blocks`
  // output is requested explicitly (it is off by default).
  const ret: any = await worker.recognize(image, {}, { text: true, blocks: true });
  await worker.terminate();

  return { words: collectTesseractWords(ret.data), rawText: ret.data?.text || '' };
}

function mapWordsToTokens(
  words: RawOcrWord[],
  factor: number,
  prefix: string
): ExtractedSpatialToken[] {
  return words.map((w, idx) => ({
    id: `${prefix}_${idx}`,
    text: w.text,
    x: Math.round(w.x0 * factor),
    y: Math.round(w.y0 * factor),
    width: Math.round((w.x1 - w.x0) * factor),
    height: Math.round((w.y1 - w.y0) * factor),
    page: 1,
    confidence: w.confidence,
  }));
}

function meanConfidence(tokens: ExtractedSpatialToken[]): number {
  const vals = tokens
    .map((t) => t.confidence)
    .filter((c): c is number => typeof c === 'number');
  return vals.length ? vals.reduce((s, c) => s + c, 0) / vals.length : 100;
}

type ExtractionCore = Omit<DocumentExtractionResult, 'targets' | 'latencyMs' | 'engineName'> & {
  engineLabel: string;
};

const SURYA_SIDECAR_URL = 'http://127.0.0.1:8765/ocr';
export const SURYA_HEALTH_URL = 'http://127.0.0.1:8765/health';

export interface SuryaHealth {
  online: boolean;
  ready: boolean;
  engine?: string;
  error?: string | null;
}

// Cheap liveness/readiness probe for the local Surya sidecar (1.5s timeout).
export async function checkSuryaHealth(): Promise<SuryaHealth> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 1500);
    let r: Response;
    try {
      r = await fetch(SURYA_HEALTH_URL, { signal: c.signal });
    } finally {
      clearTimeout(t);
    }
    if (!r.ok) return { online: true, ready: false };
    const j: any = await r.json();
    return { online: true, ready: !!j?.model_loaded, engine: j?.engine, error: j?.error ?? null };
  } catch {
    return { online: false, ready: false };
  }
}

// Primary OCR path: POST the rendered image to the local Surya sidecar
// (Python/Torch on 127.0.0.1). Returns display-space tokens, or null when the
// sidecar is unreachable so callers can fall back to in-browser Tesseract.
async function ocrViaSurya(
  image: HTMLCanvasElement,
  factor: number
): Promise<{ tokens: ExtractedSpatialToken[]; rawText: string; meanConfidence: number } | null> {
  try {
    const blob: Blob | null = await new Promise((resolve) =>
      image.toBlob((b) => resolve(b), 'image/png')
    );
    if (!blob) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    let resp: Response;
    try {
      resp = await fetch(SURYA_SIDECAR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: blob,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) return null;

    const data: any = await resp.json();
    const lines: any[] = Array.isArray(data?.lines) ? data.lines : [];
    const norm = (c: any) => (typeof c === 'number' ? (c <= 1 ? c * 100 : c) : 100);
    const tokens: ExtractedSpatialToken[] = [];
    const pieces: string[] = [];
    let idx = 0;

    for (const line of lines) {
      const ltext = String(line?.text ?? '').trim();
      if (ltext) pieces.push(ltext);
      const lconf = norm(line?.confidence);
      const words: any[] | null =
        Array.isArray(line?.words) && line.words.length ? line.words : null;

      if (words) {
        for (const w of words) {
          const t = String(w?.text ?? '').trim();
          if (!t) continue;
          const bb = w?.bbox || line?.bbox || [0, 0, 0, 0];
          tokens.push({
            id: `surya_${idx++}`,
            text: t,
            x: Math.round(bb[0] * factor),
            y: Math.round(bb[1] * factor),
            width: Math.round((bb[2] - bb[0]) * factor),
            height: Math.round((bb[3] - bb[1]) * factor),
            page: 1,
            confidence: Math.round(norm(w?.confidence ?? lconf) * 10) / 10,
          });
        }
      } else if (ltext) {
        // No per-word boxes: split the line box proportionally by token length.
        const bb = line?.bbox || [0, 0, 0, 0];
        const parts = ltext.split(/\s+/).filter(Boolean);
        const denom = parts.reduce((s, p) => s + p.length, 0) + Math.max(0, parts.length - 1);
        const lineW = Math.max(1, bb[2] - bb[0]);
        let cx = bb[0];
        for (const p of parts) {
          const wpx = (p.length / Math.max(1, denom)) * lineW;
          tokens.push({
            id: `surya_${idx++}`,
            text: p,
            x: Math.round(cx * factor),
            y: Math.round(bb[1] * factor),
            width: Math.round(wpx * factor),
            height: Math.round((bb[3] - bb[1]) * factor),
            page: 1,
            confidence: Math.round(lconf * 10) / 10,
          });
          cx += wpx + (1 / Math.max(1, denom)) * lineW;
        }
      }
    }

    if (!tokens.length) return null;
    const mc = tokens.reduce((s, t) => s + (t.confidence || 0), 0) / tokens.length;
    return { tokens, rawText: pieces.join('\n'), meanConfidence: mc };
  } catch {
    return null;
  }
}

// Paint a (possibly deskewed/warped) cleaned raster into the visible canvas so
// OCR boxes, HUD overlays, and the pixel-burn all share one coordinate space.
function drawCleanedToDisplay(canvas: HTMLCanvasElement, src: HTMLCanvasElement) {
  canvas.width = DISPLAY_WIDTH;
  canvas.height = Math.max(1, Math.round((src.height / Math.max(1, src.width)) * DISPLAY_WIDTH));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  }
}

export class PdfPasswordRequiredError extends Error {
  incorrect: boolean;
  constructor(incorrect: boolean) {
    super(incorrect ? 'Incorrect PDF password' : 'PDF is password-protected');
    this.name = 'PdfPasswordRequiredError';
    this.incorrect = incorrect;
  }
}

async function extractPdfDocument(
  fileBytes: Uint8Array,
  canvas: HTMLCanvasElement,
  onProgress?: OcrProgressFn,
  pdfPassword?: string
): Promise<ExtractionCore> {
  const loadingTask = (pdfjs as any).getDocument({
    data: fileBytes.slice(),
    standardFontDataUrl: '/standard_fonts/',
    ...(pdfPassword ? { password: pdfPassword } : {}),
  });
  let pdf: any;
  try {
    pdf = await loadingTask.promise;
  } catch (e: any) {
    // e-Aadhaar PDFs are usually password-protected. pdf.js: code 1 = needs
    // password, 2 = incorrect password. Surface a typed error for the UI.
    if (e?.name === 'PasswordException') throw new PdfPasswordRequiredError(e?.code === 2);
    throw e;
  }
  const page = await pdf.getPage(1);

  const unscaled = page.getViewport({ scale: 1 });
  const displayScale = DISPLAY_WIDTH / unscaled.width;
  const viewport = page.getViewport({ scale: displayScale });

  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await (page.render({ canvasContext: ctx, viewport } as any) as any).promise;
  }

  // 1) Native vector text layer
  const textContent = await page.getTextContent();
  const textTokens: ExtractedSpatialToken[] = [];
  const textPieces: string[] = [];
  let idx = 0;
  for (const item of textContent.items as any[]) {
    const str = (item.str || '').trim();
    if (!str) continue;
    textPieces.push(str);
    const [cx, cy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const h = Math.max(8, Math.round(Math.abs(item.transform[3]) * displayScale));
    const w = Math.max(6, Math.round((item.width || 0) * displayScale));
    textTokens.push({
      id: `pdf_token_${idx++}`,
      text: str,
      x: Math.round(cx),
      y: Math.round(cy - h),
      width: w,
      height: h,
      page: 1,
      confidence: 100,
    });
  }

  if (textTokens.length >= TEXT_LAYER_MIN_TOKENS) {
    return {
      tokens: textTokens,
      rawText: textPieces.join('\n'),
      meanConfidence: 100,
      width: canvas.width,
      height: canvas.height,
      numPages: pdf.numPages,
      usedOcrFallback: false,
      engineLabel: 'pdf.js Vector Text Matrix · Native Spatial',
    };
  }

  // 2) Scanned PDF: supersample the page, then OCR it.
  const ocrScale = Math.min(displayScale * OCR_SUPERSAMPLE, OCR_MAX_WIDTH / unscaled.width);
  const ocrViewport = page.getViewport({ scale: ocrScale });
  const off = document.createElement('canvas');
  off.width = Math.round(ocrViewport.width);
  off.height = Math.round(ocrViewport.height);
  const octx = off.getContext('2d');
  if (octx) {
    await (page.render({ canvasContext: octx, viewport: ocrViewport } as any) as any).promise;
  }

  // Primary: local Surya sidecar on the raw high-res page render.
  // Geometric cleanup first (perspective + deskew, colour preserved): a neural
  // recognizer reads a flat, upright card best and its boxes then align with
  // the displayed (corrected) raster.
  const photo = await preprocessForOcr(off, (p, s) => onProgress?.(Math.round(p * 0.3), s), { mode: 'photo' });
  const suryaFactor = DISPLAY_WIDTH / Math.max(1, photo.width);
  const surya = await ocrViaSurya(photo, suryaFactor);
  if (surya) {
    drawCleanedToDisplay(canvas, photo);
    return {
      tokens: surya.tokens,
      rawText: surya.rawText,
      meanConfidence: surya.meanConfidence,
      width: canvas.width,
      height: canvas.height,
      numPages: pdf.numPages,
      usedOcrFallback: false,
      engineLabel: 'Surya OCR · Local Sidecar (127.0.0.1)',
    };
  }

  // Fallback: OpenCV cleanup + in-browser Tesseract.
  const cleaned = await preprocessForOcr(off, (p, s) => onProgress?.(Math.round(p * 0.4), s));
  drawCleanedToDisplay(canvas, cleaned);
  const { words, rawText } = await runTesseract(cleaned, (p, s) =>
    onProgress?.(40 + Math.round(p * 0.6), s)
  );
  const factor = canvas.width / Math.max(1, cleaned.width);
  const tokens = mapWordsToTokens(words, factor, 'ocr_token');

  return {
    tokens,
    rawText,
    meanConfidence: meanConfidence(tokens),
    width: canvas.width,
    height: canvas.height,
    numPages: pdf.numPages,
    usedOcrFallback: true,
    engineLabel: 'Tesseract LSTM · Scanned PDF (OpenCV cleaned)',
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to decode image file'));
    };
    img.src = url;
  });
}

async function extractImageDocument(
  file: File,
  canvas: HTMLCanvasElement,
  onProgress?: OcrProgressFn
): Promise<ExtractionCore> {
  const img = await loadImageElement(file);
  const naturalW = Math.max(1, img.naturalWidth);
  const naturalH = Math.max(1, img.naturalHeight);

  // High-resolution OCR source rendered straight from the source pixels.
  const ocrWidth = Math.min(OCR_MAX_WIDTH, Math.max(naturalW, DISPLAY_WIDTH * OCR_SUPERSAMPLE));
  const off = document.createElement('canvas');
  off.width = Math.round(ocrWidth);
  off.height = Math.max(1, Math.round(naturalH * (ocrWidth / naturalW)));
  const octx = off.getContext('2d');
  if (octx) {
    octx.imageSmoothingEnabled = true;
    (octx as any).imageSmoothingQuality = 'high';
    octx.drawImage(img, 0, 0, off.width, off.height);
  }

  // Primary: local Surya sidecar on the raw high-res render.
  // Geometric cleanup first (perspective + deskew, colour preserved): a neural
  // recognizer reads a flat, upright card best and its boxes then align with
  // the displayed (corrected) raster.
  const photo = await preprocessForOcr(off, (p, s) => onProgress?.(Math.round(p * 0.3), s), { mode: 'photo' });
  const suryaFactor = DISPLAY_WIDTH / Math.max(1, photo.width);
  const surya = await ocrViaSurya(photo, suryaFactor);
  if (surya) {
    drawCleanedToDisplay(canvas, photo);
    return {
      tokens: surya.tokens,
      rawText: surya.rawText,
      meanConfidence: surya.meanConfidence,
      width: canvas.width,
      height: canvas.height,
      numPages: 1,
      usedOcrFallback: false,
      engineLabel: 'Surya OCR · Local Sidecar (127.0.0.1)',
    };
  }

  // Fallback: OpenCV cleanup (illumination/perspective/deskew/binarize) + Tesseract.
  const cleaned = await preprocessForOcr(off, (p, s) => onProgress?.(Math.round(p * 0.4), s));
  drawCleanedToDisplay(canvas, cleaned);

  const { words, rawText } = await runTesseract(cleaned, (p, s) =>
    onProgress?.(40 + Math.round(p * 0.6), s)
  );
  const factor = canvas.width / Math.max(1, cleaned.width);
  const tokens = mapWordsToTokens(words, factor, 'ocr_token');

  return {
    tokens,
    rawText,
    meanConfidence: meanConfidence(tokens),
    width: canvas.width,
    height: canvas.height,
    numPages: 1,
    usedOcrFallback: true,
    engineLabel: 'Tesseract LSTM · Raster Image (OpenCV cleaned)',
  };
}

// Spatial Line Reconstruction & Multi-Token Field Classifier
const RE_SSN = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/;
const RE_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const RE_PHONE = /\+?\d[\d().\-\s]{8,}\d/;
const RE_CURRENCY =
  /(?:USD|US\$|\$|€|£|₹)\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?(?:\s?(?:USD|EUR|GBP|INR))?/;
const RE_INCOME_LINE = /income|salary|earnings|wage|compensation|revenue|profit/i;

interface LineMatch {
  text: string;
  tokens: ExtractedSpatialToken[];
}

function groupLines(tokens: ExtractedSpatialToken[]): ExtractedSpatialToken[][] {
  const sorted = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: ExtractedSpatialToken[][] = [];
  for (const t of sorted) {
    const tc = t.y + t.height / 2;
    let placed: ExtractedSpatialToken[] | undefined;
    for (const line of lines) {
      const rc = line.reduce((s, x) => s + (x.y + x.height / 2), 0) / line.length;
      const rh = line.reduce((s, x) => s + x.height, 0) / line.length;
      if (Math.abs(tc - rc) <= Math.max(rh, t.height) * 0.5) {
        placed = line;
        break;
      }
    }
    if (placed) placed.push(t);
    else lines.push([t]);
  }
  for (const line of lines) line.sort((a, b) => a.x - b.x);
  return lines;
}

function matchInLine(line: ExtractedSpatialToken[], re: RegExp): LineMatch[] {
  let joined = '';
  const spans: { start: number; end: number; tok: ExtractedSpatialToken }[] = [];
  line.forEach((tok, i) => {
    if (i > 0) joined += ' ';
    const start = joined.length;
    joined += tok.text;
    spans.push({ start, end: joined.length, tok });
  });

  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const rx = new RegExp(re.source, flags);
  const matches: LineMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(joined)) !== null) {
    const s = m.index;
    const e = m.index + m[0].length;
    const toks = spans.filter((sp) => sp.end > s && sp.start < e).map((sp) => sp.tok);
    if (toks.length) matches.push({ text: m[0].trim(), tokens: toks });
    if (m.index === rx.lastIndex) rx.lastIndex++;
  }
  return matches;
}

function unionBox(tokens: ExtractedSpatialToken[], pad = 4) {
  const x0 = Math.min(...tokens.map((t) => t.x));
  const y0 = Math.min(...tokens.map((t) => t.y));
  const x1 = Math.max(...tokens.map((t) => t.x + t.width));
  const y1 = Math.max(...tokens.map((t) => t.y + t.height));
  return {
    x: Math.max(0, Math.round(x0 - pad)),
    y: Math.max(0, Math.round(y0 - pad)),
    width: Math.round(x1 - x0 + pad * 2),
    height: Math.round(y1 - y0 + pad * 2),
  };
}

function tokenConfidence(tokens: ExtractedSpatialToken[]): number {
  const vals = tokens
    .map((t) => t.confidence)
    .filter((c): c is number => typeof c === 'number');
  return vals.length
    ? Math.round((vals.reduce((s, c) => s + c, 0) / vals.length) * 10) / 10
    : 100;
}

function parseAmount(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

export function classifyExtractedTargets(
  tokens: ExtractedSpatialToken[],
  thresholdValue: number
): ClassifiedTarget[] {
  const lines = groupLines(tokens);
  const claimed = new Set<string>();
  const targets: ClassifiedTarget[] = [];
  let counter = 0;

  interface CurrencyCandidate {
    tokens: ExtractedSpatialToken[];
    text: string;
    value: number;
    incomeLine: boolean;
    confidence: number;
  }
  const currencies: CurrencyCandidate[] = [];

  const isClaimed = (toks: ExtractedSpatialToken[]) => toks.some((t) => claimed.has(t.id));
  const claim = (toks: ExtractedSpatialToken[]) => toks.forEach((t) => claimed.add(t.id));

  for (const line of lines) {
    const lineText = line.map((t) => t.text).join(' ');

    for (const mt of matchInLine(line, RE_SSN)) {
      if (isClaimed(mt.tokens)) continue;
      claim(mt.tokens);
      targets.push({
        id: `field_ssn_${counter++}`,
        label: 'Social Security Number',
        classification: 'Government Identifier (Sensitive PII)',
        extractedValue: mt.text,
        ...unionBox(mt.tokens),
        page: 1,
        action: 'DIRECT_BURN',
        source: 'OCR_AUTO',
        confidence: tokenConfidence(mt.tokens),
      });
    }

    for (const mt of matchInLine(line, RE_EMAIL)) {
      if (isClaimed(mt.tokens)) continue;
      claim(mt.tokens);
      targets.push({
        id: `field_email_${counter++}`,
        label: 'Email Address',
        classification: 'Contact Identifier (PII)',
        extractedValue: mt.text,
        ...unionBox(mt.tokens),
        page: 1,
        action: 'DIRECT_BURN',
        source: 'OCR_AUTO',
        confidence: tokenConfidence(mt.tokens),
      });
    }

    for (const mt of matchInLine(line, RE_CURRENCY)) {
      if (isClaimed(mt.tokens)) continue;
      claim(mt.tokens);
      currencies.push({
        tokens: mt.tokens,
        text: mt.text,
        value: parseAmount(mt.text),
        incomeLine: RE_INCOME_LINE.test(lineText),
        confidence: tokenConfidence(mt.tokens),
      });
    }

    for (const mt of matchInLine(line, RE_PHONE)) {
      if (isClaimed(mt.tokens)) continue;
      if (mt.text.replace(/\D/g, '').length < 10) continue;
      claim(mt.tokens);
      targets.push({
        id: `field_phone_${counter++}`,
        label: 'Phone Number',
        classification: 'Contact Identifier (PII)',
        extractedValue: mt.text,
        ...unionBox(mt.tokens),
        page: 1,
        action: 'DIRECT_BURN',
        source: 'OCR_AUTO',
        confidence: tokenConfidence(mt.tokens),
      });
    }
  }

  if (currencies.length > 0) {
    let witnessIdx = currencies.findIndex((c) => c.incomeLine);
    if (witnessIdx < 0) witnessIdx = currencies.findIndex((c) => c.value >= thresholdValue);
    if (witnessIdx < 0) {
      witnessIdx = currencies.reduce(
        (best, c, i, arr) => (c.value > arr[best].value ? i : best),
        0
      );
    }

    currencies.forEach((c, i) => {
      const isWitness = i === witnessIdx;
      targets.push({
        id: `field_${isWitness ? 'witness' : 'amount'}_${counter++}`,
        label: isWitness ? '2-Year Trailing Income' : 'Financial Figure',
        classification: isWitness
          ? 'Financial Witness Claim (ZK Predicate)'
          : 'Financial Amount (Sensitive)',
        extractedValue: c.text,
        numericValue: c.value,
        satisfiesThreshold: isWitness ? c.value >= thresholdValue : undefined,
        ...unionBox(c.tokens),
        page: 1,
        action: isWitness ? 'PROVE_AND_BURN' : 'DIRECT_BURN',
        source: 'OCR_AUTO',
        confidence: c.confidence,
      });
    });
  }

  if (targets.length === 0) {
    tokens
      .filter((t) => t.text.replace(/\s/g, '').length >= 4)
      .slice(0, 2)
      .forEach((t, i) =>
        targets.push({
          id: `field_generic_${i}`,
          label: `Extracted Field ${i + 1}`,
          classification: 'Sensitive Document Content',
          extractedValue: t.text,
          ...unionBox([t]),
          page: 1,
          action: 'DIRECT_BURN',
          source: 'OCR_AUTO',
          confidence: t.confidence ?? 100,
        })
      );
  }

  targets.sort((a, b) => {
    if (a.action !== b.action) return a.action === 'PROVE_AND_BURN' ? -1 : 1;
    return a.y - b.y;
  });
  return targets;
}

// --- Scenario-aware classification -----------------------------------------

// Label-anchored value: find a label keyword on a line and take the trailing
// tokens to its right as the field value (e.g. "Name: Rahul Kumar").
function matchLabelValue(line: ExtractedSpatialToken[], labelRe: RegExp): LineMatch | null {
  let joined = '';
  const spans: { start: number; end: number; tok: ExtractedSpatialToken }[] = [];
  line.forEach((tok, i) => {
    if (i > 0) joined += ' ';
    const start = joined.length;
    joined += tok.text;
    spans.push({ start, end: joined.length, tok });
  });
  const re = new RegExp(labelRe.source, labelRe.flags.replace('g', ''));
  const m = re.exec(joined);
  if (!m) return null;
  const valueStart = m.index + m[0].length;
  const valueToks = spans
    .filter((sp) => sp.start >= valueStart)
    .map((sp) => sp.tok)
    .filter((t) => t.text.replace(/[:\-–—.\s]/g, '').length > 0);
  if (!valueToks.length) return null;
  const text = valueToks.map((t) => t.text).join(' ').replace(/^[:\-–—\s.]+/, '').trim();
  if (!text) return null;
  return { text, tokens: valueToks };
}

// --- Age witness (Aadhaar) ---------------------------------------------------
// Aadhaar prints DOB as DD/MM/YYYY (or only a Year of Birth). Derive whole years.
function ageFromDobText(text: string, now = new Date()): number | null {
  const m = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let d = Number(m[1]);
    let mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += y >= 30 ? 1900 : 2000;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // tolerate MM/DD
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > now.getFullYear()) return null;
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age -= 1;
    return age >= 0 && age <= 130 ? age : null;
  }
  return null;
}
function ageFromYearText(text: string, now = new Date()): number | null {
  const m = text.match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const age = now.getFullYear() - Number(m[1]);
  return age >= 0 && age <= 130 ? age : null;
}
// Split a visual row into horizontally contiguous clusters (a gap wider than
// ~2.5x the token height separates the demographic column from e.g. QR speckle).
function clusterByGap(line: ExtractedSpatialToken[]): ExtractedSpatialToken[][] {
  const sorted = [...line].sort((a, b) => a.x - b.x);
  const clusters: ExtractedSpatialToken[][] = [];
  for (const t of sorted) {
    const cur = clusters[clusters.length - 1];
    if (cur) {
      const prev = cur[cur.length - 1];
      const gap = t.x - (prev.x + prev.width);
      const h = Math.max(prev.height, t.height, 8);
      if (gap <= h * 2.5) {
        cur.push(t);
        continue;
      }
    }
    clusters.push([t]);
  }
  return clusters;
}

const RE_BIRTH_LINE = /\b(?:dob|d\.o\.b|date of birth|year of birth|yob|birth)\b/i;
const RE_DEVANAGARI = /[\u0900-\u097F]/;
const RE_AADHAAR_BOILERPLATE = /government of india|unique identification|aadhaar|\bindia\b|proof of identity|citizenship|authority|\bmera\b/i;
const RE_NON_BIRTH_DATE = /\b(?:issued?|issue date|date of issue|enrol|enrolment|print|download|valid|expiry|generated|updated)\b|\u091c\u093e\u0930\u0940/i;
const RE_GENDER_LINE = /\b(?:MALE|FEMALE|TRANSGENDER|Male|Female|Transgender)\b|\u092a\u0941\u0930\u0941\u0937|\u092e\u0939\u093f\u0932\u093e/;
const RE_GUARDIAN_LINE = /\b(?:S\/O|D\/O|W\/O|C\/O|son of|daughter of|wife of|care of)\b/i;

// Detect and classify redaction targets for a specific document scenario.
export function classifyForScenario(
  tokens: ExtractedSpatialToken[],
  scenario: DocumentScenario,
  opts: { thresholdValue: number }
): ClassifiedTarget[] {
  const lines = groupLines(tokens);
  const claimed = new Set<string>();
  const targets: ClassifiedTarget[] = [];
  let counter = 0;

  const isClaimed = (toks: ExtractedSpatialToken[]) => toks.some((t) => claimed.has(t.id));
  const claim = (toks: ExtractedSpatialToken[]) => toks.forEach((t) => claimed.add(t.id));

  const fields = [...scenario.fields].sort((a, b) => a.priority - b.priority);
  const currencyFields = fields.filter((f) => f.detect.kind === 'currency');
  const ageField = fields.find((f) => f.detect.kind === 'age_from_dob');
  const nameAboveField = fields.find((f) => f.detect.kind === 'name_above_dob');
  const photoField = fields.find((f) => f.detect.kind === 'aadhaar_photo_layout');
  const otherFields = fields.filter(
    (f) => !['currency', 'age_from_dob', 'name_above_dob', 'aadhaar_photo_layout'].includes(f.detect.kind)
  );

  // Pattern + label-anchored fields (identifiers, names, dates, addresses...).
  for (const field of otherFields) {
    for (const line of lines) {
      if (field.detect.kind === 'pattern') {
        for (const mt of matchInLine(line, field.detect.re)) {
          if (isClaimed(mt.tokens)) continue;
          claim(mt.tokens);
          targets.push({
            id: `field_${field.key}_${counter++}`,
            label: field.label,
            classification: field.classification,
            extractedValue: mt.text,
            numericValue: field.numeric ? parseAmount(mt.text) : undefined,
            ...unionBox(mt.tokens),
            page: 1,
            action: field.action,
            source: 'OCR_AUTO',
            confidence: tokenConfidence(mt.tokens),
            fieldKey: field.key,
          });
        }
      } else if (field.detect.kind === 'label') {
        const mv = matchLabelValue(line, field.detect.re);
        if (mv && !isClaimed(mv.tokens)) {
          claim(mv.tokens);
          targets.push({
            id: `field_${field.key}_${counter++}`,
            label: field.label,
            classification: field.classification,
            extractedValue: mv.text,
            ...unionBox(mv.tokens),
            page: 1,
            action: field.action,
            source: 'OCR_AUTO',
            confidence: tokenConfidence(mv.tokens),
            fieldKey: field.key,
          });
        }
      }
    }
  }

  // Age witness: score every date on the page — a birth-labelled line wins,
  // issue/enrolment/print dates lose, rotated edge text (tall narrow boxes) loses.
  // Burns the DOB and carries age as the numeric value for the ZK predicate.
  let dobLineIdx = -1;
  if (ageField) {
    interface DobCand { li: number; mt: LineMatch; age: number; score: number }
    const cands: DobCand[] = [];
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lineText = line.map((t) => t.text).join(' ');
      const birthLabelled = RE_BIRTH_LINE.test(lineText);
      let mt = matchInLine(line, RE_DATE)[0];
      let age = mt ? ageFromDobText(mt.text) : null;
      if ((!mt || age === null) && birthLabelled) {
        mt = matchInLine(line, RE_YEAR)[0];
        age = mt ? ageFromYearText(mt.text) : null;
      }
      if (!mt || age === null || isClaimed(mt.tokens)) continue;
      const box = unionBox(mt.tokens, 0);
      let score = 0;
      if (birthLabelled) score += 100;
      if (RE_NON_BIRTH_DATE.test(lineText)) score -= 100;
      if (box.height > box.width * 1.3) score -= 60; // vertical / rotated text
      cands.push({ li, mt, age, score });
    }
    cands.sort((a, b) => b.score - a.score || a.li - b.li);
    const best = cands[0];
    if (best) {
      claim(best.mt.tokens);
      dobLineIdx = best.li;
      targets.push({
        id: `field_${ageField.key}_${counter++}`,
        label: ageField.label,
        classification: ageField.classification,
        extractedValue: best.mt.text,
        numericValue: best.age,
        satisfiesThreshold: best.age >= opts.thresholdValue,
        ...unionBox(best.mt.tokens),
        page: 1,
        action: ageField.action,
        source: 'OCR_AUTO',
        confidence: tokenConfidence(best.mt.tokens),
        fieldKey: ageField.key,
      });
    }
  }

  // Demographic-column anchor for the name/photo layout: the DOB line, else a
  // birth-labelled line, else the gender line (never depends on a correct DOB).
  const genderLineIdx = lines.findIndex((l) => RE_GENDER_LINE.test(l.map((t) => t.text).join(' ')));
  const birthLabelIdx = lines.findIndex((l) => RE_BIRTH_LINE.test(l.map((t) => t.text).join(' ')));
  const anchorIdx = dobLineIdx >= 0 ? dobLineIdx : birthLabelIdx >= 0 ? birthLabelIdx : genderLineIdx;

  // Name: on Aadhaar the (Latin-script) name sits directly above the DOB line,
  // left-aligned in the same column. Require column alignment + real letters so
  // OCR speckle elsewhere on the card can never be mistaken for a name.
  let nameLineIdx = -1;
  if (nameAboveField && anchorIdx > 0) {
    const anchorLine = lines[anchorIdx];
    const dobX0 = Math.min(...anchorLine.map((t) => t.x));
    const dobH = Math.max(...anchorLine.map((t) => t.height));
    const dobY0 = Math.min(...anchorLine.map((t) => t.y));
    for (let li = anchorIdx - 1; li >= Math.max(0, anchorIdx - 4); li--) {
      const line = lines[li];
      const lineText = line.map((t) => t.text).join(' ').trim();
      if (!lineText || RE_DEVANAGARI.test(lineText) || RE_AADHAAR_BOILERPLATE.test(lineText)) continue;
      if (RE_GUARDIAN_LINE.test(lineText)) continue; // "S/O …" is the guardian, not the holder
      const letters = lineText.replace(/[^A-Za-z]/g, '');
      if (letters.length < 3 || letters.length / lineText.replace(/\s/g, '').length < 0.8) continue;
      // Only the cluster that shares the DOB column is the name; anything to the
      // right (QR/photo speckle read as "words") is discarded from text AND box.
      const cluster = clusterByGap(line).find((c) => Math.abs(Math.min(...c.map((t) => t.x)) - dobX0) <= dobH * 3);
      if (!cluster) continue;
      const lineY1 = Math.max(...cluster.map((t) => t.y + t.height));
      if (dobY0 - lineY1 > dobH * 4) continue; // too far above to be the adjacent name line
      const toks = cluster.filter((t) => !claimed.has(t.id));
      if (!toks.length) continue;
      const clusterText = toks.map((t) => t.text).join(' ').trim();
      if (clusterText.replace(/[^A-Za-z]/g, '').length < 3) continue;
      claim(toks);
      nameLineIdx = li;
      targets.push({
        id: `field_${nameAboveField.key}_${counter++}`,
        label: nameAboveField.label,
        classification: nameAboveField.classification,
        extractedValue: clusterText,
        ...unionBox(toks),
        page: 1,
        action: nameAboveField.action,
        source: 'OCR_AUTO',
        confidence: tokenConfidence(toks),
        fieldKey: nameAboveField.key,
      });
      break;
    }
  }

  // Photo: the Aadhaar portrait sits immediately left of the demographic column
  // and spans roughly twice the name→gender block height (portrait ~4:5).
  // Layout-inferred (no face detection) — clearly labelled, user can remove it.
  if (photoField && anchorIdx >= 0) {
    const topLine = lines[nameLineIdx >= 0 ? nameLineIdx : anchorIdx];
    const bottomLine = lines[genderLineIdx >= 0 ? genderLineIdx : anchorIdx];
    const anchorLine = lines[anchorIdx];
    const colX0 = Math.min(...anchorLine.map((t) => t.x));
    const lineH = Math.max(...anchorLine.map((t) => t.height));
    const top = Math.min(...topLine.map((t) => t.y));
    const bottom = Math.max(...bottomLine.map((t) => t.y + t.height));
    const block = bottom - top;
    if (block >= lineH) {
      // Ratios measured on a real Aadhaar front: portrait height ≈ 2.7× the
      // name→gender block, portrait ≈ 4:5, ~1.3 line-heights left of the column.
      const photoH = block * 2.7;
      const photoW = photoH * 0.8;
      const x1 = colX0 - lineH * 1.3;
      const x0 = Math.max(0, x1 - photoW);
      const y0 = Math.max(0, top - photoH * 0.15);
      if (x1 - x0 >= lineH * 2) {
        targets.push({
          id: `field_${photoField.key}_${counter++}`,
          label: photoField.label,
          classification: photoField.classification,
          extractedValue: '[image region · inferred from card layout]',
          x: Math.round(x0),
          y: Math.round(y0),
          width: Math.round(x1 - x0),
          height: Math.round(photoH),
          page: 1,
          action: photoField.action,
          source: 'OCR_AUTO',
          fieldKey: photoField.key,
        });
      }
    }
  }

  // Currency / numeric witness selection.
  if (currencyFields.length > 0) {
    const witnessField = currencyFields.find((f) => f.isWitness);
    const cands: {
      tokens: ExtractedSpatialToken[];
      text: string;
      value: number;
      incomeLine: boolean;
      confidence: number;
    }[] = [];
    for (const line of lines) {
      const lineText = line.map((t) => t.text).join(' ');
      for (const mt of matchInLine(line, SCENARIO_CURRENCY)) {
        if (isClaimed(mt.tokens)) continue;
        claim(mt.tokens);
        cands.push({
          tokens: mt.tokens,
          text: mt.text,
          value: parseAmount(mt.text),
          incomeLine: RE_INCOME_LINE.test(lineText),
          confidence: tokenConfidence(mt.tokens),
        });
      }
    }
    let witnessIdx = -1;
    if (witnessField && cands.length > 0) {
      witnessIdx = cands.findIndex((c) => c.incomeLine);
      if (witnessIdx < 0) witnessIdx = cands.findIndex((c) => c.value >= opts.thresholdValue);
      if (witnessIdx < 0) {
        witnessIdx = cands.reduce((best, c, i, arr) => (c.value > arr[best].value ? i : best), 0);
      }
    }
    cands.forEach((c, i) => {
      const isW = !!witnessField && i === witnessIdx;
      if (isW && witnessField) {
        targets.push({
          id: `field_${witnessField.key}_${counter++}`,
          label: witnessField.label,
          classification: witnessField.classification,
          extractedValue: c.text,
          numericValue: c.value,
          satisfiesThreshold: c.value >= opts.thresholdValue,
          ...unionBox(c.tokens),
          page: 1,
          action: 'PROVE_AND_BURN',
          source: 'OCR_AUTO',
          confidence: c.confidence,
          fieldKey: witnessField.key,
        });
      } else {
        targets.push({
          id: `field_amount_${counter++}`,
          label: 'Financial Figure',
          classification: 'Financial Amount (Sensitive)',
          extractedValue: c.text,
          numericValue: c.value,
          ...unionBox(c.tokens),
          page: 1,
          action: 'DIRECT_BURN',
          source: 'OCR_AUTO',
          confidence: c.confidence,
          fieldKey: 'amount',
        });
      }
    });
  }

  // Fallback: surface substantial tokens so uploads always yield candidates.
  if (targets.length === 0) {
    tokens
      .filter((t) => t.text.replace(/\s/g, '').length >= 4)
      .slice(0, 2)
      .forEach((t, i) =>
        targets.push({
          id: `field_generic_${i}`,
          label: `Extracted Field ${i + 1}`,
          classification: 'Sensitive Document Content',
          extractedValue: t.text,
          ...unionBox([t]),
          page: 1,
          action: 'DIRECT_BURN',
          source: 'OCR_AUTO',
          confidence: t.confidence ?? 100,
        })
      );
  }

  const rank = (a: ClassifiedTarget['action']) =>
    a === 'PROVE_AND_BURN' ? 0 : a === 'DIRECT_BURN' ? 1 : 2;
  targets.sort((a, b) => rank(a.action) - rank(b.action) || a.y - b.y);
  return targets;
}

export async function extractDocumentSpatial(
  doc: { mimeType: string; rawBytes?: Uint8Array; fileObj?: File },
  canvas: HTMLCanvasElement,
  thresholdValue: number,
  onProgress?: OcrProgressFn,
  scenarioId?: string,
  pdfPassword?: string
): Promise<DocumentExtractionResult> {
  const start = performance.now();

  let core: ExtractionCore = {
    tokens: [],
    rawText: '',
    meanConfidence: 0,
    width: canvas.width,
    height: canvas.height,
    numPages: 1,
    usedOcrFallback: false,
    engineLabel: 'Inert · Unsupported Document Type',
  };

  if (doc.mimeType === 'application/pdf' && doc.rawBytes) {
    core = await extractPdfDocument(doc.rawBytes, canvas, onProgress, pdfPassword);
  } else if (doc.fileObj && doc.mimeType.startsWith('image/')) {
    core = await extractImageDocument(doc.fileObj, canvas, onProgress);
  }

  const scenario = getScenario(scenarioId ?? DEFAULT_SCENARIO_ID);
  const targets = classifyForScenario(core.tokens, scenario, { thresholdValue });
  if (import.meta.env.DEV) {
    // Dev-only diagnostics (stripped from production builds): never logs document text in prod.
    console.debug('[ocr:dev] lines:', groupLines(core.tokens).map((l) => l.map((t) => t.text).join(' ')));
  }
  return {
    ...core,
    targets,
    engineName: core.engineLabel,
    latencyMs: Math.max(1, Math.round(performance.now() - start)),
  };
}
