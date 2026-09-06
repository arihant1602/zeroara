import { useState, useEffect } from 'react';
import {
  DocumentTemplate,
  ProvableRedactionBundle,
  RedactionTargetInput,
} from '../types';
import { fetchSampleDocuments, burnAndProve } from '../services/tauriClient';

interface StudioViewProps {
  onBundleGenerated: (bundle: ProvableRedactionBundle) => void;
  onNavigateToVerifier: () => void;
  activeBundle: ProvableRedactionBundle | null;
}

export const StudioView: React.FC<StudioViewProps> = ({
  onBundleGenerated,
  onNavigateToVerifier,
  activeBundle,
}) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  const [targets, setTargets] = useState<RedactionTargetInput[]>([]);
  const [isBurning, setIsBurning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSampleDocuments().then((docs) => {
      setTemplates(docs);
      if (docs.length > 0) {
        selectTemplate(docs[0]);
      }
    });
  }, []);

  const selectTemplate = (tmpl: DocumentTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setDocTitle(tmpl.title);
    setDocContent(tmpl.content);
    setTargets(JSON.parse(JSON.stringify(tmpl.suggested_redactions)));
    setErrorMsg(null);
  };

  const handleBurn = async () => {
    if (!docContent.trim() || targets.length === 0) return;
    setIsBurning(true);
    setErrorMsg(null);
    try {
      const bundle = await burnAndProve(docTitle, docContent, targets);
      onBundleGenerated(bundle);
    } catch (err: any) {
      console.error('Failed to burn provable redactions:', err);
      setErrorMsg(err.toString());
    } finally {
      setIsBurning(false);
    }
  };

  const copyBundleJson = () => {
    if (!activeBundle) return;
    navigator.clipboard.writeText(JSON.stringify(activeBundle, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="view-container">
      {/* Template Selector Pill Bar */}
      <div className="neu-card" style={{ padding: '14px 20px', borderRadius: '24px', flexDirection: 'row', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)' }}>
          SOURCE PRESETS:
        </span>
        {templates.map((tmpl) => (
          <button
            key={tmpl.id}
            className={`neu-pill-btn ${selectedTemplateId === tmpl.id ? 'active' : ''}`}
            onClick={() => selectTemplate(tmpl)}
          >
            {tmpl.title}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-inset-sm)',
            borderRadius: 'var(--radius-btn)',
            color: 'var(--accent-rose)',
            fontSize: '0.86rem',
            fontWeight: 600,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* 2-Column Redaction Canvas */}
      <div className="neu-grid-2col">
        {/* Left Column: Original Document & Bounding Targets */}
        <div className="neu-card">
          <div className="neu-card-header">
            <div className="neu-card-title">
              Local Source Document &amp; PII Targets
            </div>
            <span className="neu-hash-pill">
              {targets.length} TARGETS BOUND
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
                Local Content (Never Exfiltrated)
              </div>
              <textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                className="neu-textarea"
                style={{ height: '200px' }}
                placeholder="Source text..."
              />
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
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Target Coordinates &amp; Mathematical Claims</span>
                <span className="mono" style={{ color: 'var(--accent)' }}>Unified Witness Binding</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {targets.map((tgt, i) => (
                  <div key={tgt.id} className="neu-target-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--fg-primary)' }}>
                        Target #{i + 1}: {tgt.label}
                      </span>
                      <span className="neu-claim-badge">
                        {'GreaterOrEqual' in (tgt.predicate as any)
                          ? `Claim: >= ${(tgt.predicate as any).GreaterOrEqual.threshold.toLocaleString()} ${(tgt.predicate as any).GreaterOrEqual.unit || ''}`
                          : 'SetMembership' in (tgt.predicate as any)
                          ? `Claim: in allowed set (${(tgt.predicate as any).SetMembership.allowed_values.length} items)`
                          : 'FormatCompliant' in (tgt.predicate as any)
                          ? `Claim: valid ${(tgt.predicate as any).FormatCompliant.standard} format`
                          : 'Claim: Preimage proof'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--fg-muted)' }}>Raw Value:</span>
                      <span className="neu-secret-badge">{tgt.raw_value}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--fg-dim)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                        Line {tgt.line_number}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="neu-btn-primary"
              onClick={handleBurn}
              disabled={isBurning || targets.length === 0}
              style={{ marginTop: 'auto' }}
            >
              {isBurning ? 'Executing Local ZK Computation & Burning...' : 'Burn Load-Bearing Redactions'}
            </button>
          </div>
        </div>

        {/* Right Column: Burned & Sealed Output */}
        <div className="neu-card">
          <div className="neu-card-header">
            <div className="neu-card-title">
              Provably Redacted Output &amp; Seals
            </div>
            {activeBundle && (
              <span className="neu-hash-pill">BUNDLE: {activeBundle.bundle_id}</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
            {activeBundle ? (
              <>
                <div
                  style={{
                    padding: '14px 18px',
                    backgroundColor: 'var(--bg-surface)',
                    boxShadow: 'var(--shadow-inset-sm)',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
                      Redaction Seals Computed
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)' }}>
                      {activeBundle.redactions.length} visual black boxes bound to PLONK receipts
                    </div>
                  </div>

                  <button className="neu-btn-secondary" onClick={copyBundleJson} style={{ padding: '6px 14px' }}>
                    {copied ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>

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
                    Burned Document Body (Text)
                  </div>
                  <div className="neu-well-deep mono" style={{ minHeight: '200px', fontSize: '0.84rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {activeBundle.redacted_content}
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
                    Cryptographic Load-Bearing Seals
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeBundle.redactions.map((r) => (
                      <div key={r.box_id} className="neu-target-card" style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--fg-primary)', fontSize: '0.84rem' }}>
                            {r.label}
                          </span>
                          <span className="neu-claim-badge">
                            {r.predicate_human_readable}
                          </span>
                        </div>
                        <div style={{ color: 'var(--fg-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                          Commitment: {r.commitment.substring(0, 24)}...
                        </div>
                        <div style={{ color: 'var(--fg-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                          Load Seal: {r.load_bearing_seal.substring(0, 28)}...
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                  <button
                    className="neu-btn-secondary"
                    onClick={onNavigateToVerifier}
                    style={{ width: '100%', padding: '14px', color: 'var(--accent)', fontWeight: 700 }}
                  >
                    Send Bundle to Audit Verifier
                  </button>
                </div>
              </>
            ) : (
              <div
                className="neu-well-deep"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '40px 20px',
                  gap: '12px',
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--fg-primary)', fontSize: '1rem' }}>
                  Awaiting Local Redaction Run
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', maxWidth: '340px', lineHeight: '1.6' }}>
                  Select a document on the left and click &quot;Burn Load-Bearing Redactions&quot;.
                  The black boxes and ZK proofs will be calculated locally.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
