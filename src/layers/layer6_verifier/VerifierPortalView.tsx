import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Download,
  Layers,
  Fingerprint,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { ZeroaraAuditPackage } from '../layer5_seal/types';
import { VerifierAuditReport, TamperMode } from './types';
import { runEnterpriseAudit, createTamperedPackage } from './verifierEngine';

interface VerifierPortalViewProps {
  initialPackage?: ZeroaraAuditPackage | null;
  onNavigateToStudio?: () => void;
  onNavigateToStage?: (stage: number) => void;
}

export const VerifierPortalView: React.FC<VerifierPortalViewProps> = ({
  initialPackage,
  onNavigateToStudio: _onNavigateToStudio,
  onNavigateToStage,
}) => {
  const [activePkg, setActivePkg] = useState<ZeroaraAuditPackage | null>(initialPackage || null);
  const [report, setReport] = useState<VerifierAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [tamperMode, setTamperMode] = useState<TamperMode>('NONE');
  const [copiedSeal, setCopiedSeal] = useState(false);
  const [uploadedPdfName, setUploadedPdfName] = useState<string | null>(null);
  const [uploadedPdfBytes, setUploadedPdfBytes] = useState<Uint8Array | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialPackage) {
      setActivePkg(initialPackage);
      setTamperMode('NONE');
      executeAudit(initialPackage, uploadedPdfBytes);
    }
  }, [initialPackage]);

  const handlePackageUpload = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: ZeroaraAuditPackage = JSON.parse(text);
      // Proof-backed packages carry a ZK proof; seal-only packages (identity docs)
      // are valid with just the master audit seal + sanitized document.
      if (!parsed.masterAuditSeal || !parsed.sanitizedDocument) {
        alert('Invalid Zeroara Audit Package: Missing master audit seal.');
        return;
      }
      setActivePkg(parsed);
      setTamperMode('NONE');
      executeAudit(parsed, uploadedPdfBytes);
    } catch {
      alert('Error parsing Zeroara audit package JSON.');
    }
  };

  const handlePdfUpload = async (file: File) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    setUploadedPdfName(file.name);
    setUploadedPdfBytes(bytes);
    if (activePkg) {
      executeAudit(activePkg, bytes);
    }
  };

  const executeAudit = async (pkg: ZeroaraAuditPackage, pdfBytes?: Uint8Array) => {
    setIsAuditing(true);
    try {
      const auditResult = await runEnterpriseAudit(pkg, pdfBytes);
      setReport(auditResult);
    } finally {
      setIsAuditing(false);
    }
  };

  const applyTamper = (mode: TamperMode) => {
    if (!activePkg) return;
    setTamperMode(mode);
    const tampered = createTamperedPackage(activePkg, mode);
    executeAudit(tampered, uploadedPdfBytes);
  };

  const handleDownloadReceipt = () => {
    if (!report || !activePkg) return;
    const cert = {
      title: 'Zeroara Enterprise Cryptographic Audit Receipt',
      auditTimestamp: report.auditTimestamp,
      overallValid: report.overallValid,
      packageMetadata: report.packageMetadata,
      gates: report.gates,
      verifierEnvironment: 'Client-Side WebAssembly In-Browser Enclave',
      confidentialBytesDisclosed: 0,
    };
    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Zeroara_Audit_Certificate_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handlePackageUpload(e.target.files[0])}
        accept=".json"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={pdfInputRef}
        onChange={(e) => e.target.files?.[0] && handlePdfUpload(e.target.files[0])}
        accept=".pdf"
        style={{ display: 'none' }}
      />

      {/* Main Split-Pane */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: '20px', alignItems: 'stretch' }}>
        {/* Left Column: Package Ingest & Tamper Sandbox */}
        <div className="neu-card" style={{ width: '100%', padding: '22px', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: 'var(--accent)' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.96rem' }}>
                Audit Package Intake & Sandbox
              </span>
            </div>
            {activePkg && (
              <span className="neu-hash-pill" style={{ color: report?.overallValid ? 'var(--accent-secondary)' : 'var(--accent)', fontWeight: 700 }}>
                {report?.overallValid ? 'STATUS: ALL 5 GATES PASSED' : 'STATUS: INTEGRITY BREACH'}
              </span>
            )}
          </div>

          {!activePkg ? (
            /* Upload Dropzone */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="neu-dropzone"
              style={{ minHeight: '360px' }}
            >
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-extruded)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <UploadCloud size={32} />
              </div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 }}>
                  Upload Zeroara Audit Package (.json)
                </h4>
                <p style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', marginTop: '6px', maxWidth: '380px' }}>
                  Select an unforgeable JSON bundle generated by Layer 5 to conduct an independent verification pass.
                </p>
              </div>
              <button
                type="button"
                className="neu-btn-primary"
                style={{ fontSize: '0.84rem', padding: '10px 20px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Browse Audit JSON Package
              </button>
            </div>
          ) : (
            /* Package Details and Tamper Testing */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Package Summary Well */}
              <div className="neu-well" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>
                    ACTIVE AUDIT TARGET:
                  </span>
                  <span className="neu-hash-pill">
                    {activePkg.sourceDocument.fileName}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                  <div>Requester: <strong>{activePkg.enterpriseRequirement.requesterName}</strong></div>
                  <div>Predicate: <strong>{activePkg.enterpriseRequirement.predicate}</strong></div>
                  <div>Target Field: <strong>{activePkg.enterpriseRequirement.targetField}</strong></div>
                  <div>Threshold: <strong>≥ {activePkg.enterpriseRequirement.thresholdValue.toLocaleString()} {activePkg.enterpriseRequirement.currency}</strong></div>
                  <div>Burned Zones: <strong>{activePkg.sanitizedDocument.burnedBoundingBoxes.length} Coordinates</strong></div>
                  <div>Text Streams: <strong>{activePkg.sanitizedDocument.textStreamsDetected} (Stripped)</strong></div>
                </div>
              </div>

              {/* Master Seal Hex Display */}
              <div className="neu-well" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                    PACKAGE MASTER AUDIT SEAL:
                  </span>
                  <button
                    type="button"
                    className="neu-pill-btn"
                    style={{ fontSize: '0.7rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(activePkg.masterAuditSeal.sealHex);
                      setCopiedSeal(true);
                      setTimeout(() => setCopiedSeal(false), 2000);
                    }}
                  >
                    {copiedSeal ? <Check size={12} color="var(--accent-secondary)" /> : <Copy size={12} />}
                    <span>{copiedSeal ? 'Copied' : 'Copy Seal'}</span>
                  </button>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    color: 'var(--fg-primary)',
                    backgroundColor: 'var(--bg-surface)',
                    boxShadow: 'var(--shadow-inset-sm)',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    wordBreak: 'break-all',
                  }}
                >
                  {activePkg.masterAuditSeal.sealHex}
                </div>
              </div>

              {/* Optional PDF Matching Intake */}
              <div className="neu-well" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileCheck size={15} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
                      Optional: Verify Sanitized PDF File
                    </span>
                  </div>
                  {uploadedPdfName && (
                    <span className="neu-claim-badge" style={{ color: 'var(--accent-secondary)' }}>
                      {uploadedPdfName}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--fg-muted)' }}>
                  Upload the burned PDF file to independently confirm that its raw bytes yield the exact hash H(Doc_Redacted) recorded in the audit seal.
                </p>
                <button
                  type="button"
                  className="neu-btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '8px 14px', gap: '6px', alignSelf: 'flex-start' }}
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <UploadCloud size={13} />
                  <span>{uploadedPdfName ? 'Replace Sanitized PDF' : 'Upload Sanitized PDF (.pdf)'}</span>
                </button>
              </div>

              {/* Interactive Tamper Resistance Simulator Sandbox */}
              <div className="neu-well" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
                      Tamper Resistance Simulation Suite
                    </span>
                  </div>
                  <span className="neu-claim-badge">
                    ATTACK BENCHMARK
                  </span>
                </div>

                <p style={{ fontSize: '0.76rem', color: 'var(--fg-muted)', lineHeight: '1.4' }}>
                  Trigger deliberate attacks to prove that any manipulation of coordinates, proof points, or document bytes causes instant mathematical rejection.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className="neu-pill-btn"
                    style={{
                      fontSize: '0.72rem',
                      padding: '8px 10px',
                      color: tamperMode === 'GEOMETRY_SHIFT' ? 'var(--accent)' : 'var(--fg-muted)',
                      boxShadow: tamperMode === 'GEOMETRY_SHIFT' ? 'var(--shadow-inset)' : 'var(--shadow-extruded-sm)',
                    }}
                    onClick={() => applyTamper('GEOMETRY_SHIFT')}
                  >
                    Shift 1-px Bounding Box
                  </button>

                  <button
                    type="button"
                    className="neu-pill-btn"
                    style={{
                      fontSize: '0.72rem',
                      padding: '8px 10px',
                      color: tamperMode === 'PROOF_MUTATION' ? 'var(--accent)' : 'var(--fg-muted)',
                      boxShadow: tamperMode === 'PROOF_MUTATION' ? 'var(--shadow-inset)' : 'var(--shadow-extruded-sm)',
                    }}
                    onClick={() => applyTamper('PROOF_MUTATION')}
                  >
                    Mutate zk-SNARK Proof
                  </button>

                  <button
                    type="button"
                    className="neu-pill-btn"
                    style={{
                      fontSize: '0.72rem',
                      padding: '8px 10px',
                      color: tamperMode === 'DOCUMENT_HASH_CORRUPTION' ? 'var(--accent)' : 'var(--fg-muted)',
                      boxShadow: tamperMode === 'DOCUMENT_HASH_CORRUPTION' ? 'var(--shadow-inset)' : 'var(--shadow-extruded-sm)',
                    }}
                    onClick={() => applyTamper('DOCUMENT_HASH_CORRUPTION')}
                  >
                    Corrupt Document Preimage
                  </button>

                  <button
                    type="button"
                    className="neu-pill-btn"
                    style={{
                      fontSize: '0.72rem',
                      padding: '8px 10px',
                      color: tamperMode === 'NONE' ? 'var(--accent-secondary)' : 'var(--fg-muted)',
                      boxShadow: tamperMode === 'NONE' ? 'var(--shadow-inset)' : 'var(--shadow-extruded-sm)',
                      fontWeight: 700,
                    }}
                    onClick={() => applyTamper('NONE')}
                  >
                    Reset (Genuine Package)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: 5-Gate Live Cryptographic Audit Report */}
        <div className="neu-card" style={{ width: '100%', padding: '22px', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} style={{ color: report?.overallValid ? 'var(--accent-secondary)' : 'var(--accent)' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.96rem' }}>
                5-Gate Cryptographic Audit Verification
              </span>
            </div>
            {report && (
              <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                Evaluated in {report.totalDurationMs}ms
              </span>
            )}
          </div>

          {isAuditing ? (
            <div className="neu-well" style={{ padding: '32px', textAlign: 'center', color: 'var(--accent)', fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Executing 5-Gate Mathematical Cryptographic Audit...</span>
            </div>
          ) : !report ? (
            <div className="neu-well" style={{ padding: '32px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.84rem' }}>
              Upload an audit package on the left to trigger the automated 5-gate cryptographic audit pass.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Overall Verdict Banner */}
              <div
                className="neu-well"
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: report.overallValid ? 'var(--shadow-inset)' : 'var(--shadow-inset)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {report.overallValid ? (
                    <CheckCircle2 size={22} color="var(--accent-secondary)" />
                  ) : (
                    <XCircle size={22} color="var(--accent)" />
                  )}
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.94rem', color: report.overallValid ? 'var(--accent-secondary)' : 'var(--accent)' }}>
                      {report.overallValid ? 'PACKAGE VERIFIED SOUND & UNTAMPERED' : 'AUDIT REJECTED: CRYPTOGRAPHIC INTEGRITY COMPROMISED'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)' }}>
                      {report.overallValid
                        ? 'All 5 mathematical gates satisfied. Zero knowledge of confidential data disclosed.'
                        : 'At least one mathematical constraint or seal factor failed verification.'}
                    </div>
                  </div>
                </div>
                <span className="neu-claim-badge" style={{ color: report.overallValid ? 'var(--accent-secondary)' : 'var(--accent)' }}>
                  {report.overallValid ? '100% SOUND' : 'INVALID'}
                </span>
              </div>

              {/* 5 Gates Detail List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {report.gates.map((gate) => (
                  <div
                    key={gate.gateNumber}
                    className="neu-well"
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {gate.passed ? (
                          <CheckCircle2 size={16} color="var(--accent-secondary)" />
                        ) : (
                          <XCircle size={16} color="var(--accent)" />
                        )}
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
                          Gate {gate.gateNumber}: {gate.gateName}
                        </span>
                      </div>
                      <span
                        className="neu-hash-pill"
                        style={{
                          color: gate.passed ? 'var(--accent-secondary)' : 'var(--accent)',
                          fontWeight: 700,
                        }}
                      >
                        {gate.passed ? 'PASSED' : 'FAILED'} ({gate.latencyMs}ms)
                      </span>
                    </div>

                    <p style={{ fontSize: '0.76rem', color: 'var(--fg-muted)', lineHeight: '1.4' }}>
                      {gate.details}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginTop: '2px' }}>
                      <span>Expected: <strong style={{ color: 'var(--fg-primary)' }}>{gate.expectedValue}</strong></span>
                      <span>Actual: <strong style={{ color: gate.passed ? 'var(--accent-secondary)' : 'var(--accent)' }}>{gate.actualValue}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Privacy Metrics Callout */}
              <div className="neu-verified-well">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--accent-secondary)', fontWeight: 700 }}>
                  <Fingerprint size={16} />
                  <span>Confidential Data Disclosed to Verifier: 0 BYTES (TRUE ZERO-KNOWLEDGE)</span>
                </div>
                <span className="neu-claim-badge" style={{ color: 'var(--accent-secondary)' }}>
                  AIR-GAPPED PROOF
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="neu-btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '0.88rem', gap: '8px' }}
                  onClick={handleDownloadReceipt}
                  disabled={!report}
                >
                  <Download size={16} />
                  <span>Export Cryptographic Compliance Certificate (.json)</span>
                </button>

                {onNavigateToStage && (
                  <button
                    type="button"
                    className="neu-btn-secondary"
                    style={{ width: '100%', padding: '11px', fontSize: '0.84rem', gap: '8px', color: 'var(--accent)' }}
                    onClick={() => onNavigateToStage(7)}
                  >
                    <span>Next</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
