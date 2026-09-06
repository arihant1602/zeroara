import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';

interface HardwareEnclaveViewProps {
  onBackToStudio?: () => void;
  onNavigateToStage?: (stage: number) => void;
}

export const HardwareEnclaveView: React.FC<HardwareEnclaveViewProps> = ({
  onNavigateToStage,
}) => {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Blank Section Placeholder Card */}
      <div className="neu-card" style={{ padding: '40px 32px', borderRadius: '28px', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-extruded)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}
        >
          <Lock size={38} />
        </div>

        <div style={{ maxWidth: '560px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
            Hardware Enclave Subsystem Scaffolded
          </h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--fg-muted)', lineHeight: '1.6', marginTop: '8px' }}>
            This layer is implemented natively in <strong>Rust (Tauri 2)</strong> inside <code className="mono">src-tauri/src/enclave.rs</code> for desktop builds. The browser WebAssembly client-side bridge is scheduled for Milestone v0.3.
          </p>
        </div>

        {/* Feature Checklist */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', width: '100%', maxWidth: '860px', textAlign: 'left', marginTop: '12px' }}>
          <div className="neu-well" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)' }}>
              PLANNED CAPABILITY 1
            </span>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>POSIX mlock RAM Pinning</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
              Locks document memory pages against disk swapping and excludes buffers from core dumps (<code className="mono">MADV_DONTDUMP</code>).
            </p>
          </div>

          <div className="neu-well" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)' }}>
              PLANNED CAPABILITY 2
            </span>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>TPM 2.0 Hardware Signing</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
              Binds the Layer 5 Master Audit Seal and enterprise challenge nonce with a device-bound key stored in the physical TPM chip.
            </p>
          </div>

          <div className="neu-well" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)' }}>
              PLANNED CAPABILITY 3
            </span>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Apple Secure Enclave (SEP)</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
              macOS biometric and hardware key derivation using Apple Secure Enclave processor (<code className="mono">kSecAttrTokenIDSecureEnclave</code>).
            </p>
          </div>
        </div>

        <div className="neu-code-block" style={{ maxWidth: '860px', width: '100%', textAlign: 'left' }}>
          <code>// src/layers/layer7_enclave/README.md & src-tauri/src/enclave.rs contain developer specifications.</code>
        </div>

        {onNavigateToStage && (
          <button
            type="button"
            className="neu-btn-primary"
            style={{ padding: '12px 28px', fontSize: '0.86rem', gap: '8px', marginTop: '8px' }}
            onClick={() => onNavigateToStage(8)}
          >
            <span>Next</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
