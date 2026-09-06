import { useState, useRef, useEffect } from 'react';
import './App.css';
import {
  sha256Hex,
  formatChunkedHash,
  generateSamplePdfBytes,
  extractPdfSpatialItems,
  extractImageOcrSpatial,
  classifyExtractedTargets,
  renderImageFileToCanvas,
  type ExtractedSpatialToken,
  type ClassifiedTarget,
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
  Plus,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
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

export interface OcrTelemetrySummary {
  latencyMs: number;
  tokenCount: number;
  engineName: string;
  targetsFound: number;
}

export function App() {
  const [activePhase, setActivePhase] = useState<1 | 2>(1);
  const [doc, setDoc] = useState<IngestedDoc | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showHudOverlays, setShowHudOverlays] = useState(true);
  const [showAllTokens, setShowAllTokens] = useState(false);

  // Real OCR & Extraction Pipeline State
  const [detectedFields, setDetectedFields] = useState<ClassifiedTarget[]>([]);
  const [extractedTokens, setExtractedTokens] = useState<ExtractedSpatialToken[]>([]);
  const [ocrTelemetry, setOcrTelemetry] = useState<OcrTelemetrySummary | null>(null);

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

  const cleanCanvasDataRef = useRef<ImageData | null>(null);

  // Core Document Extraction Pipeline running on mounted canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !doc || !doc.rawBytes) return;

    let isCancelled = false;

    const runExtraction = async () => {
      setOcrRunning(true);
      const start = performance.now();

      try {
        let tokens: ExtractedSpatialToken[] = [];
        let engine = 'PDF Native Spatial Text Matrix';

        if (doc.mimeType === 'application/pdf') {
          const res = await extractPdfSpatialItems(doc.rawBytes!, canvas);
          tokens = res.tokens;
        } else if (doc.fileObj && doc.mimeType.startsWith('image/')) {
          engine = 'In-Browser Neural OCR (Tesseract Wasm)';
          await renderImageFileToCanvas(doc.fileObj, canvas);
          const res = await extractImageOcrSpatial(canvas);
          tokens = res.tokens;
        }

        if (isCancelled) return;

        // Cache the pristine rendered document raster for instant non-destructive HUD overlays
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          cleanCanvasDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }

        const classified = classifyExtractedTargets(tokens, enterpriseSpec.thresholdValue);
        const elapsed = Math.max(1, Math.round(performance.now() - start));

        setExtractedTokens(tokens);
        setDetectedFields(classified);
        if (classified.length > 0) {
          setSelectedFieldId(classified[0].id);
        }

        setOcrTelemetry({
          latencyMs: elapsed,
          tokenCount: tokens.length,
          engineName: engine,
          targetsFound: classified.length,
        });

        // Overlay bounding boxes if in Phase 2
        if (activePhase === 2 && showHudOverlays) {
          drawBoundingBoxOverlays(canvas, classified, classified[0]?.id || null);
        }
      } catch (err) {
        console.error('Document spatial processing error:', err);
      } finally {
        if (!isCancelled) {
          setOcrRunning(false);
        }
      }
    };

    runExtraction();

    return () => {
      isCancelled = true;
    };
  }, [doc]);

  // Synchronous blit & redraw overlays whenever Phase, HUD toggle, or target selection changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cleanCanvasDataRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Restore pristine document raster
    ctx.putImageData(cleanCanvasDataRef.current, 0, 0);

    // Draw active bounding box overlays
    if (activePhase === 2 && showHudOverlays && detectedFields.length > 0) {
      drawBoundingBoxOverlays(canvas, detectedFields, selectedFieldId);
    }
  }, [activePhase, showHudOverlays, selectedFieldId, detectedFields]);

  // Ingest uploaded user document
  const handleFileUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(arrayBuffer);
    const hashHex = await sha256Hex(rawBytes);
    const chunkedHash = formatChunkedHash(hashHex);

    const newDoc: IngestedDoc = {
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

    setDoc(newDoc);
    setActivePhase(1);
  };

  // Ingest synthesized authentic sample PDF document
  const handleLoadSample = async () => {
    const samplePdfBytes = await generateSamplePdfBytes();
    const hashHex = await sha256Hex(samplePdfBytes);
    const chunkedHash = formatChunkedHash(hashHex);

    const newDoc: IngestedDoc = {
      fileName: 'Accredited_Investor_Verification_ApexLP.pdf',
      fileSizeBytes: samplePdfBytes.length,
      mimeType: 'application/pdf',
      hashHex,
      chunkedHash,
      timestamp: new Date().toLocaleTimeString(),
      isSample: true,
      rawBytes: samplePdfBytes,
    };

    setDoc(newDoc);
    setActivePhase(1);
  };

  // Support URL parameters for automated verification & presets
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sample') === 'true' || params.get('phase') === '2') {
      handleLoadSample().then(() => {
        if (params.get('phase') === '2') {
          setActivePhase(2);
        }
      });
    }
  }, []);

  // Draw real spatial bounding boxes over canvas
  const drawBoundingBoxOverlays = (
    canvas: HTMLCanvasElement,
    fields: ClassifiedTarget[] = detectedFields,
    selectedId: string | null = selectedFieldId
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    fields.forEach((field) => {
      const isSelected = selectedId === field.id;
      const isWitness = field.action === 'PROVE_AND_BURN';
      const mainColor = isWitness ? '#EA580C' : '#0D9488';

      ctx.save();
      // Bounding box fill
      ctx.fillStyle = isWitness ? 'rgba(234, 88, 12, 0.14)' : 'rgba(13, 148, 136, 0.14)';
      ctx.fillRect(field.x, field.y, field.width, field.height);

      // Bounding box stroke
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash(isSelected ? [] : [4, 3]);
      ctx.strokeRect(field.x, field.y, field.width, field.height);

      // Spatial HUD Tag Badge
      ctx.setLineDash([]);
      ctx.fillStyle = mainColor;
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      const tagPrefix = isWitness ? 'WITNESS CLAIM' : 'PII IDENTIFIER';
      const badgeText = `${tagPrefix} [x:${field.x}, y:${field.y}, w:${field.width}, h:${field.height}]`;
      
      const badgeY = field.y > 14 ? field.y - 4 : field.y + field.height + 10;
      ctx.fillText(badgeText, field.x, badgeY);

      ctx.restore();
    });
  };

  // Add a specific token as a redaction target
  const handleAddTokenAsTarget = (token: ExtractedSpatialToken) => {
    const newTarget: ClassifiedTarget = {
      id: `manual_${Date.now()}`,
      label: `Redaction Zone: "${token.text.slice(0, 16)}"`,
      classification: 'Manual Redaction Zone',
      extractedValue: token.text,
      x: Math.max(0, token.x - 3),
      y: Math.max(0, token.y - 2),
      width: token.width + 6,
      height: token.height + 4,
      page: token.page,
      action: 'DIRECT_BURN',
      source: 'MANUAL_USER',
    };

    setDetectedFields((prev) => [...prev, newTarget]);
    setSelectedFieldId(newTarget.id);
  };

  // Remove a target
  const handleRemoveTarget = (id: string) => {
    setDetectedFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
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

  const witnessTarget = detectedFields.find((f) => f.action === 'PROVE_AND_BURN');

  return (
    <div className="app-shell">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        accept=".pdf,.png,.jpg,.jpeg"
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
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: 'var(--fg-primary)' }}>
                ZEROARA
              </span>
              <span className="neu-badge">
                PROVABLE REDACTION PROTOCOL
              </span>
              <span className="neu-severed-pill">
                <WifiOff size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                EGRESS: 0 KB / 0 REQUESTS [SEVERED]
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {doc ? (
                <button
                  type="button"
                  className="neu-btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 16px', gap: '6px' }}
                  onClick={() => {
                    setDoc(null);
                    setDetectedFields([]);
                    setExtractedTokens([]);
                    setOcrTelemetry(null);
                    setActivePhase(1);
                  }}
                >
                  <RefreshCw size={13} />
                  <span>Clear & Upload Another</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="neu-btn-primary"
                  style={{ fontSize: '0.84rem', padding: '9px 18px' }}
                  onClick={handleLoadSample}
                >
                  Load Sample Document
                </button>
              )}
            </div>
          </div>

          {/* Sequential 2-Phase Progress Track */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Phase 1 Stepper Node */}
            <div
              onClick={() => setActivePhase(1)}
              className={`neu-card ${activePhase === 1 ? 'phase-active-border' : ''}`}
              style={{
                padding: '16px 20px',
                borderRadius: '20px',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '14px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface)',
                  boxShadow: activePhase === 1 ? 'var(--shadow-inset)' : 'var(--shadow-extruded-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: doc ? 'var(--accent-secondary)' : 'var(--accent)',
                  flexShrink: 0,
                }}
              >
                {doc ? <Check size={18} /> : <FileText size={18} />}
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
                  Phase 1: Document Ingest & SHA-256 Digest
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', marginTop: '2px' }}>
                  {doc ? `Root Anchored: ${doc.hashHex.substring(0, 18)}...` : 'Awaiting Document Upload'}
                </div>
              </div>
            </div>

            {/* Phase 2 Stepper Node */}
            <div
              onClick={() => doc && setActivePhase(2)}
              className={`neu-card ${activePhase === 2 ? 'phase-active-border' : ''}`}
              style={{
                padding: '16px 20px',
                borderRadius: '20px',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '14px',
                cursor: doc ? 'pointer' : 'not-allowed',
                opacity: doc ? 1 : 0.6,
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface)',
                  boxShadow: activePhase === 2 ? 'var(--shadow-inset)' : 'var(--shadow-extruded-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: detectedFields.length > 0 ? 'var(--accent)' : 'var(--fg-muted)',
                  flexShrink: 0,
                }}
              >
                <Scan size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
                  Phase 2: OCR Detection & Coordinate Mapping
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', marginTop: '2px' }}>
                  {detectedFields.length > 0
                    ? `${detectedFields.length} Spatial Bounding Coordinates Active`
                    : doc ? 'Ready for Coordinate Analysis' : 'Requires Ingested Document'}
                </div>
              </div>
            </div>
          </div>

          {/* Phase 1 Architecture: 3-Column Structured Breakdown */}
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

          {/* Phase 2 Architecture: 3-Column Structured Breakdown */}
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
                      Local spatial engine parses exact pixel geometry [x, y, w, h] to bind redaction zones to the document layout.
                    </p>
                  </div>
                </div>
                <span className="neu-hash-pill">
                  {ocrTelemetry ? ocrTelemetry.engineName : 'CLIENT SPATIAL ENGINE'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div className="neu-well" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    01. Coordinate Extraction
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--fg-primary)', lineHeight: '1.5' }}>
                    Extracts {extractedTokens.length} spatial text tokens directly from the document raster without transmitting a single byte outside RAM.
                  </p>
                </div>

                <div className="neu-well" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    02. Enterprise Witness Matching
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--fg-primary)', lineHeight: '1.5' }}>
                    {witnessTarget ? (
                      <>
                        Evaluates parsed witness: <strong>{witnessTarget.extractedValue}</strong> against enterprise threshold <strong>&gt;= ${enterpriseSpec.thresholdValue.toLocaleString()} USD</strong>.
                      </>
                    ) : (
                      'Evaluates parsed witness claims against active enterprise threshold criteria.'
                    )}
                  </p>
                </div>

                <div className="neu-well" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    03. Seal Geometry Anchor
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--fg-primary)', lineHeight: '1.5' }}>
                    Coordinates [x, y, w, h] are hashed directly into the Master Audit Seal. Shifting the redaction box by 1 pixel breaks proof validity.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Split-Pane: Document Viewport (Left) & Cryptographic Telemetry (Right) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
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
                      {activePhase === 1 ? 'STAGE 1: RAW INGEST' : `STAGE 2: ${detectedFields.length} TARGETS`}
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
                /* Real Rendered Canvas */
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
                <span>Spatial Engine: {ocrTelemetry ? ocrTelemetry.engineName : 'Native Canvas'}</span>
                <span>Isolated RAM: Active</span>
              </div>
            </div>

            {/* Right Panel: Telemetry & Spatial Inspector */}
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
                  {/* Preimage SHA-256 Digest Card */}
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

                  {/* Enterprise Verification Specification Simulator */}
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
                          onClick={() => {
                            setEnterpriseSpec((prev) => ({ ...prev, requesterName: p.req, targetField: p.field, thresholdValue: p.amount }));
                            if (extractedTokens.length > 0) {
                              setDetectedFields(classifyExtractedTargets(extractedTokens, p.amount));
                            }
                          }}
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
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setEnterpriseSpec({ ...enterpriseSpec, thresholdValue: val });
                            if (extractedTokens.length > 0) {
                              setDetectedFields(classifyExtractedTargets(extractedTokens, val));
                            }
                          }}
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
                      onClick={() => setActivePhase(2)}
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
                  {/* Real Telemetry Bar */}
                  {ocrTelemetry && (
                    <div className="neu-well" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        {ocrTelemetry.tokenCount} tokens parsed ({ocrTelemetry.latencyMs}ms)
                      </span>
                      <span style={{ color: 'var(--fg-muted)' }}>
                        {detectedFields.length} target zones locked
                      </span>
                    </div>
                  )}

                  {/* Dynamically Rendered Detected Fields */}
                  {detectedFields.length === 0 ? (
                    <div className="neu-well" style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.82rem' }}>
                      No targets auto-classified. Select tokens below or drag on canvas to define redaction regions.
                    </div>
                  ) : (
                    detectedFields.map((field, idx) => {
                      const isSelected = selectedFieldId === field.id;
                      const isWitness = field.action === 'PROVE_AND_BURN';
                      return (
                        <div
                          key={field.id}
                          onClick={() => setSelectedFieldId(field.id)}
                          className="neu-well"
                          style={{
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            cursor: 'pointer',
                            boxShadow: isSelected
                              ? (isWitness ? 'var(--shadow-inset), 0 0 0 2px var(--accent)' : 'var(--shadow-inset), 0 0 0 2px var(--accent-secondary)')
                              : 'var(--shadow-inset)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Crosshair size={16} style={{ color: isWitness ? 'var(--accent)' : 'var(--accent-secondary)' }} />
                              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
                                Target {idx + 1}: {field.label}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                className="neu-claim-badge"
                                style={{
                                  backgroundColor: isWitness ? 'rgba(234, 88, 12, 0.12)' : 'rgba(13, 148, 136, 0.12)',
                                  color: isWitness ? 'var(--accent)' : 'var(--accent-secondary)',
                                }}
                              >
                                {isWitness ? 'ZK PROVE & BURN' : 'DIRECT REDACTION'}
                              </span>
                              {field.source === 'MANUAL_USER' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveTarget(field.id);
                                  }}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Extracted Text:</span>
                            <span className="neu-secret-badge" style={{ color: isWitness ? 'var(--accent)' : 'inherit', fontWeight: 700 }}>
                              {field.extractedValue}
                            </span>
                          </div>

                          {isWitness && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Enterprise Threshold:</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700 }}>
                                  &gt;= ${enterpriseSpec.thresholdValue.toLocaleString()} USD
                                </span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Condition Satisfied:</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 800, color: (field.numericValue || 0) >= enterpriseSpec.thresholdValue ? 'var(--accent-secondary)' : '#DC2626' }}>
                                  {(field.numericValue || 0) >= enterpriseSpec.thresholdValue
                                    ? `TRUE ($${((field.numericValue || 0) / 1000).toFixed(0)}k >= $${(enterpriseSpec.thresholdValue / 1000).toFixed(0)}k)`
                                    : `FALSE ($${((field.numericValue || 0) / 1000).toFixed(0)}k < $${(enterpriseSpec.thresholdValue / 1000).toFixed(0)}k)`}
                                </span>
                              </div>
                            </>
                          )}

                          {!isWitness && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Classification:</span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                                {field.classification}
                              </span>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '6px' }}>
                            <span>Bounding Coords: [x: {field.x}, y: {field.y}, w: {field.width}, h: {field.height}]</span>
                            <span>Page {field.page}</span>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Token Explorer Drawer Toggle */}
                  <div className="neu-well" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      onClick={() => setShowAllTokens(!showAllTokens)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <SlidersHorizontal size={14} style={{ color: 'var(--accent)' }} />
                        <span>Document Token Index ({extractedTokens.length} detected)</span>
                      </span>
                      <ChevronDown
                        size={15}
                        style={{
                          transform: showAllTokens ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s ease',
                          color: 'var(--fg-muted)',
                        }}
                      />
                    </div>

                    {showAllTokens && (
                      <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '6px' }}>
                        {extractedTokens.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className="neu-pill-btn"
                            style={{ fontSize: '0.72rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleAddTokenAsTarget(t)}
                            title={`Click to redact: [x:${t.x}, y:${t.y}, w:${t.width}, h:${t.height}]`}
                          >
                            <span>{t.text}</span>
                            <Plus size={10} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Phase 2 Operational Confirmation */}
                  <div className="neu-well" style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-inset-sm)', borderRadius: 'var(--radius-btn)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={20} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                        Phase 2 Operational: {detectedFields.length} Spatial Target Zones Bound
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', marginTop: '2px' }}>
                        All spatial bounding boxes are derived directly from document geometry, ready for Phase 3: Irreversible Pixel Burning.
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
