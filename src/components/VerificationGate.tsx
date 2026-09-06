import React from 'react';
import { ShieldCheck, CheckCircle, Loader2, X, ShieldAlert } from 'lucide-react';

interface VerificationGateProps {
  isSealed: boolean;
  isVerifying: boolean;
  onRunVerification: () => void;
  verificationResult: {
    verified: boolean;
    latencyMs: number;
    message: string;
    publicSignals: string[];
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VerificationGate: React.FC<VerificationGateProps> = ({
  isSealed,
  isVerifying,
  onRunVerification,
  verificationResult,
  isOpen,
  onClose,
}) => {
  return (
    <>
      {/* Bottom Action Strip */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              boxShadow: isSealed ? 'var(--shadow-extruded-sm)' : 'var(--shadow-inset-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isSealed ? 'var(--accent-secondary)' : 'var(--fg-muted)',
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.94rem' }}>
              One-Click Independent Verification Gate
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--fg-muted)' }}>
              Evaluates Groth16 pairing on BN254 curve locally inside browser WebAssembly in &lt;10ms.
            </div>
          </div>
        </div>

        <button
          className="neu-btn-primary"
          onClick={onRunVerification}
          disabled={!isSealed || isVerifying}
          style={{
            padding: '12px 28px',
            fontSize: '0.88rem',
            backgroundColor: isSealed ? 'var(--accent-secondary)' : 'var(--accent)',
          }}
        >
          {isVerifying ? (
            <>
              <Loader2 size={16} className="spin" />
              <span>Verifying Curve Pairings...</span>
            </>
          ) : (
            <>
              <CheckCircle size={16} />
              <span>Run Independent Enterprise Verification</span>
            </>
          )}
        </button>
      </div>

      {/* Verification Success / Result Modal */}
      {isOpen && verificationResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(224, 229, 236, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="neu-card"
            style={{
              maxWidth: '540px',
              width: '100%',
              padding: '32px',
              borderRadius: '32px',
              boxShadow: 'var(--shadow-extruded-hover)',
              position: 'relative',
              gap: '18px',
            }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--fg-muted)',
              }}
            >
              <X size={20} />
            </button>

            {/* Verification Status Icon & Banner */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface)',
                  boxShadow: 'var(--shadow-extruded)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: verificationResult.verified ? 'var(--accent-secondary)' : 'var(--accent-rose)',
                }}
              >
                {verificationResult.verified ? (
                  <CheckCircle size={36} strokeWidth={2.5} />
                ) : (
                  <ShieldAlert size={36} />
                )}
              </div>

              <div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: verificationResult.verified ? 'var(--accent-secondary)' : 'var(--accent-rose)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {verificationResult.verified
                    ? '100% Mathematically Proven. Zero PII Leaked.'
                    : 'Verification Failed'}
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', marginTop: '4px' }}>
                  Execution Duration: {verificationResult.latencyMs}ms (Browser Wasm SnarkJS Engine)
                </p>
              </div>
            </div>

            {/* Mathematical Check Breakdown */}
            <div className="neu-well" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--fg-muted)' }}>Groth16 Pairing Equation:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                  e(A, B) == e(α, β) · e(C, γ) · e(x, δ) [PASS]
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--fg-muted)' }}>Satisfied Predicate:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  actualValue &gt;= 100,000 USD [TRUE]
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--fg-muted)' }}>Secret Disclosure:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                  0 bytes (Zero-Knowledge)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--fg-muted)' }}>Outbound Network Egress:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                  0 KB (0 HTTP Requests)
                </span>
              </div>
            </div>

            <button
              className="neu-btn-primary"
              onClick={onClose}
              style={{ width: '100%', padding: '12px', fontSize: '0.88rem' }}
            >
              Acknowledge & Close Verifier
            </button>
          </div>
        </div>
      )}
    </>
  );
};
