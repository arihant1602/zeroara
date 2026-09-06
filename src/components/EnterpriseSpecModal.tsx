import React, { useState } from 'react';
import { EnterprisePolicy } from '../hooks/usePipeline';
import { Building2, X, RefreshCw, CheckCircle2 } from 'lucide-react';

interface EnterpriseSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: EnterprisePolicy;
  onSavePolicy: (policy: EnterprisePolicy) => void;
}

export const EnterpriseSpecModal: React.FC<EnterpriseSpecModalProps> = ({
  isOpen,
  onClose,
  policy,
  onSavePolicy,
}) => {
  const [formData, setFormData] = useState<EnterprisePolicy>({ ...policy });

  if (!isOpen) return null;

  const presets = [
    {
      name: 'SEC Rule 506(c) ($100k)',
      requester: 'Apex Distributed Ventures LP',
      purpose: 'SEC Rule 506(c) Accredited Investor Verification',
      threshold: 100000,
    },
    {
      name: 'Senior Exec Salary ($150k)',
      requester: 'Orbital Cybernetics Corp',
      purpose: 'Principal Level Compensation Clearance',
      threshold: 150000,
    },
    {
      name: 'Mortgage Solvency ($80k)',
      requester: 'First Horizon Underwriting Ltd',
      purpose: 'Mortgage Debt-to-Income Solvency Check',
      threshold: 80000,
    },
  ];

  const applyPreset = (p: typeof presets[0]) => {
    setFormData((prev) => ({
      ...prev,
      requesterName: p.requester,
      purpose: p.purpose,
      thresholdValue: p.threshold,
    }));
  };

  const regenerateNonce = () => {
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    let hex = '0x';
    arr.forEach((b) => (hex += b.toString(16).padStart(2, '0')));
    setFormData((prev) => ({ ...prev, challengeNonce: hex }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePolicy(formData);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(224, 229, 236, 0.8)',
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
          maxWidth: '560px',
          width: '100%',
          padding: '30px',
          borderRadius: '32px',
          boxShadow: 'var(--shadow-extruded-hover)',
          position: 'relative',
          gap: '18px',
        }}
      >
        {/* Header with Close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                boxShadow: 'var(--shadow-extruded-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 }}>
                Enterprise Verification Simulator
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--fg-muted)' }}>
                Configure what condition the external verifier requires you to prove.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--fg-muted)',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Presets */}
        <div>
          <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', marginBottom: '8px' }}>
            SELECT VERIFICATION PRESET:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {presets.map((p) => (
              <button
                key={p.name}
                type="button"
                className="neu-pill-btn"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 12px',
                  backgroundColor: formData.thresholdValue === p.threshold ? 'var(--bg-surface)' : 'transparent',
                  color: formData.thresholdValue === p.threshold ? 'var(--accent)' : 'var(--fg-muted)',
                  boxShadow: formData.thresholdValue === p.threshold ? 'var(--shadow-inset-sm)' : 'var(--shadow-extruded-sm)',
                  fontWeight: formData.thresholdValue === p.threshold ? 700 : 500,
                }}
                onClick={() => applyPreset(p)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--fg-primary)', display: 'block', marginBottom: '6px' }}>
              Enterprise Requester Name
            </label>
            <input
              type="text"
              className="neu-input"
              value={formData.requesterName}
              onChange={(e) => setFormData({ ...formData, requesterName: e.target.value })}
              placeholder="e.g. Apex Distributed Ventures LP"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--fg-primary)', display: 'block', marginBottom: '6px' }}>
              Verification Purpose / Standard
            </label>
            <input
              type="text"
              className="neu-input"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="e.g. SEC Rule 506(c) Accredited Investor Exemption"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--fg-primary)', display: 'block', marginBottom: '6px' }}>
                Predicate Condition
              </label>
              <div className="neu-well" style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)' }}>
                actualValue &gt;= threshold
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--fg-primary)', display: 'block', marginBottom: '6px' }}>
                Required Threshold ($ USD)
              </label>
              <input
                type="number"
                step="5000"
                min="1000"
                className="neu-input"
                value={formData.thresholdValue}
                onChange={(e) => setFormData({ ...formData, thresholdValue: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
                Verifier Challenge Nonce (Entropy Binding)
              </label>
              <button
                type="button"
                onClick={regenerateNonce}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                }}
              >
                <RefreshCw size={12} />
                <span>Regenerate</span>
              </button>
            </div>
            <input
              type="text"
              className="neu-input"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}
              value={formData.challengeNonce}
              onChange={(e) => setFormData({ ...formData, challengeNonce: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              className="neu-btn-secondary"
              onClick={onClose}
              style={{ flex: 1, padding: '12px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="neu-btn-primary"
              style={{ flex: 1, padding: '12px', gap: '6px' }}
            >
              <CheckCircle2 size={16} />
              <span>Apply Enterprise Spec</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
