import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { IngestedDoc, IngestTelemetry } from './types';

/**
 * Layer 1 Ingest Engine:
 * Ingests raw document files into browser memory isolate and calculates
 * the immutable SHA-256 Preimage Root Hash H(Doc).
 */

// In-browser Web Crypto SHA-256 (FIPS 180-4 compliant)
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer as any);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Human-friendly 8-byte chunked hash formatter
export function formatChunkedHash(hashHex: string): string {
  return hashHex.match(/.{1,8}/g)?.join(' ') || hashHex;
}

// Ingest local File object into browser memory isolate
export async function ingestDocumentFile(file: File): Promise<{
  doc: IngestedDoc;
  telemetry: IngestTelemetry;
}> {
  const start = performance.now();
  const arrayBuffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(arrayBuffer);
  const hashHex = await sha256Hex(rawBytes);
  const chunkedHash = formatChunkedHash(hashHex);
  const latencyMs = Math.max(1, Math.round(performance.now() - start));

  const doc: IngestedDoc = {
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: file.type || 'application/octet-stream',
    hashHex,
    chunkedHash,
    timestamp: new Date().toLocaleTimeString(),
    isSample: false,
    rawBytes,
    fileObj: file,
  };

  const telemetry: IngestTelemetry = {
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: doc.mimeType,
    hashHex,
    latencyMs,
    isolatedRam: true,
    networkEgressBlocked: true,
  };

  return { doc, telemetry };
}

