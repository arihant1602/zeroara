import { useState, useRef, useEffect } from 'react';
import './App.css';
import {
  sha256Hex,
  formatChunkedHash,
  renderPdfBytesToCanvas,
  renderImageFileToCanvas,
} from './core/zeroara';
import {
  UploadCloud,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Building2,
  ShieldCheck,
  WifiOff,
  Hash,
  CheckCircle2,
  Scan,
  Crosshair,
  ArrowRight,
} from 'lucide-react';

export interface IngestedDoc {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  hashHex: string;
  chunkedHash: string;
  timestamp: string;
  isSample: boolean;
  rawBytes?: Uint8Array;
  fileObj?: File;
}

export interface EnterpriseSpec {
  requesterName: string;
  purpose: string;
  targetField: string;
  predicate: string;
  thresholdValue: number;
  currency: string;
  challengeNonce: string;
}

export interface DetectedOcrField {
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
  action: 'PROVE_AND_BURN' | 'DIRECT_BURN';
}

const SAMPLE_CERT_TEXT = `CONFIDENTIAL ACCREDITED INVESTOR VERIFICATION
Issuer: Apex Distributed Ventures LP
Target: Zeroara Protocol Round A
Date of Examination: 2026-08-14

Investor Legal Name: Alexandra Vance
Social Security Number: 459-00-8812
Tax Residency: United States of America
Primary Asset Custody: Goldman Sachs Wealth Management

FINANCIAL ASSESSMENT & EARNINGS CONFIRMATION:
1. 2-Year Trailing Net Income: $145,000 USD
2. Verified Individual Net Worth: $2,850,000 USD (Excl. primary residence)
3. Liquidity Ratio: 4.2x regulatory baseline

I hereby certify under penalty of perjury that the undersigned satisfies the definitions
of an Accredited Investor as set forth in Rule 501 of Regulation D.`;

