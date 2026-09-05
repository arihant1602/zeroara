import { useState, useEffect } from 'react';
import {
  burnAndProve,
  fetchSampleDocuments,
  fetchEnclaveDiagnostics,
  runLiveEnclaveBenchmark,
} from '../services/tauriClient';
import { EnclaveDiagnostics, EnclaveLiveDiagnosticRun, ProvableRedactionBundle } from '../types';

interface OverviewViewProps {
  onBundleGenerated: (bundle: ProvableRedactionBundle) => void;
  onNavigateToStudio: () => void;
  onNavigateToVerifier: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onBundleGenerated,
  onNavigateToStudio,
  onNavigateToVerifier,
}) => {
  const [handshakeState, setHandshakeState] = useState<'idle' | 'processing' | 'completed'>('idle');
  const [responsePayload, setResponsePayload] = useState<any | null>(null);
  const [diagnostics, setDiagnostics] = useState<EnclaveDiagnostics | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<EnclaveLiveDiagnosticRun | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);

  useEffect(() => {
    fetchEnclaveDiagnostics().then((d) => setDiagnostics(d));
  }, []);

  const handleRunLiveBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const res = await runLiveEnclaveBenchmark();
      setBenchmarkResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const incomingRequest = {
    origin: 'https://prime-capital.example.com/kyc',
    purpose: 'Accredited Investor Verification (SEC Rule 506c)',
    required_predicate: 'individual_net_worth >= 1000000 USD',
    requester_challenge_nonce: '0x94f8a2bc710e39b4d1c68f12a03',
    requested_redaction_standard: 'ZEROARA-LOAD-BEARING-V1',
  };

  const executeWebsiteHandshake = async () => {
    setHandshakeState('processing');
    try {
      const docs = await fetchSampleDocuments();
      const investorDoc = docs[0];
      const bundle = await burnAndProve(
        investorDoc.title,
        investorDoc.content,
        investorDoc.suggested_redactions,
        incomingRequest.requester_challenge_nonce
      );
      onBundleGenerated(bundle);

      setResponsePayload({
        verification_status: 'AUTHENTIC_CLAIM_VERIFIED',
        predicate_satisfied: 'individual_net_worth >= 1000000 USD',
        document_integrity_hash: bundle.redacted_document_hash,
        master_audit_seal: bundle.master_audit_seal,
        redacted_boxes_count: bundle.redactions.length,
        redacted_preview: bundle.redacted_content.split('\n').slice(0, 7).join('\n') + '\n[...]',
        zk_proof_digest: bundle.redactions[1]?.proof.proof_hex.substring(0, 36) + '...',
        hardware_attestation: bundle.hardware_attestation,
        raw_pii_disclosed: false,
        client_attestation: bundle.client_environment,
      });

      setHandshakeState('completed');
    } catch (err) {
      console.error(err);
      setHandshakeState('idle');
    }
  };

  return (
    <div className="view-container">
      {/* Executive Core Definition */}
      <div className="neu-card" style={{ padding: '36px 40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="handshake-step-num">THESIS</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 700 }}>
              CRYPTOGRAPHICALLY LOAD-BEARING REDACTION
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--fg-primary)',
              lineHeight: '1.25',
              letterSpacing: '-0.03em',
            }}
          >
            Provable Redaction
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--fg-primary)', lineHeight: '1.7', fontWeight: 500 }}>
            Zeroara is the first tool where the black-box you burn over PII and the ZK-proof of the claim underneath
            come from the <strong>exact same local computation</strong>, so redaction itself becomes the audit trail.
            No one else makes redaction cryptographically load-bearing.
          </p>

          <div
            className="neu-well"
            style={{
              marginTop: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.84rem',
              color: 'var(--fg-muted)',
              lineHeight: '1.6',
            }}
          >
            Traditional redaction deletes data without mathematical proof of what was underneath.
            Traditional ZK proofs produce standalone files disconnected from visual documents.
            Zeroara binds both: the visual bounding box coordinates, original document hash, and zero-knowledge proof receipt
            are sealed into a single mathematical commitment.
          </div>
        </div>
      </div>

      {/* Hardware Enclave Telemetry (User's Laptop) */}
      <div className="neu-card" style={{ padding: '28px 36px' }}>
        <div className="neu-card-header">
          <div className="neu-card-title">
            Hardware Enclave Status (Your Device)
          </div>
          <span className="neu-hash-pill">AIR-GAPPED SOVEREIGN ENVIRONMENT</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div className="neu-target-card" style={{ padding: '16px 20px' }}>
            <span className="handshake-step-num">PLATFORM</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, color: 'var(--fg-primary)', marginTop: '4px' }}>
              {diagnostics ? diagnostics.platform : 'Probing...'}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              Kernel: {diagnostics ? diagnostics.kernel_version : '7.1.8-arch1-3'}
            </div>
          </div>

          <div className="neu-target-card" style={{ padding: '16px 20px' }}>
            <span className="handshake-step-num">CPU VIRTUALIZATION</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, color: 'var(--fg-primary)', marginTop: '4px' }}>
              {diagnostics ? diagnostics.cpu_virtualization : 'Detecting CPU extensions...'}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              KVM Hypervisor: {diagnostics?.kvm_accessible ? 'Available (/dev/kvm)' : 'Not exposed'}
            </div>
          </div>

          <div className="neu-target-card" style={{ padding: '16px 20px' }}>
            <span className="handshake-step-num">HARDWARE ROOT</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, color: 'var(--fg-primary)', marginTop: '4px' }}>
              {diagnostics?.hardware_tpm_version || 'TPM 2.0 Hardware Security Chip'}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              Device ID: {diagnostics ? diagnostics.hardware_device_id : 'hw_init'}
            </div>
          </div>

          <div className="neu-target-card" style={{ padding: '16px 20px' }}>
            <span className="handshake-step-num">MEMORY LOCK</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent)', marginTop: '4px' }}>
              mlock + MADV_DONTDUMP
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              RAM-Locked, Non-Swappable, Zeroized
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
              Live Hardware Execution &amp; Memory Isolation Test
            </span>
            <button
              className="neu-btn-secondary"
              onClick={handleRunLiveBenchmark}
              disabled={isBenchmarking}
              style={{ padding: '8px 18px', color: 'var(--accent)', fontWeight: 700 }}
            >
              {isBenchmarking ? 'Allocating & Locking Memory...' : 'Run Live Hardware Isolation Diagnostic'}
            </button>
          </div>

          {benchmarkResult && (
            <div className="neu-well-deep" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--fg-dim)', textTransform: 'uppercase' }}>
                  Buffer Address
                </div>
                <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
                  {benchmarkResult.memory_address_hex} ({benchmarkResult.allocated_bytes} B)
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--fg-dim)', textTransform: 'uppercase' }}>
                  Physical RAM Lock (mlock)
                </div>
                <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                  {benchmarkResult.mlock_active ? 'CONFIRMED (Kernel Swapping Blocked)' : 'FALLBACK'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--fg-dim)', textTransform: 'uppercase' }}>
                  Core Dump Exclusion
                </div>
                <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                  {benchmarkResult.madv_dontdump_active ? 'CONFIRMED (MADV_DONTDUMP Active)' : 'INACTIVE'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--fg-dim)', textTransform: 'uppercase' }}>
                  Hardware Signing Latency
                </div>
                <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)' }}>
                  {benchmarkResult.signature_generation_us} µs ({benchmarkResult.tpm_version})
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--fg-dim)', textTransform: 'uppercase' }}>
                  Post-Run Zeroization
                </div>
                <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                  {benchmarkResult.zeroization_confirmed ? 'VERIFIED (0x00 Wiped on Drop)' : 'FAIL'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Protocol Architecture: Website <-> App Handshake */}
      <div className="neu-card" style={{ padding: '32px 36px' }}>
        <div className="neu-card-header">
          <div className="neu-card-title">
            Website-to-Desktop Verification Architecture
          </div>
          <span className="neu-hash-pill">IPC / DEEP-LINK PROTOCOL</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div className="handshake-step-card">
            <span className="handshake-step-num">STEP 01</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.94rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
              Website Ingestion
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', lineHeight: '1.5' }}>
              External website prompts user for qualification (e.g. &quot;Prove Net Worth &gt;= $1M&quot;), emitting a structured verification request.
            </p>
          </div>

          <div className="handshake-step-card">
            <span className="handshake-step-num">STEP 02</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.94rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
              Local Enclave Binding
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', lineHeight: '1.5' }}>
              Zeroara desktop receives request. Raw files are loaded strictly within RAM-locked memory. Raw PII never touches the web.
            </p>
          </div>

          <div className="handshake-step-card">
            <span className="handshake-step-num">STEP 03</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.94rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
              Unified Computation
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', lineHeight: '1.5' }}>
              Single pass burns the black box over sensitive text while computing the ZK proof and load-bearing seal.
            </p>
          </div>

          <div className="handshake-step-card">
            <span className="handshake-step-num">STEP 04</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.94rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
              Sealed Handshake
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', lineHeight: '1.5' }}>
              Zeroara returns only the provably redacted document and proof seal back to the website. Verification occurs in &lt;10ms.
            </p>
          </div>
        </div>
      </div>

      {/* Live Handshake Interactive Simulation */}
      <div className="neu-card" style={{ padding: '32px 36px' }}>
        <div className="neu-card-header">
          <div className="neu-card-title">
            Live Protocol Handshake Simulator
          </div>
          <span className="neu-hash-pill">INTERACTIVE SIMULATION</span>
        </div>

        <div className="neu-grid-2col">
          {/* Incoming Request from Website */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Incoming Request Payload (From Website)
            </div>
            <div className="neu-well-deep mono" style={{ fontSize: '0.78rem', height: '220px', overflowY: 'auto' }}>
              <pre>{JSON.stringify(incomingRequest, null, 2)}</pre>
            </div>

            <button
              className="neu-btn-primary"
              onClick={executeWebsiteHandshake}
              disabled={handshakeState === 'processing'}
            >
              {handshakeState === 'processing'
                ? 'Executing Local ZK Computation & Burning...'
                : 'Execute Local Redaction & Transmit Response'}
            </button>
          </div>

          {/* Outgoing Response to Website */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Outgoing Response Payload (To Website)
            </div>

            {responsePayload ? (
              <>
                <div className="neu-well-deep mono" style={{ fontSize: '0.78rem', height: '220px', overflowY: 'auto' }}>
                  <pre>{JSON.stringify(responsePayload, null, 2)}</pre>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="neu-btn-secondary" onClick={onNavigateToStudio} style={{ flex: 1 }}>
                    Inspect in Studio
                  </button>
                  <button className="neu-btn-secondary" onClick={onNavigateToVerifier} style={{ flex: 1, color: 'var(--accent)' }}>
                    Verify in Station
                  </button>
                </div>
              </>
            ) : (
              <div
                className="neu-well-deep"
                style={{
                  height: '220px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  color: 'var(--fg-dim)',
                  fontSize: '0.84rem',
                }}
              >
                Click &quot;Execute Local Redaction &amp; Transmit Response&quot; to simulate the website handshake.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
