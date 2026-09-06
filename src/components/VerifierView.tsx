import { useState, useEffect } from 'react';
import { ProvableRedactionBundle, VerificationReport } from '../types';
import { verifyBundle, tamperBundleTest } from '../services/tauriClient';

interface VerifierViewProps {
  initialBundle: ProvableRedactionBundle | null;
}

export const VerifierView: React.FC<VerifierViewProps> = ({ initialBundle }) => {
  const [bundle, setBundle] = useState<ProvableRedactionBundle | null>(initialBundle);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [activeTamper, setActiveTamper] = useState<string | null>(null);

  useEffect(() => {
    if (initialBundle) {
      setBundle(initialBundle);
      runVerification(initialBundle);
    }
  }, [initialBundle]);

  const runVerification = async (targetBundle: ProvableRedactionBundle) => {
    setIsVerifying(true);
    try {
      const res = await verifyBundle(targetBundle);
      setReport(res);
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTamper = async (
    tamperType: 'tamper_content' | 'tamper_proof' | 'tamper_seal' | 'tamper_hw'
  ) => {
    if (!bundle) return;
    setActiveTamper(tamperType);
    const tampered = await tamperBundleTest(bundle, tamperType);
    setBundle(tampered);
    await runVerification(tampered);
  };

  const handleReset = () => {
    if (!initialBundle) return;
    setActiveTamper(null);
    setBundle(initialBundle);
    runVerification(initialBundle);
  };

  if (!bundle) {
    return (
      <div
        className="neu-card"
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '60px 40px',
        }}
      >
        <div style={{ maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="handshake-step-num" style={{ margin: '0 auto' }}>AWAITING BUNDLE</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
            No Redaction Bundle Loaded
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--fg-muted)', lineHeight: '1.6' }}>
            Run a redaction in the <strong>Protocol Overview</strong> or <strong>Redaction Studio</strong> tab
            to generate an audit-sealed bundle for mathematical verification.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Top Controller Bar & Tamper Test Lab */}
      <div
        className="neu-card"
        style={{
          padding: '16px 24px',
          borderRadius: '24px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.94rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
            Auditing: {bundle.document_title}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
            Master Seal: {bundle.master_audit_seal.substring(0, 26)}...
          </div>
        </div>

        {/* Cryptographic Tamper Simulator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
            Tamper Resistance Suite:
          </span>

          <button
            onClick={() => handleTamper('tamper_content')}
            className={`neu-pill-btn ${activeTamper === 'tamper_content' ? 'active' : ''}`}
            style={activeTamper === 'tamper_content' ? { color: 'var(--accent-rose)' } : {}}
          >
            Alter Body
          </button>

          <button
            onClick={() => handleTamper('tamper_proof')}
            className={`neu-pill-btn ${activeTamper === 'tamper_proof' ? 'active' : ''}`}
            style={activeTamper === 'tamper_proof' ? { color: 'var(--accent-rose)' } : {}}
          >
            Forge ZK Proof
          </button>

          <button
            onClick={() => handleTamper('tamper_seal')}
            className={`neu-pill-btn ${activeTamper === 'tamper_seal' ? 'active' : ''}`}
            style={activeTamper === 'tamper_seal' ? { color: 'var(--accent-rose)' } : {}}
          >
            Break Load Seal
          </button>

          <button
            onClick={() => handleTamper('tamper_hw')}
            className={`neu-pill-btn ${activeTamper === 'tamper_hw' ? 'active' : ''}`}
            style={activeTamper === 'tamper_hw' ? { color: 'var(--accent-rose)' } : {}}
          >
            Forge HW Sig
          </button>

          <button
            onClick={handleReset}
            className="neu-pill-btn"
            style={{ color: 'var(--accent-secondary)' }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Verification Grid */}
      <div className="neu-grid-2col">
        {/* Verification Report & Cryptographic Checks */}
        <div className="neu-card">
          <div className="neu-card-header">
            <div className="neu-card-title">
              Independent Cryptographic Auditor
            </div>
            <button
              onClick={() => runVerification(bundle)}
              disabled={isVerifying}
              className="neu-btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            >
              Re-Verify
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
            {report && (
              <>
                <div
                  className="neu-well"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    borderColor: report.is_valid ? 'transparent' : 'var(--accent-rose)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.96rem',
                      fontWeight: 800,
                      color: report.is_valid ? 'var(--accent-secondary)' : 'var(--accent-rose)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    STATUS: {report.is_valid ? 'LOAD-BEARING REDACTION CONFIRMED' : 'INTEGRITY BREACH / TAMPERING DETECTED'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
                    {report.message}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: 'var(--fg-muted)',
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Step-by-Step Gate Execution ({report.checks.length} Checks)
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {report.checks.map((c, idx) => (
                      <div key={idx} className="neu-check-row">
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
                              {c.step}
                            </span>
                            <span
                              className="mono"
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: c.passed ? 'var(--accent-secondary)' : 'var(--accent-rose)',
                              }}
                            >
                              [{c.passed ? 'PASSED' : 'REJECTED'}]
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: '3px' }}>
                            {c.details}
                          </div>
                          <div
                            style={{
                              marginTop: '6px',
                              fontSize: '0.72rem',
                              color: 'var(--fg-dim)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            Digest: {c.cryptographic_digest.substring(0, 36)}...
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Redacted Document & Load-Bearing Inspection */}
        <div className="neu-card">
          <div className="neu-card-header">
            <div className="neu-card-title">
              Content &amp; Receipts Under Audit
            </div>
            <span className="neu-hash-pill">
              SHA256: {bundle.redacted_document_hash.substring(0, 16)}...
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
            <div>
              <div
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: 'var(--fg-muted)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Presented Redacted Content
              </div>
              <div className="neu-well-deep mono" style={{ minHeight: '220px', fontSize: '0.82rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {bundle.redacted_content}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: 'var(--fg-muted)',
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Proof Receipts
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bundle.redactions.map((r) => (
                  <div key={r.box_id} className="neu-target-card" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>{r.label}</span>
                      <span className="neu-claim-badge">
                        {r.proof.proof_system}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '0.72rem',
                        color: 'var(--fg-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Proof: {r.proof.proof_hex.substring(0, 36)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {bundle.hardware_attestation && (
              <div>
                <div
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: 'var(--fg-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Hardware Enclave Attestation Report
                </div>

                <div className="neu-target-card" style={{ padding: '14px 18px', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>
                      {bundle.hardware_attestation.tpm_status}
                    </span>
                    <span className="neu-claim-badge">
                      {bundle.hardware_attestation.platform_arch.split('/')[0].trim()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                    Device ID: {bundle.hardware_attestation.hardware_device_id}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                    Memory: {bundle.hardware_attestation.memory_isolation}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    Signature: {bundle.hardware_attestation.hardware_signature.substring(0, 36)}...
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