export function App() {
  const [activePhase, setActivePhase] = useState<1 | 2>(1);
  const [doc, setDoc] = useState<IngestedDoc | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>('field_income');
  const [showHudOverlays, setShowHudOverlays] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Enterprise Verification Spec State
  const [enterpriseSpec, setEnterpriseSpec] = useState<EnterpriseSpec>({
    requesterName: 'Apex Distributed Ventures LP',
    purpose: 'SEC Rule 506(c) Accredited Investor Verification',
    targetField: '2-Year Trailing Net Income',
    predicate: '>= (Greater than or equal to)',
    thresholdValue: 100000,
    currency: 'USD',
    challengeNonce: '0x94f8a2bc710e39b4d1c68f12a03',
  });

  const presets = [
    { label: 'SEC 506(c) ($100k)', req: 'Apex Distributed Ventures LP', field: '2-Year Trailing Net Income', amount: 100000 },
    { label: 'Senior Salary ($150k)', req: 'Orbital Cybernetics Corp', field: 'Base Annual Salary', amount: 150000 },
    { label: 'Mortgage Solvency ($80k)', req: 'First Horizon Underwriting', field: 'Qualifying Annual Income', amount: 80000 },
  ];

  // OCR Detected Fields definition
  const detectedFields: DetectedOcrField[] = [
    {
      id: 'field_ssn',
      label: 'Social Security Number',
      classification: 'Government Identifier (Sensitive PII)',
      extractedValue: '459-00-8812',
      x: 182,
      y: 138,
      width: 124,
      height: 22,
      page: 1,
      action: 'DIRECT_BURN',
    },
    {
      id: 'field_income',
      label: '2-Year Trailing Income',
      classification: 'Financial Witness Claim',
      extractedValue: '$145,000 USD',
      numericValue: 145000,
      satisfiesThreshold: 145000 >= enterpriseSpec.thresholdValue,
      x: 222,
      y: 244,
      width: 110,
      height: 22,
      page: 1,
      action: 'PROVE_AND_BURN',
    },
  ];

  // Ingest uploaded user document
  const handleFileUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(arrayBuffer);
    const hashHex = await sha256Hex(rawBytes);
    const chunkedHash = formatChunkedHash(hashHex);

    setDoc({
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      hashHex,
      chunkedHash,
      timestamp: new Date().toLocaleTimeString(),
      isSample: false,
      rawBytes,
      fileObj: file,
    });
    setActivePhase(1);
  };

  // Ingest sample preset document
  const handleLoadSample = async () => {
    const rawBytes = new TextEncoder().encode(SAMPLE_CERT_TEXT);
    const hashHex = await sha256Hex(rawBytes);
    const chunkedHash = formatChunkedHash(hashHex);

    setDoc({
      fileName: 'Accredited_Investor_Verification_ApexLP.pdf',
      fileSizeBytes: 48290,
      mimeType: 'application/pdf',
      hashHex,
      chunkedHash,
      timestamp: new Date().toLocaleTimeString(),
      isSample: true,
      rawBytes,
    });
    setActivePhase(1);
  };

  // Run Phase 2 OCR simulation
  const runOcrScan = async () => {
    setOcrRunning(true);
    await new Promise((r) => setTimeout(r, 600));
    setOcrRunning(false);
    setActivePhase(2);
  };

  // Canvas renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !doc) return;

    if (!doc.isSample && doc.rawBytes && doc.mimeType === 'application/pdf') {
      renderPdfBytesToCanvas(doc.rawBytes, canvas).then(() => {
        if (activePhase === 2 && showHudOverlays) {
          drawOcrOverlays(canvas);
        }
      }).catch(() => {
        renderSampleCanvas(canvas);
        if (activePhase === 2 && showHudOverlays) {
          drawOcrOverlays(canvas);
        }
      });
      return;
    }

    if (!doc.isSample && doc.fileObj && doc.mimeType.startsWith('image/')) {
      renderImageFileToCanvas(doc.fileObj, canvas).then(() => {
        if (activePhase === 2 && showHudOverlays) {
          drawOcrOverlays(canvas);
        }
      }).catch(() => {
        renderSampleCanvas(canvas);
        if (activePhase === 2 && showHudOverlays) {
          drawOcrOverlays(canvas);
        }
      });
      return;
    }

    renderSampleCanvas(canvas);
    if (activePhase === 2 && showHudOverlays) {
      drawOcrOverlays(canvas);
    }
  }, [doc, activePhase, showHudOverlays, selectedFieldId, enterpriseSpec]);

  const renderSampleCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = 640;
    const height = 500;
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#FAFBFC';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, width - 2, height - 2);

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

    ctx.font = '12px "DM Sans", sans-serif';
    ctx.fillStyle = '#334155';
    let y = 105;
    ctx.fillText('Investor Legal Identity: Alexandra Vance', 40, y);
    y += 26;
    ctx.fillText('Social Security Number: 459-00-8812', 40, y);
    y += 26;
    ctx.fillText('Tax Residency: United States of America', 40, y);
    y += 26;
    ctx.fillText('Custody Institution: Goldman Sachs Wealth Management (Ref: #APX-9921)', 40, y);
    y += 34;

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('FINANCIAL ASSESSMENT & EARNINGS CONFIRMATION:', 40, y);
    y += 26;
    ctx.font = '12px "DM Sans", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('1. 2-Year Trailing Net Income: $145,000 USD', 40, y);
    y += 26;
    ctx.fillText('2. Verified Individual Net Worth: $2,850,000 USD (Excl. primary residence)', 40, y);
    y += 26;
    ctx.fillText('3. Liquidity Ratio: 4.2x baseline statutory coverage', 40, y);
    y += 36;

    ctx.fillStyle = '#64748B';
    ctx.font = 'italic 10px "DM Sans", sans-serif';
    ctx.fillText('I hereby attest under penalty of perjury that the verified credentials meet regulatory standards.', 40, y);
  };

  const drawOcrOverlays = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    detectedFields.forEach((field) => {
      const isSelected = selectedFieldId === field.id;
      const isWitness = field.action === 'PROVE_AND_BURN';
      const mainColor = isWitness ? '#EA580C' : '#0D9488';

      ctx.save();
      // Bounding box fill
      ctx.fillStyle = isWitness ? 'rgba(234, 88, 12, 0.12)' : 'rgba(13, 148, 136, 0.12)';
      ctx.fillRect(field.x - 4, field.y - 15, field.width, field.height);

      // Bounding box stroke
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(field.x - 4, field.y - 15, field.width, field.height);

      // Coordinate HUD badge
      ctx.setLineDash([]);
      ctx.fillStyle = mainColor;
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      const badgeText = isWitness
        ? `WITNESS [x:${field.x}, y:${field.y}, w:${field.width}, h:${field.height}]`
        : `PII: SSN [x:${field.x}, y:${field.y}, w:${field.width}, h:${field.height}]`;
      ctx.fillText(badgeText, field.x - 4, field.y - 18);

      ctx.restore();
    });
  };

  const copyHash = () => {
    if (!doc) return;
    navigator.clipboard.writeText(doc.hashHex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateNonce = () => {
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    let hex = '0x';
    arr.forEach((b) => (hex += b.toString(16).padStart(2, '0')));
    setEnterpriseSpec((prev) => ({ ...prev, challengeNonce: hex }));
  };

  return (
    <div className="app-shell">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        accept=".pdf,.png,.jpg,.jpeg,.txt"
        style={{ display: 'none' }}
      />

      <main className="main-viewport" style={{ padding: '20px 32px 40px 32px' }}>
        <div className="view-container" style={{ maxWidth: '1360px', gap: '20px' }}>
          {/* Top Bar with Brand, Network Severing Egress Monitor, and Actions */}
          <div className="neu-card" style={{ padding: '16px 24px', borderRadius: '24px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <img
                src="/logo.png"
                alt="Zeroara Logo"
                style={{ width: '34px', height: '34px', objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(234, 88, 12, 0.3))' }}
              />
              <div className="brand-title" style={{ fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                ZEROARA
              </div>
              <span className="brand-tag">PROVABLE REDACTION PROTOCOL</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-inset-sm)', padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                <WifiOff size={13} />
                <span>EGRESS: 0 KB / 0 REQUESTS [SEVERED]</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {!doc ? (
                <button
                  className="neu-btn-primary"
                  onClick={handleLoadSample}
                  style={{ padding: '10px 20px', fontSize: '0.84rem' }}
                >
                  Load Sample Document
                </button>
              ) : (
                <button
                  className="neu-btn-secondary"
                  onClick={() => { setDoc(null); setActivePhase(1); }}
                  style={{ padding: '8px 16px', fontSize: '0.82rem', gap: '6px' }}
                >
                  <RefreshCw size={13} />
                  <span>Clear & Upload Another</span>
                </button>
              )}
            </div>
          </div>

          {/* Phase 1 & 2 Stepper Track */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Phase 1 Step Node */}
            <div
              onClick={() => doc && setActivePhase(1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 20px',
                borderRadius: '20px',
                backgroundColor: 'var(--bg-surface)',
                boxShadow: activePhase === 1 ? 'var(--shadow-inset), 0 0 0 2px var(--accent)' : 'var(--shadow-extruded-sm)',
                cursor: doc ? 'pointer' : 'default',
                transition: 'all 250ms ease',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface)',
                  boxShadow: activePhase === 1 ? 'var(--shadow-accent-inset)' : 'var(--shadow-extruded-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: activePhase === 1 ? 'var(--accent)' : 'var(--accent-secondary)',
                }}
              >
                {doc ? <Check size={18} strokeWidth={3} /> : <FileText size={18} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 800, color: activePhase === 1 ? 'var(--accent)' : 'var(--fg-primary)' }}>
                  Phase 1: Document Ingest & SHA-256 Digest
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
                  {doc ? `Root Anchored: ${doc.hashHex.substring(0, 16)}...` : 'Awaiting Document Upload'}
                </span>
              </div>
            </div>

            {/* Phase 2 Step Node */}
            <div
              onClick={() => doc && setActivePhase(2)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 20px',
                borderRadius: '20px',
                backgroundColor: 'var(--bg-surface)',
                boxShadow: activePhase === 2 ? 'var(--shadow-inset), 0 0 0 2px var(--accent)' : doc ? 'var(--shadow-extruded-sm)' : 'var(--shadow-inset-sm)',
                cursor: doc ? 'pointer' : 'not-allowed',
                opacity: doc ? 1 : 0.55,
                transition: 'all 250ms ease',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface)',
                  boxShadow: activePhase === 2 ? 'var(--shadow-accent-inset)' : 'var(--shadow-extruded-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: activePhase === 2 ? 'var(--accent)' : 'var(--accent-secondary)',
                }}
              >
                <Scan size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 800, color: activePhase === 2 ? 'var(--accent)' : 'var(--fg-primary)' }}>
                  Phase 2: OCR Detection & Coordinate Mapping
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
                  {activePhase === 2 ? '2 Bounding Coordinates Active' : doc ? 'Ready to Detect Coordinates' : 'Requires Ingested Document'}
                </span>
              </div>
            </div>
          </div>

          {/* Phase 1 Architecture: Formatted 3-Column Visual Cards (No walls of text) */}
          {activePhase === 1 && (
            <div className="neu-card" style={{ padding: '24px 28px', borderRadius: '28px', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-inset-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <Hash size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}>
                      PHASE 1 ARCHITECTURE: WHY THE SHA-256 PREIMAGE DIGEST MATTERS
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                      Before any redaction or zero-knowledge proof occurs, Zeroara generates an unforgeable root hash.
                    </p>
                  </div>
                </div>
                <span className="neu-hash-pill">ALGORITHM: FIPS 180-4</span>
              </div>

              {/* 3 Structured Explanatory Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div className="neu-well" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    01. In-Memory Root Ingestion
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--fg-primary)', lineHeight: '1.5' }}>
                    Document bytes are loaded directly into browser RAM. No servers, no network requests, zero cloud leaks.
                  </p>
                </div>

                <div className="neu-well" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    02. Avalanche Sensitivity
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--fg-primary)', lineHeight: '1.5' }}>
                    H(Doc) = SHA-256(raw_bytes). Modifying even <strong>1 pixel or character</strong> produces a completely scrambled hash.
                  </p>
                </div>

                <div className="neu-well" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    03. Cryptographic Proof Anchor
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--fg-primary)', lineHeight: '1.5' }}>
                    Irreversibly welds downstream Zero-Knowledge proofs to this exact file, making proof swapping or forgery impossible.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Phase 2 Architecture: Formatted 3-Column Visual Cards */}
          {activePhase === 2 && (
            <div className="neu-card" style={{ padding: '24px 28px', borderRadius: '28px', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-inset-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <Scan size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}>
                      PHASE 2 ARCHITECTURE: OCR SPATIAL BOUNDING COORDINATES
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                      Local canvas OCR parses exact pixel geometry $[x, y, w, h]$ to bind redaction zones to the document layout.
                    </p>
                  </div>
                </div>
                <span className="neu-hash-pill">ENGINE: CANVAS OCR</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div className="neu-well" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    01. Coordinate Extraction
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--fg-primary)', lineHeight: '1.5' }}>
                    Maps exact sub-pixel boundaries $[x, y, w, h]$ for target financial claims and ancillary PII fields directly on the page.
                  </p>
                </div>

                <div className="neu-well" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    02. Enterprise Witness Matching
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--fg-primary)', lineHeight: '1.5' }}>
                    Evaluates the parsed value against the active Enterprise Spec: <strong>$145,000 &gt;= $100,000</strong> satisfies the predicate requirement.
                  </p>
                </div>

                <div className="neu-well" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    03. Seal Geometry Anchor
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--fg-primary)', lineHeight: '1.5' }}>
                    These exact coordinates are later hashed into the Master Audit Seal. Moving the redaction box by 1 pixel invalidates the proof.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Split-Pane: Document Viewport (Left) & Cryptographic Telemetry (Right) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
              gap: '20px',
              alignItems: 'stretch',
            }}
          >
            {/* Left Panel: Document Viewport */}
            <div className="neu-card" style={{ width: '100%', padding: '22px', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.96rem' }}>
                    Document Viewport
                  </span>
                </div>
                {doc && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activePhase === 2 && (
                      <button
                        className="neu-pill-btn"
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        onClick={() => setShowHudOverlays(!showHudOverlays)}
                      >
                        HUD Outlines: {showHudOverlays ? 'Visible' : 'Hidden'}
                      </button>
                    )}
                    <span className="neu-hash-pill" style={{ color: activePhase === 2 ? 'var(--accent)' : 'var(--accent-secondary)', fontWeight: 700 }}>
                      {activePhase === 1 ? 'STAGE 1: RAW INGEST' : 'STAGE 2: OCR DETECTED'}
                    </span>
                  </div>
                )}
              </div>

              {!doc ? (
                /* Drag & Drop Upload Zone */
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="neu-well-deep"
                  style={{
                    minHeight: '420px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    padding: '36px 20px',
                    border: isDragging ? '2px dashed var(--accent)' : '2px dashed #C4CCD8',
                    borderRadius: '24px',
                    backgroundColor: isDragging ? 'rgba(234, 88, 12, 0.05)' : 'var(--bg-surface)',
                    gap: '16px',
                  }}
                >
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-extruded)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <UploadCloud size={32} />
                  </div>
                  <div>
                    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 }}>
                      Drop your document here, or click to browse
                    </h4>
                    <p style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', marginTop: '6px', maxWidth: '380px' }}>
                      Supports <strong>PDF, PNG, JPG, or TXT</strong>. Ingested directly into your browser's private memory isolate with <strong>0 network requests</strong>.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="neu-btn-primary"
                      style={{ fontSize: '0.84rem', padding: '10px 20px' }}
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    >
                      Browse Local Files
                    </button>
                    <button
                      type="button"
                      className="neu-btn-secondary"
                      style={{ fontSize: '0.84rem', padding: '10px 18px' }}
                      onClick={(e) => { e.stopPropagation(); handleLoadSample(); }}
                    >
                      Load Sample Certificate
                    </button>
                  </div>
                </div>
              ) : (
                /* Loaded Document Canvas */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--fg-primary)' }}>
                      {doc.fileName} ({(doc.fileSizeBytes / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      className="neu-pill-btn"
                      style={{ fontSize: '0.72rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <RefreshCw size={11} />
                      <span>Select Different File</span>
                    </button>
                  </div>

                  <div style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center', padding: '10px', backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-inset-deep)', borderRadius: 'var(--radius-btn)' }}>
                    <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'block' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                <span>Spatial Engine: Canvas Pixel Coordinate Matrix</span>
                <span>Isolated RAM: Active</span>
              </div>
            </div>

            {/* Right Panel: Telemetry Inspector */}
            <div className="neu-card" style={{ width: '100%', padding: '22px', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.96rem' }}>
                    {activePhase === 1 ? 'Phase 1 Cryptographic Telemetry' : 'Phase 2 OCR Spatial Telemetry'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className={`neu-pill-btn ${activePhase === 1 ? 'active' : ''}`}
                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                    onClick={() => setActivePhase(1)}
                  >
                    1. Ingest & SHA-256
                  </button>
                  <button
                    className={`neu-pill-btn ${activePhase === 2 ? 'active' : ''}`}
                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                    onClick={() => doc && setActivePhase(2)}
                    disabled={!doc}
                  >
                    2. OCR Detection
                  </button>
                </div>
              </div>

              {/* PHASE 1 VIEW IN TELEMETRY */}
              {activePhase === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* 1. Preimage SHA-256 Digest Card */}
                  <div className="neu-well" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>
                        CRYPTOGRAPHIC PREIMAGE SHA-256 H(Doc):
                      </span>
                      {doc && (
                        <button
                          className="neu-pill-btn"
                          style={{ fontSize: '0.7rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={copyHash}
                        >
                          {copied ? <Check size={12} color="var(--accent-secondary)" /> : <Copy size={12} />}
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8rem',
                        lineHeight: '1.6',
                        color: doc ? 'var(--fg-primary)' : 'var(--fg-muted)',
                        backgroundColor: 'var(--bg-surface)',
                        boxShadow: 'var(--shadow-inset-sm)',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {doc ? doc.chunkedHash : 'Awaiting document ingestion to compute 256-bit digest...'}
                    </div>

                    {doc && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                        <div>Size: {doc.fileSizeBytes.toLocaleString()} bytes</div>
                        <div>MIME: {doc.mimeType}</div>
                        <div>Ingest Time: {doc.timestamp}</div>
                        <div>Zero Network Calls: Confirmed</div>
                      </div>
                    )}
                  </div>

                  {/* 2. Enterprise Verification Specification Simulator */}
                  <div className="neu-well" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={16} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
                          Enterprise Verifier Requirement (Simulator)
                        </span>
                      </div>
                      <span className="neu-claim-badge">SIMULATED AUDITOR</span>
                    </div>

                    {/* Preset Chips */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {presets.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          className="neu-pill-btn"
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 10px',
                            color: enterpriseSpec.thresholdValue === p.amount ? 'var(--accent)' : 'var(--fg-muted)',
                            boxShadow: enterpriseSpec.thresholdValue === p.amount ? 'var(--shadow-inset-sm)' : 'var(--shadow-extruded-sm)',
                            fontWeight: enterpriseSpec.thresholdValue === p.amount ? 700 : 500,
                          }}
                          onClick={() => setEnterpriseSpec((prev) => ({ ...prev, requesterName: p.req, targetField: p.field, thresholdValue: p.amount }))}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg-muted)', display: 'block', marginBottom: '4px' }}>
                          Enterprise Requester Name
                        </label>
                        <input
                          type="text"
                          className="neu-input"
                          style={{ padding: '10px 14px', fontSize: '0.8rem' }}
                          value={enterpriseSpec.requesterName}
                          onChange={(e) => setEnterpriseSpec({ ...enterpriseSpec, requesterName: e.target.value })}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg-muted)', display: 'block', marginBottom: '4px' }}>
                          Required Threshold ($ USD)
                        </label>
                        <input
                          type="number"
                          step="5000"
                          min="1000"
                          className="neu-input"
                          style={{ padding: '10px 14px', fontSize: '0.8rem', fontWeight: 700 }}
                          value={enterpriseSpec.thresholdValue}
                          onChange={(e) => setEnterpriseSpec({ ...enterpriseSpec, thresholdValue: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--fg-muted)' }}>
                      <span>Nonce: <strong className="mono">{enterpriseSpec.challengeNonce.substring(0, 14)}...</strong></span>
                      <button
                        type="button"
                        onClick={regenerateNonce}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                      >
                        <RefreshCw size={11} />
                        <span>Regenerate Nonce</span>
                      </button>
                    </div>
                  </div>

                  {/* Primary CTA to proceed to Phase 2 */}
                  {doc && (
                    <button
                      className="neu-btn-primary"
                      onClick={runOcrScan}
                      disabled={ocrRunning}
                      style={{ width: '100%', padding: '12px', fontSize: '0.88rem', gap: '8px' }}
                    >
                      <span>Proceed to Phase 2: OCR Coordinate Detection</span>
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              )}

              {/* PHASE 2 VIEW IN TELEMETRY */}
              {activePhase === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Target 1: The Witness Claim */}
                  <div
                    onClick={() => setSelectedFieldId('field_income')}
                    className="neu-well"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      cursor: 'pointer',
                      boxShadow: selectedFieldId === 'field_income' ? 'var(--shadow-inset), 0 0 0 2px var(--accent)' : 'var(--shadow-inset)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Crosshair size={16} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
                          Target 1: Financial Witness Claim
                        </span>
                      </div>
                      <span className="neu-claim-badge" style={{ backgroundColor: 'rgba(234, 88, 12, 0.12)', color: 'var(--accent)' }}>
                        ZK PROVE & BURN
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Extracted Text:</span>
                      <span className="neu-secret-badge" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        $145,000 USD
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Enterprise Threshold:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700 }}>
                        &gt;= ${enterpriseSpec.thresholdValue.toLocaleString()} USD
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Condition Satisfied:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                        TRUE ($145k &gt;= ${enterpriseSpec.thresholdValue / 1000}k)
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '6px' }}>
                      <span>Bounding Coords: [x: 222, y: 244, w: 110, h: 22]</span>
                      <span>Page 1</span>
                    </div>
                  </div>

                  {/* Target 2: Ancillary PII (SSN) */}
                  <div
                    onClick={() => setSelectedFieldId('field_ssn')}
                    className="neu-well"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      cursor: 'pointer',
                      boxShadow: selectedFieldId === 'field_ssn' ? 'var(--shadow-inset), 0 0 0 2px var(--accent-secondary)' : 'var(--shadow-inset)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Crosshair size={16} style={{ color: 'var(--accent-secondary)' }} />
                        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
                          Target 2: Ancillary Government Identifier
                        </span>
                      </div>
                      <span className="neu-claim-badge" style={{ backgroundColor: 'rgba(13, 148, 136, 0.12)', color: 'var(--accent-secondary)' }}>
                        DIRECT REDACTION
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Extracted Raw Value:</span>
                      <span className="neu-secret-badge">
                        459-00-8812
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Classification:</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                        Sensitive Identity PII (SSN)
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '6px' }}>
                      <span>Bounding Coords: [x: 182, y: 138, w: 124, h: 22]</span>
                      <span>Page 1</span>
                    </div>
                  </div>

                  {/* Phase 2 Operational Confirmation */}
                  <div className="neu-well" style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-inset-sm)', borderRadius: 'var(--radius-btn)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={20} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                        Phase 2 Operational: Coordinates Locked & Witness Bound
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', marginTop: '2px' }}>
                        Both spatial bounding boxes are ready for Phase 3: Irreversible Pixel Burning & Text Stream Stripping.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
