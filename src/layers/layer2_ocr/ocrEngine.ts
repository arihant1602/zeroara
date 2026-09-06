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
    corePath: '/tesseract/tesseract-core-simd-lstm.wasm',
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

  const ret: any = await worker.recognize(image);
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

type ExtractionCore = Omit<DocumentExtractionResult, 'targets' | 'latencyMs' | 'engineName'>;

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

async function extractPdfDocument(
  fileBytes: Uint8Array,
  canvas: HTMLCanvasElement,
  onProgress?: OcrProgressFn
): Promise<ExtractionCore> {
  const loadingTask = (pdfjs as any).getDocument({
    data: fileBytes.slice(),
    standardFontDataUrl: '/standard_fonts/',
  });
  const pdf = await loadingTask.promise;
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
    };
  }

  // 2) Scanned PDF fallback: supersample -> OpenCV cleanup -> OCR the cleaned raster
  const ocrScale = Math.min(displayScale * OCR_SUPERSAMPLE, OCR_MAX_WIDTH / unscaled.width);
  const ocrViewport = page.getViewport({ scale: ocrScale });
  const off = document.createElement('canvas');
  off.width = Math.round(ocrViewport.width);
  off.height = Math.round(ocrViewport.height);
  const octx = off.getContext('2d');
  if (octx) {
    await (page.render({ canvasContext: octx, viewport: ocrViewport } as any) as any).promise;
  }

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

  // OpenCV cleanup (illumination/perspective/deskew/binarize) becomes the visible canvas.
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
  const otherFields = fields.filter((f) => f.detect.kind !== 'currency');

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
  scenarioId?: string
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
  };
  let engineName = 'Inert · Unsupported Document Type';

  if (doc.mimeType === 'application/pdf' && doc.rawBytes) {
    core = await extractPdfDocument(doc.rawBytes, canvas, onProgress);
    engineName = core.usedOcrFallback
      ? 'Tesseract LSTM Neural OCR · Scanned PDF (2.0× supersampled, OpenCV cleaned)'
      : 'pdf.js Vector Text Matrix · Native Spatial';
  } else if (doc.fileObj && doc.mimeType.startsWith('image/')) {
    core = await extractImageDocument(doc.fileObj, canvas, onProgress);
    engineName = 'Tesseract LSTM Neural OCR · Raster Image (2.0× supersampled, OpenCV cleaned)';
  }

  const scenario = getScenario(scenarioId ?? DEFAULT_SCENARIO_ID);
  const targets = classifyForScenario(core.tokens, scenario, { thresholdValue });
  return {
    ...core,
    targets,
    engineName,
    latencyMs: Math.max(1, Math.round(performance.now() - start)),
  };
}
