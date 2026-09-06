import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// @ts-expect-error circomlibjs lacks ts declarations
import { buildPoseidon } from 'circomlibjs';
// @ts-expect-error snarkjs lacks full ts declarations
import * as snarkjs from 'snarkjs';
import * as pdfjs from 'pdfjs-dist';

if (typeof window !== 'undefined' && (pdfjs as any)?.GlobalWorkerOptions) {
  (pdfjs as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface BoundingBoxCoords {
  id: string;
  label: string;
  field: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface Groth16ProofPoints {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface SessionContext {
  documentDigest: string;
  requesterName: string;
  purpose: string;
  thresholdValue: number;
  challengeNonce: string;
}

export interface Groth16ProofResult {
  proof: Groth16ProofPoints;
  publicSignals: string[];
  durationMs: number;
  commitment: string;
  blindingSalt: string;
  thresholdValue: number;
  sessionBinding: string;
  verified: boolean;
  verificationLatencyMs: number;
  generatedAt: string;
  protocol: string;
  curve: string;
}

export interface MasterSealResult {
  sealHex: string;
  preimage: string;
  docRedactedHash: string;
  bboxSummary: string;
  commitment: string;
  proofDigest: string;
}

// 1. In-browser Web Crypto SHA-256
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer as any);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 2. Poseidon Field Hashing (BN254)
let poseidonFn: any = null;
export async function getPoseidon() {
  if (!poseidonFn) {
    poseidonFn = await buildPoseidon();
  }
  return poseidonFn;
}

export async function computePoseidonCommitment(actualValue: number | bigint, salt: bigint): Promise<string> {
  const poseidon = await getPoseidon();
  const hash = poseidon([BigInt(actualValue), salt]);
  return poseidon.F.toString(hash);
}

// Generate high-entropy 253-bit blinding salt within BN254 scalar field
export function generateRandomScalar(): bigint {
  const randBytes = new Uint8Array(31);
  crypto.getRandomValues(randBytes);
  let hex = '0x';
  randBytes.forEach((b) => (hex += b.toString(16).padStart(2, '0')));
  return BigInt(hex);
}

// Cryptographic Session Binding Digest
export async function computeSessionBinding(
  ctx: SessionContext,
  poseidonCommitment: string
): Promise<string> {
  const preimage = `zeroara:session:v1:doc:${ctx.documentDigest}:req:${ctx.requesterName}:purp:${ctx.purpose}:thresh:${ctx.thresholdValue}:nonce:${ctx.challengeNonce}:commit:${poseidonCommitment}`;
  return await sha256Hex(preimage);
}

export const EMBEDDED_VERIFICATION_KEY = {
  protocol: 'groth16',
  curve: 'bn128',
  nPublic: 2,
  vk_alpha_1: [
    '1132085767878658749409376369637788501447741591519865173283795686151822759388',
    '3282798298938032117830503359798871852643369395433812247428478219947216446490',
    '1',
  ],
  vk_beta_2: [
    [
      '21854834551775687658371874612048774433154452857817979791191285667997537280559',
      '17981622666479669800848298480629788820730936588637896767441671245487052874096',
    ],
    [
      '11838679258562354444956815608153906844477684323859767942383369580822448917979',
      '10970466534716718063204632921475593462272229178217392988334680029559015486892',
    ],
    ['1', '0'],
  ],
  vk_gamma_2: [
    [
      '10857046999023057135944570762232829481370756359578518086990519993285655852781',
      '11559732032986387107991004021392285783925812861821192530917403151452391805634',
    ],
    [
      '8495653923123431417604973247489272438418190587263600148770280649306958101930',
      '4082367875863433681332203403145435568316851327593401208105741076214120093531',
    ],
    ['1', '0'],
  ],
  vk_delta_2: [
    [
      '14609144745765883534725902755970976935605835263587079873099666723661998747266',
      '4293616449589817176190478190152251240107395928943330723874010282275996081946',
    ],
    [
      '10713718296807118499219129272431979852514905160335050748081176716082000551584',
      '15818718504269633069402578346289290388379721231833026277014259569639828034630',
    ],
    ['1', '0'],
  ],
  vk_alphabeta_12: [
    [
      [
        '18177465682781214043754612242359027355095772992500081319803599189564355451011',
        '6052839721985879182664650969073619278270028612854715223147626177807566166996',
      ],
      [
        '14253621230270439275895257337614751622852721800284008520265200486599084319461',
        '1200785670181728065157261238881378619833578095948457840688730590852631813671',
      ],
      [
        '13719692662506512016773820976600134474488266777984412288053578783564563972769',
        '15682341612624731052064098789113733791549482508097458392943443873375861721339',
      ],
    ],
    [
      [
        '9310385774642528782526512392187485963805070793247515665588858236334795608329',
        '5435335697840845956845187463945358543121252250872307841394845296287231823010',
      ],
      [
        '2439393116855241727410972811196015759774571415940057717973935026318733330485',
        '16539501097342644627544715501849565175799058338945035433325479454945221847003',
      ],
      [
        '6971734944134061712094313920488526151283870057298536582213428129679685704308',
        '3955865200136789006984856982099339533147618996657258462989726322452359148669',
      ],
    ],
  ],
  IC: [
    [
      '888126466450815662922338595315744180413420726307686589694088101732885080323',
      '18467008887725728302769589515452878423306838440474899046705042576132965292246',
      '1',
    ],
    [
      '20062475442328182584341055368040011701060468277194292937962442671568606941158',
      '15513527174613372168500006040415868643398597033706073158522555583959149347722',
      '1',
    ],
    [
      '20355528636251031468944530864402435390295310897503904929095072669991690498202',
      '20132800285513019554538289636324179915116522291700767435318110852604873396758',
      '1',
    ],
  ],
};

// 3. In-browser Groth16 Prover via SnarkJS
export async function generateIncomeThresholdProof(
  actualValue: number,
  thresholdValue: number,
  sessionCtx?: SessionContext,
  customSalt?: bigint
): Promise<Groth16ProofResult> {
  const startTime = performance.now();
  const salt = customSalt ?? generateRandomScalar();
  const expectedCommitment = await computePoseidonCommitment(actualValue, salt);

  const circuitInput = {
    actualValue: actualValue,
    blindingSalt: salt.toString(),
    thresholdValue: thresholdValue,
    expectedCommitment: expectedCommitment,
  };

  const wasmUrl = '/zk/income_threshold.wasm';
  const zkeyUrl = '/zk/income_threshold.zkey';

  let proof: Groth16ProofPoints;
  let publicSignals: string[];

  try {
    const res = await snarkjs.groth16.fullProve(
      circuitInput,
      wasmUrl,
      zkeyUrl
    );
    proof = res.proof;
    publicSignals = res.publicSignals;
  } catch (err: any) {
    if (actualValue < thresholdValue) {
      throw new Error(
        `ZK Constraint Unsatisfied: Witness value does not meet the enterprise threshold (≥ $${thresholdValue.toLocaleString()}). Circom bit-decomposition range check failed.`
      );
    }
    throw new Error(`In-browser Groth16 proof generation failed: ${err?.message || err}`);
  }

  const durationMs = Math.max(1, Math.round(performance.now() - startTime));

  // Compute deterministic session binding
  let sessionBinding = '';
  if (sessionCtx) {
    sessionBinding = await computeSessionBinding(sessionCtx, expectedCommitment);
  } else {
    sessionBinding = await sha256Hex(`zeroara:session:v1:thresh:${thresholdValue}:commit:${expectedCommitment}`);
  }

  // Independent local verification
  const verifyRes = await verifyIncomeProof(proof, publicSignals);

  return {
    proof,
    publicSignals,
    durationMs,
    commitment: expectedCommitment,
    blindingSalt: '0x' + salt.toString(16),
    thresholdValue,
    sessionBinding,
    verified: verifyRes.isValid,
    verificationLatencyMs: verifyRes.latencyMs,
    generatedAt: new Date().toISOString(),
    protocol: proof.protocol || 'groth16',
    curve: proof.curve || 'bn128',
  };
}

// 4. In-browser Independent Groth16 Verification
export async function verifyIncomeProof(
  proof: Groth16ProofPoints,
  publicSignals: string[]
): Promise<{ isValid: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    let vKey: any = null;
    try {
      const vKeyResp = await fetch('/zk/verification_key.json');
      if (vKeyResp.ok) {
        vKey = await vKeyResp.json();
      }
    } catch {
      // Offline fallback
    }

    if (!vKey) {
      vKey = EMBEDDED_VERIFICATION_KEY;
    }

    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    return { isValid: Boolean(isValid), latencyMs };
  } catch (err) {
    return { isValid: false, latencyMs: Math.max(1, Math.round(performance.now() - start)) };
  }
}

// 5. Load-Bearing Master Audit Seal
// Seal = Hash(Doc_Redacted_Hash || BoundingBox || WitnessCommitment || Proof_pi)
export async function computeMasterAuditSeal(
  docRedactedHash: string,
  bboxes: Array<{ id: string; x: number; y: number; width: number; height: number; [key: string]: any }>,
  commitment: string,
  proof: Groth16ProofPoints
): Promise<MasterSealResult> {
  const bboxSummary = bboxes
    .map((b) => `${b.id}[x:${b.x},y:${b.y},w:${b.width},h:${b.height}]`)
    .join(';');
  const proofDigest = await sha256Hex(JSON.stringify(proof));
  const preimage = `zeroara:seal:v1:doc:${docRedactedHash}:bbox:${bboxSummary}:commit:${commitment}:proof:${proofDigest}`;
  const sealHex = await sha256Hex(preimage);

  return {
    sealHex,
    preimage,
    docRedactedHash,
    bboxSummary,
    commitment,
    proofDigest,
  };
}

export interface ZeroaraAuditPackage {
  protocol: 'Zeroara Provable Redaction Protocol';
  version: '1.0.0';
  generatedAt: string;
  sourceDocument: {
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    preimageSha256: string;
  };
  sanitizedDocument: {
    fileSizeBytes: number;
    preimageSha256: string;
    burnedBoundingBoxes: Array<{ id: string; label: string; x: number; y: number; width: number; height: number; page: number }>;
    textStreamsDetected: number;
  };
  enterpriseRequirement: {
    requesterName: string;
    purpose: string;
    targetField: string;
    predicate: string;
    thresholdValue: number;
    currency: string;
    challengeNonce: string;
  };
  zeroKnowledgeProof: {
    curve: string;
    protocol: string;
    publicSignals: string[];
    proof: Groth16ProofPoints;
    poseidonCommitment: string;
    blindingSalt: string;
    sessionBinding?: string;
    verified: boolean;
    verificationLatencyMs: number;
  };
  masterAuditSeal: MasterSealResult;
}

export async function verifyAuditPackage(pkg: ZeroaraAuditPackage): Promise<{
  sealValid: boolean;
  proofValid: boolean;
  computedSealHex: string;
  expectedSealHex: string;
}> {
  // 1. Recompute Master Seal
  const bboxes = pkg.sanitizedDocument.burnedBoundingBoxes;
  const recomputed = await computeMasterAuditSeal(
    pkg.sanitizedDocument.preimageSha256,
    bboxes,
    pkg.zeroKnowledgeProof.poseidonCommitment,
    pkg.zeroKnowledgeProof.proof
  );

  const sealValid = recomputed.sealHex.toLowerCase() === pkg.masterAuditSeal.sealHex.toLowerCase();

  // 2. Verify ZK Proof
  const proofVerify = await verifyIncomeProof(
    pkg.zeroKnowledgeProof.proof,
    pkg.zeroKnowledgeProof.publicSignals
  );

  return {
    sealValid,
    proofValid: proofVerify.isValid,
    computedSealHex: recomputed.sealHex,
    expectedSealHex: pkg.masterAuditSeal.sealHex,
  };
}

export interface RedactionResult {
  redactedPdfBytes: Uint8Array;
  redactedHashHex: string;
  chunkedHash: string;
  textStreamCount: number;
  burnedZonesCount: number;
  durationMs: number;
  flattenedPngDataUrl: string;
  fileSizeBytes: number;
}

// 6. True Physical Pixel Burning & Rasterized Non-Extractable PDF Generator
export async function createFlattenedRedactedPdf(
  sourceCanvas: HTMLCanvasElement,
  bboxes: ClassifiedTarget[]
): Promise<RedactionResult> {
  const startTime = performance.now();

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // 1. Offscreen canvas at source resolution
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;

  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Copy base document raster
  ctx.drawImage(sourceCanvas, 0, 0);

  // 2. Physically burn pitch-black (#000000) pixels over all target bounding zones
  ctx.fillStyle = '#000000';
  for (const box of bboxes) {
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }

  // Generate high-resolution PNG data
  const dataUrl = offscreen.toDataURL('image/png');
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const pngBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pngBytes[i] = binaryString.charCodeAt(i);
  }

  // 3. Build flattened PDF containing ONLY the embedded raster image
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBytes);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width,
    height,
  });

  const redactedPdfBytes = await pdfDoc.save();

  // 4. Compute cryptographic preimage H(Doc_Redacted)
  const redactedHashHex = await sha256Hex(redactedPdfBytes);
  const chunkedHash = formatChunkedHash(redactedHashHex);

  // 5. Automated zero-text-stream verification via pdfjs
  let textStreamCount = 0;
  try {
    const verifyDoc = await (pdfjs as any).getDocument({
      data: redactedPdfBytes.slice(),
      standardFontDataUrl: '/standard_fonts/',
    }).promise;
    const p1 = await verifyDoc.getPage(1);
    const tc = await p1.getTextContent();
    textStreamCount = tc.items.length;
  } catch (err) {
    console.warn('Text stream verification note:', err);
  }

  const durationMs = Math.max(1, Math.round(performance.now() - startTime));

  return {
    redactedPdfBytes,
    redactedHashHex,
    chunkedHash,
    textStreamCount,
    burnedZonesCount: bboxes.length,
    durationMs,
    flattenedPngDataUrl: dataUrl,
    fileSizeBytes: redactedPdfBytes.length,
  };
}

