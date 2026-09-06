# Zeroara Agent Handoff: OCR Stage

This file is the first thing a Claude agent should read when working in this repo. Follow it as project guidance unless a human gives a newer, explicit instruction.

## Current Project State

Zeroara is a 100% client-side provable redaction engine built with Vite, React 19, TypeScript, pdfjs-dist, Tesseract.js, pdf-lib, Web Crypto, and snarkjs. The pipeline is intended to run:

1. Ingest
2. OCR & Detect
3. Pixel Burn
4. ZK Prove
5. Seal & Bundle

The current UI and pipeline already exist, but Stage 2 still behaves like a demo path in `src/hooks/usePipeline.ts`: it emits hard-coded `$145,000` and `SAMPLE_BOUNDING_BOXES`. The next build stage is to replace that stub with real browser-local OCR/detection and normalized coordinates.

Relevant existing files:

- `src/hooks/usePipeline.ts`: sequential pipeline state machine and telemetry.
- `src/core/zeroara.ts`: crypto helpers, PDF sample generation, proof/seal helpers, and partial spatial extraction helpers.
- `src/types.ts`: older domain types. Prefer the active pipeline types in `usePipeline.ts` unless you are deliberately consolidating.
- `public/tesseract/`: local Tesseract worker/core/lang assets.
- `public/pdf.worker.min.mjs`: local PDF.js worker asset.
- `public/standard_fonts/`: PDF.js font data.

## Stage 2 Goal

Implement real in-browser OCR and coordinate normalization for Page 1 of uploaded PDF/image documents, with no server processing and no outbound document egress.

Stage 2 must emit:

- Document render dimensions.
- Recognized token stream.
- Word/token bounding boxes in canvas pixel coordinates.
- Candidate redaction targets for PII and financial values.
- OCR confidence where available.
- The selected financial witness value used by Stage 4.

The output must replace the hard-coded `SAMPLE_BOUNDING_BOXES` and `145000` path for uploaded documents. The sample-document button may keep a deterministic fallback only if it is clearly marked as generated local sample data and does not contaminate uploaded-file behavior.

## Implementation Plan

Start with the smallest reliable integration, then isolate into workers.

1. Wire real Stage 2 into `runPipelineFromIngest`.
   - Use `telemetry.ingest?.rawBytes` and `telemetry.ingest?.uploadedFile`.
   - For PDF files, render Page 1 using `pdfjs-dist` at approximately 2.0x OCR scale or a fixed width that preserves readable OCR detail.
   - For image files, draw the image to an unattached canvas.
   - Do not attach raw document pixels to the DOM unless the existing viewport requires preview rendering.

2. Reuse or harden the helpers in `src/core/zeroara.ts`.
   - `extractPdfSpatialItems(...)` already renders a PDF page and extracts PDF text-layer coordinates.
   - `extractImageOcrSpatial(...)` already invokes local Tesseract assets.
   - `classifyExtractedTargets(...)` already performs initial SSN/currency classification.
   - These helpers are acceptable starting points, but they need better token merging, confidence handling, and threshold selection.

3. Prefer a hybrid detection path for PDFs.
   - First, use PDF.js text content coordinates when text is extractable. This is faster and more accurate.
   - Also render Page 1 to canvas for visual dimensions and later pixel burn alignment.
   - Use Tesseract OCR when the PDF text layer is empty, suspiciously sparse, or coordinate extraction fails.
   - Keep all paths browser-local and asset-local.

4. Normalize all boxes into one coordinate system.
   - Use top-left origin canvas coordinates: `{ x, y, width, height, page }`.
   - Include the page number, starting at `1`.
   - Clamp boxes to page bounds.
   - Add deterministic padding before burn: 4 px left/top and 8 px total width/height unless a better shared constant is introduced.
   - Do not mix PDF point coordinates with canvas pixel coordinates inside telemetry.

5. Detect target classes.
   - Direct-burn identifiers: SSN-like values, tax IDs, account numbers, phone numbers, email addresses.
   - Prove-and-burn financial witness candidates: USD/currency amounts and labeled income/salary/net-worth fields.
   - Prefer candidates near labels matching `/income|salary|earnings|compensation|wages/i` for the Stage 4 witness.
   - Avoid selecting unrelated values such as dates, percentages, ratios, or account references as the income witness.
   - If multiple financial values exist, rank by label proximity first, then by numeric value, then by OCR confidence.

