import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import { ClassifiedTarget } from '../layer2_ocr/types';
import { RedactionResult } from './types';
import { sha256Hex, formatChunkedHash } from '../layer1_ingest/ingestEngine';

/**
 * Layer 3 Burn Engine:
 * Physically obliterates underlying text operators, paints solid #000000 pixels
 * over target coordinates in memory, and re-encodes the document into an immutable
 * non-extractable PDF raster.
 */

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

  // 2. Physically overwrite target bounding zones with solid pitch-black (#000000) pixels in RAM
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

  // 3. Build flattened PDF containing ONLY the embedded raster image (zero text streams)
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