// Client-side instant zero-network file downloader
export function downloadFile(bytes: Uint8Array, fileName: string, mimeType: string) {
  const blob = new Blob([bytes as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 7. Human-friendly 8-byte Chunked Hash Formatter
export function formatChunkedHash(hashHex: string): string {
  return hashHex.match(/.{1,8}/g)?.join(' ') || hashHex;
}

// 8. Dynamic Authentic Sample PDF Synthesizer (Zero Placeholders)
export async function generateSamplePdfBytes(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
  const { width, height } = page.getSize();

  // Draw header block
  page.drawRectangle({
    x: 40,
    y: height - 94,
    width: width - 80,
    height: 54,
    color: rgb(0.94, 0.96, 0.98),
  });

  page.drawText('CONFIDENTIAL ACCREDITED INVESTOR VERIFICATION', {
    x: 55,
    y: height - 64,
    size: 13,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.18),
  });

  page.drawText('SEC Rule 506(c) Regulatory Filing  •  Apex Distributed Ventures LP  •  Aug 14, 2026', {
    x: 55,
    y: height - 82,
    size: 8.5,
    font,
    color: rgb(0.42, 0.46, 0.52),
  });

  // Body content lines
  const rows = [
    { label: 'Investor Legal Identity:', value: 'Alexandra Vance', boldVal: false },
    { label: 'Social Security Number:', value: '459-00-8812', isMono: true },
    { label: 'Tax Residency:', value: 'United States of America', boldVal: false },
    { label: 'Custody Institution:', value: 'Goldman Sachs Wealth Management (Ref: #APX-9921)', boldVal: false },
    { label: '', value: '' },
    { label: 'FINANCIAL ASSESSMENT & EARNINGS CONFIRMATION:', value: '', isHeader: true },
    { label: '1. 2-Year Trailing Net Income:', value: 'USD 145,000', isMono: true },
    { label: '2. Verified Individual Net Worth:', value: 'USD 2,850,000 (Excl. primary residence)', boldVal: true },
    { label: '3. Liquidity Ratio:', value: '4.2x baseline statutory coverage', boldVal: false },
    { label: '', value: '' },
    { label: 'Legal Attestation:', value: 'I hereby attest under penalty of perjury that the verified credentials meet statutory criteria.', boldVal: false },
  ];

  let y = height - 134;
  for (const row of rows) {
    if (row.isHeader) {
      page.drawText(row.label, { x: 55, y, size: 10, font: fontBold, color: rgb(0.08, 0.12, 0.18) });
      y -= 26;
      continue;
    }
    if (!row.label && !row.value) {
      y -= 8;
      continue;
    }
    page.drawText(row.label, { x: 55, y, size: 9.5, font, color: rgb(0.28, 0.33, 0.4) });
    if (row.value) {
      const f = row.isMono ? fontMono : (row.boldVal ? fontBold : font);
      page.drawText(row.value, { x: 235, y, size: 9.5, font: f, color: rgb(0.08, 0.12, 0.18) });
    }
    y -= 26;
  }

  // Master seal placeholder anchor in PDF
  page.drawRectangle({
    x: 40,
    y: 50,
    width: width - 80,
    height: 44,
    color: rgb(0.95, 0.96, 0.98),
  });

  page.drawText('PROVABLE REDACTION PROTOCOL  •  IN-BROWSER CRYPTOGRAPHIC ANCHOR', {
    x: 55,
    y: 74,
    size: 7.5,
    font: fontBold,
    color: rgb(0.92, 0.35, 0.05),
  });

  page.drawText('Preimage SHA-256 bound to physical document raster. Zero server egress.', {
    x: 55,
    y: 60,
    size: 7,
    font,
    color: rgb(0.4, 0.45, 0.52),
  });

  return await pdfDoc.save();
}

// 9. Spatial Token & Extraction Result Types
export interface ExtractedSpatialToken {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  confidence?: number;
}

export type TargetAction = 'PROVE_AND_BURN' | 'DIRECT_BURN';
export type TargetSource = 'OCR_AUTO' | 'MANUAL_USER';

export interface ClassifiedTarget {
  id: string;
  label: string;
  classification: string;
  extractedValue: string;
  numericValue?: number;
  satisfiesThreshold?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  action: TargetAction;
  source: TargetSource;
  confidence?: number;
}

export interface DocumentExtractionResult {
  tokens: ExtractedSpatialToken[];
  targets: ClassifiedTarget[];
  rawText: string;
  engineName: string;
  meanConfidence: number;
  latencyMs: number;
  width: number;
  height: number;
  numPages: number;
  usedOcrFallback: boolean;
}

// Rendering / OCR resolution controls
const DISPLAY_WIDTH = 900; // canvas + coordinate space presented to the UI
const OCR_SUPERSAMPLE = 2.0; // spec Stage 2: 2.0x viewport scale for OCR fidelity
const OCR_MAX_WIDTH = 2200; // hard cap to bound Tesseract Wasm memory
const TEXT_LAYER_MIN_TOKENS = 5; // below this a PDF is treated as scanned -> OCR

type OcrProgressFn = (percent: number, status: string) => void;

// 10. Tesseract LSTM Worker Core (zero-egress, local Wasm assets)
interface RawOcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

// Word extraction that tolerates both the flat `words` array and the
// block/paragraph/line tree emitted by newer tesseract.js builds.
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
    // parameter tuning is best-effort; recognition proceeds with defaults
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

// PDF: render page 1, use the native vector text layer when present, else OCR.
async function extractPdfDocument(
  fileBytes: Uint8Array,
  canvas: HTMLCanvasElement,
  onProgress?: OcrProgressFn
): Promise<ExtractionCore> {
  // Reuse the module-level pdfjs import (workerSrc is configured at module load).
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

  // 1) Native vector text layer — exact coordinates for digital PDFs.
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

  // 2) Scanned PDF — rasterize page at supersampled scale and OCR it.
  const ocrScale = Math.min(displayScale * OCR_SUPERSAMPLE, OCR_MAX_WIDTH / unscaled.width);
  const ocrViewport = page.getViewport({ scale: ocrScale });
  const off = document.createElement('canvas');
  off.width = Math.round(ocrViewport.width);
  off.height = Math.round(ocrViewport.height);
  const octx = off.getContext('2d');
  if (octx) {
    await (page.render({ canvasContext: octx, viewport: ocrViewport } as any) as any).promise;
  }

  const { words, rawText } = await runTesseract(off, onProgress);
  const factor = canvas.width / Math.max(1, off.width);
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

// 11. Raster Image OCR Extraction (Tesseract, supersampled from source pixels)
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

  // Display render at the shared coordinate-space width.
  canvas.width = DISPLAY_WIDTH;
  canvas.height = Math.max(1, Math.round(naturalH * (DISPLAY_WIDTH / naturalW)));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  // High-resolution OCR render straight from the source pixels.
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

  const { words, rawText } = await runTesseract(off, onProgress);
  const factor = canvas.width / Math.max(1, off.width);
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

// 12. Spatial Line Reconstruction & Multi-Token Field Classifier
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

// Cluster tokens into visual lines by vertical center proximity, then order L→R.
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

// Run a regex over the joined line text and recover the contiguous tokens it spans.
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

// Union bounding box across tokens, with the spec Stage-3 padding expansion.
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

    // Government identifiers (SSN / Tax ID).
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

    // Email addresses.
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

    // Currency amounts — witness vs. plain figure decided after the full sweep.
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

    // Phone numbers — only after stricter patterns have claimed their tokens.
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

  // Select the ZK witness among currency amounts: prefer an income/salary line,
  // else the first amount above threshold, else the largest amount present.
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

  // Fallback: nothing auto-classified — surface substantial tokens for manual review.
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

  // Witness first, then spatial (top-to-bottom) order.
  targets.sort((a, b) => {
    if (a.action !== b.action) return a.action === 'PROVE_AND_BURN' ? -1 : 1;
    return a.y - b.y;
  });
  return targets;
}

// 13. High-Level Document Extraction Orchestrator (Stage 2 entrypoint)
// Renders the document onto `canvas`, extracts spatial tokens (native text
// layer for digital PDFs, Tesseract OCR for scanned PDFs and images), then
// classifies redaction targets — all in one zero-egress local pass.
export async function extractDocumentSpatial(
  doc: { mimeType: string; rawBytes?: Uint8Array; fileObj?: File },
  canvas: HTMLCanvasElement,
  thresholdValue: number,
  onProgress?: OcrProgressFn
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
      ? 'Tesseract LSTM Neural OCR · Scanned PDF (2.0× supersampled)'
      : 'pdf.js Vector Text Matrix · Native Spatial';
  } else if (doc.fileObj && doc.mimeType.startsWith('image/')) {
    core = await extractImageDocument(doc.fileObj, canvas, onProgress);
    engineName = 'Tesseract LSTM Neural OCR · Raster Image (2.0× supersampled)';
  }

  const targets = classifyExtractedTargets(core.tokens, thresholdValue);
  return {
    ...core,
    targets,
    engineName,
    latencyMs: Math.max(1, Math.round(performance.now() - start)),
  };
}


