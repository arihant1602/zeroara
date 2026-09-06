import React from 'react';
import { Cpu, Lock, ArrowLeft } from 'lucide-react';

interface HardwareEnclaveViewProps {
  onBackToStudio?: () => void;
}

export const HardwareEnclaveView: React.FC<HardwareEnclaveViewProps> = ({ onBackToStudio }) => {
  return (
    <div className="view-container" style={{ maxWidth: '1200px', gap: '24px' }}>
      {/* Header Card */}
      <div className="neu-card" style={{ padding: '28px', borderRadius: '32px', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                boxShadow: 'var(--shadow-inset)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
              }}
            >
              <Cpu size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
                  LAYER 7: HARDWARE ATTESTATION & OS ENCLAVE BINDING
                </h2>
                <span className="neu-badge">UNDER CONSTRUCTION · TARGET v0.3</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginTop: '2px' }}>
                Physical TPM 2.0 and Apple Secure Enclave hardware root key signing with volatile RAM locking (mlock).
              </p>
            </div>
          </div>

          {onBackToStudio && (
            <button
              type="button"
              className="neu-btn-secondary"
              style={{ fontSize: '0.82rem', padding: '8px 16px', gap: '6px' }}
              onClick={onBackToStudio}
            >
              <ArrowLeft size={14} />
              <span>Back to Studio</span>
            </button>
          )}
        </div>
      </div>

      {/* Blank Section Placeholder Card */}
      <div className="neu-card" style={{ padding: '48px 32px', borderRadius: '32px', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
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
      </div>
    </div>
  );
};
