import React, { useRef, useEffect } from 'react';
import { StepNumber, PipelineState, PipelineTelemetry } from '../hooks/usePipeline';
import { Layers } from 'lucide-react';

interface DocumentViewportProps {
  activeStep: StepNumber;
  pipelineState: PipelineState;
  telemetry: PipelineTelemetry;
}

export const DocumentViewport: React.FC<DocumentViewportProps> = ({
  activeStep,
  pipelineState,
  telemetry,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High-fidelity document rendering on standard HTML5 canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 640;
    const height = 500;
    canvas.width = width;
    canvas.height = height;

    // Draw document page background
    ctx.fillStyle = '#FAFBFC';
    ctx.fillRect(0, 0, width, height);

    // Subtle page border and shadow
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Certificate Header Banner
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(24, 20, width - 48, 54);
    ctx.strokeStyle = '#E2E8F0';
    ctx.strokeRect(24, 20, width - 48, 54);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CONFIDENTIAL ACCREDITED INVESTOR VERIFICATION', 40, 44);

    ctx.fillStyle = '#64748B';
    ctx.font = '10px "DM Sans", sans-serif';
    ctx.fillText('SEC Rule 506(c) Regulatory Filing  •  Apex Distributed Ventures LP  •  Aug 14, 2026', 40, 62);

    // Document Body Fields
    ctx.font = '12px "DM Sans", sans-serif';
    ctx.fillStyle = '#334155';

    let y = 105;
    ctx.fillText('Investor Legal Identity: Alexandra Vance', 40, y);
    y += 26;

    // Line with SSN
    ctx.fillText('Social Security Number: ', 40, y);
    const ssnTextX = 182;
    const ssnTextY = y;
    if (activeStep <= 2) {
      ctx.fillText('459-00-8812', ssnTextX, ssnTextY);
    }
    y += 26;

    ctx.fillText('Tax Residency: United States of America', 40, y);
    y += 26;
    ctx.fillText('Custody Institution: Goldman Sachs Wealth Management (Ref: #APX-9921)', 40, y);
    y += 34;

    // Section 2: Earnings and Income
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('FINANCIAL ASSESSMENT & EARNINGS CONFIRMATION:', 40, y);
    y += 26;

    ctx.font = '12px "DM Sans", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('1. 2-Year Trailing Net Income: ', 40, y);
    const incomeTextX = 222;
    const incomeTextY = y;
    if (activeStep <= 2) {
      ctx.fillText('$145,000 USD', incomeTextX, incomeTextY);
    }
    y += 26;

    ctx.fillText('2. Verified Individual Net Worth: $2,850,000 USD (Excl. primary residence)', 40, y);
    y += 26;
    ctx.fillText('3. Liquidity Ratio: 4.2x baseline statutory coverage', 40, y);
    y += 36;

    ctx.fillStyle = '#64748B';
    ctx.font = 'italic 10px "DM Sans", sans-serif';
    ctx.fillText('I hereby attest under penalty of perjury that the verified credentials meet regulatory standards.', 40, y);

    // Stage-specific Overlays:
    // Stage 1: Clean document (already rendered)

    // Stage 2: Visible coordinate bounding boxes with green/accent outlines
    if (activeStep === 2) {
      // SSN bounding box
      ctx.save();
      ctx.strokeStyle = '#0D9488'; // teal accent
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(ssnTextX - 4, ssnTextY - 15, 96, 20);
      ctx.fillStyle = 'rgba(13, 148, 136, 0.12)';
      ctx.fillRect(ssnTextX - 4, ssnTextY - 15, 96, 20);

      // Coordinate tag
      ctx.fillStyle = '#0D9488';
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.fillText('OCR: [x:178, y:138, w:96, h:20]', ssnTextX - 4, ssnTextY - 18);
      ctx.restore();

      // Income bounding box
      ctx.save();
      ctx.strokeStyle = '#EA580C'; // orange accent
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(incomeTextX - 4, incomeTextY - 15, 104, 20);
      ctx.fillStyle = 'rgba(234, 88, 12, 0.12)';
      ctx.fillRect(incomeTextX - 4, incomeTextY - 15, 104, 20);

      // Coordinate tag
      ctx.fillStyle = '#EA580C';
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.fillText('OCR CLAIM: [x:218, y:244, w:104, h:20]', incomeTextX - 4, incomeTextY - 18);
      ctx.restore();
    }

    // Stage 3: Replace outlined boxes with solid, opaque black boxes physically rasterized onto the canvas
    if (activeStep === 3) {
      // Burn SSN
      ctx.fillStyle = '#000000';
      ctx.fillRect(ssnTextX - 6, ssnTextY - 16, 106, 22);

      // Burn Income
      ctx.fillStyle = '#000000';
      ctx.fillRect(incomeTextX - 6, incomeTextY - 16, 114, 22);

      // Burn notification stamp
      ctx.fillStyle = '#DC2626';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('▲ TEXT STREAM STRIPPED & PIXEL BURNED', 40, height - 30);
    }

    // Stage 4 & 5: Stamp the master seal tag over the primary black box
    if (activeStep >= 4) {
      // SSN remains burned black box
      ctx.fillStyle = '#000000';
      ctx.fillRect(ssnTextX - 6, ssnTextY - 16, 106, 22);

      // Income box: solid black with stamped seal tag
      const sealWidth = 260;
      const sealHeight = 26;
      ctx.fillStyle = '#05070A';
      ctx.fillRect(incomeTextX - 6, incomeTextY - 18, sealWidth, sealHeight);

      // Seal border
      ctx.strokeStyle = activeStep === 5 ? '#EA580C' : '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(incomeTextX - 6, incomeTextY - 18, sealWidth, sealHeight);

      // Stamped seal text
      const shortSeal = telemetry.seal?.masterSeal?.sealHex.substring(0, 8) || '4f8a9e21';
      const sealTag = `█[SEAL: #0x${shortSeal} | >= $100k]█`;

      ctx.fillStyle = activeStep === 5 ? '#FB923C' : '#7DD3FC';
      ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
      ctx.fillText(sealTag, incomeTextX + 2, incomeTextY);

      // Bottom load-bearing certificate seal
      if (activeStep === 5) {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(24, height - 60, width - 48, 44);
        ctx.strokeStyle = '#CBD5E1';
        ctx.strokeRect(24, height - 60, width - 48, 44);

        ctx.fillStyle = '#EA580C';
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.fillText('LOAD-BEARING MASTER AUDIT SEAL (GROTH16 + POSEIDON + CANVAS RASTER)', 36, height - 42);

        ctx.fillStyle = '#334155';
        ctx.font = '9px "JetBrains Mono", monospace';
        const fullSeal = telemetry.seal?.masterSeal?.sealHex || '0x4f8a9e210b37cd9a882f014e7a83d41092e0ab778f21908ca1';
        ctx.fillText(`Digest: ${fullSeal.substring(0, 48)}...`, 36, height - 26);
      }
    }
  }, [activeStep, pipelineState, telemetry]);

  const stepTitle = {
    1: 'Stage 1: Clean Sample Document Ingested',
    2: 'Stage 2: OCR Bounding Coordinate Detection',
    3: 'Stage 3: Physical Black Pixel Burn & Raster Flattening',
    4: 'Stage 4: Groth16 ZK Witness Commitment',
    5: 'Stage 5: Cryptographic Master Audit Seal Stamped',
  }[activeStep];

  const stepBadgeColor = {
    1: 'var(--fg-muted)',
    2: 'var(--accent-secondary)',
    3: 'var(--accent-rose)',
    4: 'var(--accent)',
    5: 'var(--accent)',
  }[activeStep];

  return (
    <div className="neu-card" style={{ width: '100%', padding: '20px 24px', gap: '14px' }}>
      {/* Viewport Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.96rem' }}>
            Document Viewport
          </span>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-inset-sm)',
            color: stepBadgeColor,
          }}
        >
          {stepTitle}
        </div>
      </div>

      {/* Canvas Viewport Well */}
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '12px',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-inset-deep)',
          borderRadius: 'var(--radius-btn)',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            display: 'block',
          }}
        />
      </div>

      {/* Viewport Micro-Footer Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--fg-muted)',
          padding: '4px 6px',
        }}
      >
        <span>Resolution: 640 × 500 px (300 DPI)</span>
        <span>Text Stream: {activeStep >= 3 ? 'Stripped / Eradicated' : 'Active'}</span>
        <span>Redaction: {activeStep >= 3 ? '100% Solid Black Pixel Fill' : activeStep === 2 ? 'Outlines Active' : 'None'}</span>
      </div>
    </div>
  );
};
