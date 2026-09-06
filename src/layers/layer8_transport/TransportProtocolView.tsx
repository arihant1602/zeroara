import React, { useState } from 'react';
import { Network, Radio, ExternalLink, ArrowLeft } from 'lucide-react';

interface TransportProtocolViewProps {
  onBackToStudio?: () => void;
}

export const TransportProtocolView: React.FC<TransportProtocolViewProps> = ({ onBackToStudio }) => {
  const [simulatedOrigin, setSimulatedOrigin] = useState('https://apex-lending.io');
  const [threshold, setThreshold] = useState(150000);
  const [generatedUri, setGeneratedUri] = useState('');

  const handleGenerateUri = () => {
    const payload = {
      requestId: `req_${Date.now()}`,
      requesterName: 'Apex Lending & Capital Markets',
      requesterOrigin: simulatedOrigin,
      targetField: 'Annual Income Attestation',
      predicate: '>=',
      thresholdValue: threshold,
      currency: 'USD',
      challengeNonce: '0x' + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join(''),
      callbackUrl: `${simulatedOrigin}/api/kyc/callback`,
    };
    const b64 = btoa(JSON.stringify(payload));
    setGeneratedUri(`zeroara://verify?request=${b64}`);
  };

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
              <Network size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
                  LAYER 8: WEB-TO-DESKTOP TRANSPORT & DEEP LINK PROTOCOL
                </h2>
                <span className="neu-badge">UNDER CONSTRUCTION · TARGET v0.4</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginTop: '2px' }}>
                Secure bi-directional deep linking (<code className="mono">zeroara://verify</code>) and local loopback IPC for web verification.
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
          <Radio size={38} />
        </div>

        <div style={{ maxWidth: '560px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
            Web-to-Desktop Transport Protocol Scaffolded
          </h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--fg-muted)', lineHeight: '1.6', marginTop: '8px' }}>
            This layer defines how external websites (KYC portals, exchanges, loan application forms) invoke the local Zeroara desktop app without ever handling raw documents. Target milestone: <strong>v0.4</strong>.
          </p>
        </div>

        {/* Interactive Handshake URI Simulator */}
        <div className="neu-well" style={{ maxWidth: '860px', width: '100%', padding: '20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--fg-primary)' }}>
              Simulate External Website Verification Request
            </span>
            <span className="neu-claim-badge">PROTOCOL SPECIFICATION</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', display: 'block', marginBottom: '4px' }}>
                Requester Website Domain
              </label>
              <input
                type="text"
                className="neu-input"
                value={simulatedOrigin}
                onChange={(e) => setSimulatedOrigin(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.8rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', display: 'block', marginBottom: '4px' }}>
                Required Threshold ($ USD)
              </label>
              <input
                type="number"
                className="neu-input"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                style={{ padding: '8px 12px', fontSize: '0.8rem' }}
              />
            </div>
          </div>

          <button
            type="button"
            className="neu-btn-primary"
            style={{ fontSize: '0.82rem', padding: '10px 16px', gap: '6px', alignSelf: 'flex-start' }}
            onClick={handleGenerateUri}
          >
            <ExternalLink size={13} />
            <span>Generate zeroara:// Deep-Link URI</span>
          </button>

          {generatedUri && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                Synthesized Deep-Link Scheme:
              </span>
              <div className="neu-code-block" style={{ fontSize: '0.74rem', maxHeight: '100px', overflowY: 'auto' }}>
                {generatedUri}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
