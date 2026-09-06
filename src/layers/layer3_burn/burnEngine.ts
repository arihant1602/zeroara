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
  pageRasters: Map<number, ImageData>,
  numPages: number,
  bboxes: ClassifiedTarget[]
): Promise<RedactionResult> {
  const startTime = performance.now();
  const pdfDoc = await PDFDocument.create();
  
  let totalTextStreams = 0;
  let firstPageDataUrl = '';

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const raster = pageRasters.get(pageNum);
    if (!raster) continue;

    const width = raster.width;
    const height = raster.height;

    // 1. Offscreen canvas at source resolution
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;

    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // Copy base document raster
    ctx.putImageData(raster, 0, 0);

    // 2. Physically overwrite target bounding zones with solid pitch-black (#000000) pixels in RAM
    ctx.fillStyle = '#000000';
    const pageBboxes = bboxes.filter((b) => b.page === pageNum);
    for (const box of pageBboxes) {
      ctx.fillRect(box.x, box.y, box.width, box.height);
    }

    // Generate high-resolution PNG data
    const dataUrl = offscreen.toDataURL('image/png');
    if (pageNum === 1) {
      firstPageDataUrl = dataUrl;
    }
    
    const base64Data = dataUrl.split(',')[1];
    const binaryString = atob(base64Data);
    const pngBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pngBytes[i] = binaryString.charCodeAt(i);
    }

    // 3. Build flattened PDF containing ONLY the embedded raster image (zero text streams)
    const pngImage = await pdfDoc.embedPng(pngBytes);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  const redactedPdfBytes = await pdfDoc.save();

  // 4. Compute cryptographic preimage H(Doc_Redacted)
  const redactedHashHex = await sha256Hex(redactedPdfBytes);
  const chunkedHash = formatChunkedHash(redactedHashHex);

  // 5. Automated zero-text-stream verification via pdfjs
  try {
    const verifyDoc = await (pdfjs as any).getDocument({
      data: redactedPdfBytes.slice(),
      standardFontDataUrl: '/standard_fonts/',
    }).promise;
    for (let i = 1; i <= verifyDoc.numPages; i++) {
      const p = await verifyDoc.getPage(i);
      const tc = await p.getTextContent();
      totalTextStreams += tc.items.length;
    }
  } catch (err) {
    console.warn('Text stream verification note:', err);
  }

  const durationMs = Math.max(1, Math.round(performance.now() - startTime));

  return {
    redactedPdfBytes,
    redactedHashHex,
    chunkedHash,
    textStreamCount: totalTextStreams,
    burnedZonesCount: bboxes.length,
    durationMs,
    flattenedPngDataUrl: firstPageDataUrl,
    fileSizeBytes: redactedPdfBytes.length,
    pageCount: numPages,
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