6. Update telemetry without breaking downstream stages.
   - `OcrClaimTelemetry.actualValueStr` should be the detected string, e.g. `USD 145,000`.
   - `actualValueNum` must be parsed as an integer number of whole currency units.
   - `thresholdStr` and `thresholdNum` continue to come from `EnterprisePolicy`.
   - `confidence` should be a real aggregate confidence when OCR is used, otherwise `100` or `undefined` semantics should be documented for PDF text extraction.
   - `detectedFields` must be `BoundingBoxCoords[]` compatible with existing raster/proof/seal code.

7. Feed downstream stages from OCR output.
   - Stage 3 must burn the detected fields, not `SAMPLE_BOUNDING_BOXES`, for uploaded documents.
   - Stage 4 must prove `ocr.actualValueNum >= policy.thresholdValue`, not hard-coded `145000`.
   - Stage 5 must compute the master seal over the actual redacted document hash and actual boxes.

8. Move heavy work off the UI thread after correctness is established.
   - Create `src/workers/ocr.worker.ts` or equivalent Vite worker module.
   - Own Tesseract worker lifecycle inside that worker.
   - Send only `ArrayBuffer`, file metadata, and policy threshold into the worker.
   - Return serializable telemetry: dimensions, tokens, targets, confidence, elapsed time, and warnings.
   - Terminate Tesseract cleanly and support cancellation via pipeline abort state where possible.

## Required Data Shapes

Keep the public pipeline types explicit. A good Stage 2 internal result shape is:

```ts
interface OcrStageResult {
  page: number;
  width: number;
  height: number;
  rawText: string;
  tokens: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence?: number;
    page: number;
  }>;
  targets: Array<{
    id: string;
    label: string;
    field: string;
    value: string;
    numericValue?: number;
    confidence?: number;
    action: 'DIRECT_BURN' | 'PROVE_AND_BURN';
    box: BoundingBoxCoords;
  }>;
  selectedWitness: {
    valueString: string;
    valueNumber: number;
    targetId: string;
  } | null;
}
```

You may adapt this shape, but do not hide token boxes or candidate ranking from telemetry.

## Privacy And Security Rules

- Do not send uploaded document bytes, OCR text, screenshots, tokens, hashes, proofs, or receipts to external services.
- Do not add analytics, hosted OCR APIs, remote model calls, or CDN-hosted workers.
- Tesseract, PDF.js, wasm, zkey, and fonts must load from same-origin `public/` assets.
- Avoid logging raw OCR text or raw PII to `console` in production paths.
- Do not keep object URLs or workers alive after they are no longer needed.
- If a browser blocks WASM/worker execution, surface a clear local error; do not silently return mock OCR for uploaded documents.

## Acceptance Criteria

Before committing OCR-stage work, verify:

- `npm run build` passes.
- Uploading a text-layer PDF detects at least one real financial target and uses it for `actualValueNum`.
- Uploading a scanned/image document runs Tesseract and returns word-level boxes.
- Stage 3 receives the exact boxes emitted by Stage 2.
- Stage 4 receives the detected witness value.
- The audit receipt includes the actual bounding boxes and does not claim hard-coded sample values for uploaded documents.
- Empty/unsupported/low-confidence documents fail gracefully with a visible error state instead of producing a fake proof.

## Things To Avoid

- Do not refactor the whole app while implementing OCR.
- Do not rename pipeline states unless every UI reference is updated.
- Do not introduce backend services.
- Do not commit generated `dist`, `node_modules`, `.vercel`, or `src-tauri/target`.
- Do not modify circuit assets unless the task explicitly changes the proof circuit.
- Do not use hard-coded bounding boxes or hard-coded income values for uploaded documents.

## Useful Commands

```sh
npm run build
npm run dev
```

Production is deployed on Vercel as `zeroara` and aliased to `https://zeroara.vercel.app`.
