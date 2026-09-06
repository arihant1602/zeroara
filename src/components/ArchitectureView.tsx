export const ArchitectureView: React.FC = () => {
  return (
    <div className="view-container">
      {/* Spec Hero */}
      <div className="neu-card" style={{ padding: '32px 36px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span className="handshake-step-num">SPECIFICATION</span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--fg-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Cryptographic Load-Bearing Mechanism
          </h1>
          <p style={{ fontSize: '0.94rem', color: 'var(--fg-muted)', lineHeight: '1.6' }}>
            Traditional redaction is non-verifiable: a black box proves only that information was erased.
            Zeroara renders the redaction load-bearing by mathematically coupling the visual box to a zero-knowledge proof
            derived from the exact same local computation pass.
          </p>
        </div>
      </div>

      {/* Structural Comparison */}
      <div className="neu-grid-2col">
        <div className="neu-card">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-rose)', marginBottom: '16px' }}>
            TRADITIONAL REDACTION
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.86rem', color: 'var(--fg-muted)' }}>
            <div>
              <strong style={{ color: 'var(--fg-primary)' }}>Epistemically Empty:</strong> Receivers cannot verify whether hidden data meets regulatory or contractual conditions.
            </div>
            <div>
              <strong style={{ color: 'var(--fg-primary)' }}>Unlinked Proofs:</strong> If a separate ZK proof is sent, no mathematical tie proves the proof belongs to that specific document text.
            </div>
            <div>
              <strong style={{ color: 'var(--fg-primary)' }}>Silent Forgery:</strong> Attackers can paint black boxes over manufactured text without tripping any integrity checks.
            </div>
          </div>
        </div>

        <div className="neu-card">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '16px' }}>
            ZEROARA PROVABLE REDACTION
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.86rem', color: 'var(--fg-muted)' }}>
            <div>
              <strong style={{ color: 'var(--fg-primary)' }}>Unified Local Pass:</strong> The exact same execution that burns the visual black box evaluates the witness and generates the proof.
            </div>
            <div>
              <strong style={{ color: 'var(--fg-primary)' }}>Load-Bearing Seal:</strong> Visual bounding box coordinates, document hash, and proof receipt form a single atomic hash.
            </div>
            <div>
              <strong style={{ color: 'var(--fg-primary)' }}>Tamper Breakage:</strong> Shifting the black box by 1 pixel or changing 1 character of document text invalidates the master seal.
            </div>
          </div>
        </div>
      </div>

      {/* Mathematical Pipeline Equations */}
      <div className="neu-card" style={{ padding: '32px 36px' }}>
        <div className="neu-card-header">
          <div className="neu-card-title">
            Cryptographic Pipeline Formulations
          </div>
          <span className="neu-hash-pill">ALGORITHM DEFINITION</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div className="neu-target-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              01. Blinding Commitment
            </div>
            <div className="neu-well mono" style={{ fontSize: '0.84rem', margin: '12px 0', color: 'var(--fg-primary)', padding: '12px' }}>
              C = SHA256(salt ‖ box_id ‖ secret)
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', lineHeight: '1.6' }}>
              Each sensitive PII field is blinded with a 256-bit cryptographically secure pseudorandom salt.
            </p>
          </div>

          <div className="neu-target-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              02. Zero-Knowledge Prover
            </div>
            <div className="neu-well mono" style={{ fontSize: '0.84rem', margin: '12px 0', color: 'var(--fg-primary)', padding: '12px' }}>
              π = Prove_ZK(w, C, predicate)
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', lineHeight: '1.6' }}>
              Fiat-Shamir challenge-response PLONK transcript evaluates range or set membership without leaking secret w.
            </p>
          </div>

          <div className="neu-target-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              03. Load-Bearing Binding Seal
            </div>
            <div className="neu-well mono" style={{ fontSize: '0.84rem', margin: '12px 0', color: 'var(--fg-primary)', padding: '12px' }}>
              Seal = SHA256(H_doc ‖ BoundingBox ‖ C ‖ π)
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', lineHeight: '1.6' }}>
              Mathematically anchors the visual redaction mark directly into the document root and proof transcript.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