// Generate realistic synthetic PDF sample for offline testing
export async function generateSamplePdfBytes(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 750]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  // Background Header Card
  page.drawRectangle({
    x: 40,
    y: 650,
    width: 520,
    height: 60,
    color: rgb(0.95, 0.96, 0.98),
  });

  page.drawText('APEX ASSET MANAGEMENT & PRIVATE EQUITY LP', {
    x: 55,
    y: 688,
    size: 11,
    font: fontBold,
    color: rgb(0.12, 0.15, 0.2),
  });

  page.drawText('CONFIDENTIAL ACCREDITED INVESTOR VERIFICATION CERTIFICATE', {
    x: 55,
    y: 668,
    size: 9,
    font,
    color: rgb(0.35, 0.4, 0.48),
  });

  // Certificate Metadata
  page.drawText('CERTIFICATE SERIAL: APX-2026-9941-K82', {
    x: 55,
    y: 625,
    size: 8,
    font: fontMono,
    color: rgb(0.4, 0.45, 0.5),
  });

  page.drawText('ISSUANCE DATE: MARCH 14, 2026', {
    x: 350,
    y: 625,
    size: 8,
    font: fontMono,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Section 1: Subject Identification
  page.drawText('SECTION 1: PRINCIPAL BENEFICIARY IDENTIFICATION', {
    x: 55,
    y: 590,
    size: 9.5,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.28),
  });

  page.drawLine({
    start: { x: 55, y: 582 },
    end: { x: 545, y: 582 },
    thickness: 0.75,
    color: rgb(0.8, 0.85, 0.9),
  });

  page.drawText('FULL LEGAL NAME:', { x: 55, y: 560, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText('ALEXANDER V. MERCER', { x: 175, y: 560, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  page.drawText('TAX IDENTIFIER (SSN):', { x: 55, y: 535, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText('984-21-4820', { x: 175, y: 535, size: 9, font: fontMono, color: rgb(0.1, 0.1, 0.1) });

  page.drawText('RESIDENTIAL JURISDICTION:', { x: 55, y: 510, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText('CALIFORNIA, UNITED STATES', { x: 175, y: 510, size: 9, font, color: rgb(0.1, 0.1, 0.1) });

  // Section 2: Financial Witness
  page.drawText('SECTION 2: CERTIFIED ANNUAL NET INCOME ATTESTATION', {
    x: 55,
    y: 470,
    size: 9.5,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.28),
  });

  page.drawLine({
    start: { x: 55, y: 462 },
    end: { x: 545, y: 462 },
    thickness: 0.75,
    color: rgb(0.8, 0.85, 0.9),
  });

  page.drawText('AUDITED ANNUAL INCOME:', { x: 55, y: 440, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText('USD 145,000', { x: 195, y: 440, size: 10, font: fontBold, color: rgb(0.08, 0.1, 0.12) });

  page.drawText('ACCREDITATION CRITERIA:', { x: 55, y: 415, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText('SEC RULE 506(c) INDIVIDUAL STATUS', { x: 195, y: 415, size: 8.5, font, color: rgb(0.2, 0.25, 0.3) });

  page.drawText('NET LIQUID ASSET VALUATION:', { x: 55, y: 390, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText('$420,000.00 USD', { x: 195, y: 390, size: 9, font: fontMono, color: rgb(0.2, 0.25, 0.3) });

  // Section 3: Legal Attestation
  page.drawText('SECTION 3: LEGAL NOTICE & CRYPTOGRAPHIC ANCHOR', {
    x: 55,
    y: 350,
    size: 9.5,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.28),
  });

  page.drawLine({
    start: { x: 55, y: 342 },
    end: { x: 545, y: 342 },
    thickness: 0.75,
    color: rgb(0.8, 0.85, 0.9),
  });

  page.drawText(
    'This document is an authentic financial certificate synthesized directly for Zeroara Protocol verification.',
    { x: 55, y: 320, size: 8, font, color: rgb(0.4, 0.45, 0.5) }
  );
  page.drawText(
    'Downstream ZK proofs are irreversibly anchored to the SHA-256 preimage digest of this file in RAM.',
    { x: 55, y: 305, size: 8, font, color: rgb(0.4, 0.45, 0.5) }
  );

  // Add additional dummy pages for multi-page processing test
  for (let i = 2; i <= 5; i++) {
    const extraPage = pdfDoc.addPage([600, 750]);
    extraPage.drawText(`APPENDIX: PAGE ${i}`, {
      x: 55,
      y: 700,
      size: 11,
      font: fontBold,
      color: rgb(0.12, 0.15, 0.2),
    });
    extraPage.drawText(`This is synthetic filler content for page ${i} of the sample document.`, {
      x: 55,
      y: 670,
      size: 9,
      font,
      color: rgb(0.35, 0.4, 0.48),
    });
    extraPage.drawText(`CONFIDENTIAL DATA BLOCK ${i}A:`, {
      x: 55,
      y: 640,
      size: 9,
      font: fontBold,
      color: rgb(0.12, 0.15, 0.2),
    });
    extraPage.drawText(`ROUTING-${i}983-XYZ`, {
      x: 220,
      y: 640,
      size: 9,
      font: fontMono,
      color: rgb(0.1, 0.1, 0.1),
    });
    
    extraPage.drawText(`CONFIDENTIAL DATA BLOCK ${i}B:`, {
      x: 55,
      y: 610,
      size: 9,
      font: fontBold,
      color: rgb(0.12, 0.15, 0.2),
    });
    extraPage.drawText(`$${(i * 15000).toLocaleString()}.00 USD`, {
      x: 220,
      y: 610,
      size: 9,
      font: fontMono,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  return await pdfDoc.save();
}

// Deterministic QR-like block for the specimen card (not a real QR payload).
function drawSpecimenQr(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const n = 21;
  const cell = size / n;
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  ctx.fillStyle = '#111827';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const finder = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
      const on = finder
        ? (r % 6 === 0 || c % 6 === 0 || (r > 1 && r < 5 && c > 1 && c < 5)) && !(r === 6 && c === 6)
        : rnd() > 0.5;
      if (on) ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
    }
  }
}

/**
 * Synthetic Aadhaar-style SPECIMEN card (PNG) for the Aadhaar scenario demo.
 * Deterministic sample data only — never a real identity: the number starts
 * with 0 (Aadhaar numbers never do) and the card is watermarked SPECIMEN.
 * Being a raster image, it exercises the real OCR path end-to-end.
 */
export async function generateSampleAadhaarPng(): Promise<Uint8Array> {
  const W = 1000;
  const H = 630;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, H - 14, W, 14);

  ctx.fillStyle = '#1f2937';
  ctx.font = '600 30px "DM Sans", Arial, sans-serif';
  ctx.fillText('भारत सरकार', 300, 70);
  ctx.font = '700 34px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('Government of India', 300, 112);

  // Photo placeholder (grey silhouette)
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(60, 140, 190, 240);
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 140, 190, 240);
  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.arc(155, 220, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(155, 345, 80, 60, 0, Math.PI, 0);
  ctx.fill();

  // Demographics (Latin name line sits directly above the DOB line, as on real cards)
  ctx.fillStyle = '#111827';
  ctx.font = '500 30px Arial, sans-serif';
  ctx.fillText('नमूना व्यक्ति', 300, 190);
  ctx.font = '600 34px Arial, sans-serif';
  ctx.fillText('Specimen Person', 300, 232);
  ctx.font = '500 30px Arial, sans-serif';
  ctx.fillText('जन्म तिथि / DOB : 15/08/1998', 300, 284);
  ctx.fillText('पुरुष / Male', 300, 330);

  drawSpecimenQr(ctx, 790, 150, 170);

  ctx.fillStyle = '#111827';
  ctx.font = '800 60px "Courier New", monospace';
  ctx.fillText('0123 4567 8901', 300, 470);

  ctx.fillStyle = '#b91c1c';
  ctx.font = '600 26px Arial, sans-serif';
  ctx.fillText('मेरा आधार, मेरी पहचान', 340, 560);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 9);
  ctx.fillStyle = '#EA580C';
  ctx.font = '800 88px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SPECIMEN · NOT A REAL ID', 0, 30);
  ctx.restore();

  const blob: Blob = await new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png')
  );
  return new Uint8Array(await blob.arrayBuffer());
}
