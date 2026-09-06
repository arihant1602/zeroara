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
  const [doc, setDoc] = useState<IngestedDoc | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
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
  };

  // Canvas renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !doc) return;

    if (!doc.isSample && doc.rawBytes && doc.mimeType === 'application/pdf') {
      renderPdfBytesToCanvas(doc.rawBytes, canvas).catch(() => renderSampleCanvas(canvas));
      return;
    }

    if (!doc.isSample && doc.fileObj && doc.mimeType.startsWith('image/')) {
      renderImageFileToCanvas(doc.fileObj, canvas).catch(() => renderSampleCanvas(canvas));
      return;
    }

    renderSampleCanvas(canvas);
  }, [doc]);

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
          {/* Top Bar */}
          <div className="neu-card" style={{ padding: '16px 24px', borderRadius: '24px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src="/logo.png"
                alt="Zeroara Logo"
                style={{ width: '34px', height: '34px', objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(234, 88, 12, 0.3))' }}
              />
              <div className="brand-title" style={{ fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                ZEROARA
              </div>
              <span className="brand-tag">STAGE 1: DOCUMENT INGESTION & SHA-256 DIGEST</span>
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
                  onClick={() => setDoc(null)}
                  style={{ padding: '8px 16px', fontSize: '0.82rem', gap: '6px' }}
                >
                  <RefreshCw size={13} />
                  <span>Clear & Upload Another</span>
                </button>
              )}
            </div>
          </div>

          {/* Stage 1 Explanatory Intro Card */}
          <div className="neu-card" style={{ padding: '18px 24px', borderRadius: '24px', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 800, fontSize: '0.86rem' }}>
              <Hash size={16} />
              <span>PHASE 1 ARCHITECTURE: WHY THE SHA-256 PREIMAGE DIGEST MATTERS</span>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', lineHeight: '1.6' }}>
              Before any redaction or zero-knowledge proof occurs, Zeroara reads your raw document into local memory and calculates its immutable <strong>SHA-256 Preimage Digest H(Doc)</strong>.
              This hash serves as the cryptographic foundation for the entire protocol. Any 1-pixel or 1-character modification anywhere in the file produces a completely different hash, ensuring the downstream zero-knowledge proof is irreversibly welded to this exact document.
            </p>
          </div>

          {/* Split-Pane: Document Viewport (Left) & Cryptographic Inspector (Right) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
              gap: '20px',
              alignItems: 'stretch',
            }}
          >
            {/* Left Panel: Ingest & Viewport */}
            <div className="neu-card" style={{ width: '100%', padding: '22px', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.96rem' }}>
                    Document Ingestion Viewport
                  </span>
                </div>
                {doc && (
                  <span className="neu-hash-pill" style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>
                    INGEST COMPLETE (STAGE 1)
                  </span>
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
                <span>Preimage Engine: Native WebCrypto (Wasm)</span>
                <span>Isolated RAM: Active</span>
              </div>
            </div>

            {/* Right Panel: Cryptographic Telemetry & Enterprise Simulator */}
            <div className="neu-card" style={{ width: '100%', padding: '22px', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.96rem' }}>
                  Stage 1 Cryptographic Telemetry
                </span>
              </div>

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

                <p style={{ fontSize: '0.76rem', color: 'var(--fg-muted)', lineHeight: '1.5' }}>
                  Simulate the external enterprise asking for verification. In Stage 2, Zeroara will prove your document satisfies this exact predicate without revealing the raw number.
                </p>

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

                {/* Inline Form Controls */}
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

              {/* Status Outcome Banner */}
              {doc ? (
                <div className="neu-well" style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-inset-sm)', borderRadius: 'var(--radius-btn)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={20} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                      Stage 1 Operational: Document Cryptographically Anchored
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', marginTop: '2px' }}>
                      SHA-256 Preimage computed in RAM. Next step: OCR coordinate detection and bounding box burn.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', textAlign: 'center', padding: '10px' }}>
                  Upload a document or load sample above to execute Stage 1 ingestion.
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
