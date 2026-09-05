export type PredicateType =
  | { GreaterOrEqual: { threshold: number; unit?: string } }
  | { LessOrEqual: { threshold: number; unit?: string } }
  | { SetMembership: { allowed_values: string[] } }
  | { FormatCompliant: { standard: string } }
  | 'KnowledgeOfPreimage';

export interface VisualCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface BoundingBox {
  id: string;
  label: string;
  char_start: number;
  char_end: number;
  line_number: number;
  visual_coords?: VisualCoordinates;
}

export interface RedactionTargetInput {
  id: string;
  label: string;
  raw_value: string;
  char_start: number;
  char_end: number;
  line_number: number;
  predicate: PredicateType;
  visual_coords?: VisualCoordinates;
}

export interface ZkProofArtifact {
  proof_id: string;
  proof_system: string;
  curve_or_hash_engine: string;
  commitment: string;
  public_inputs: string[];
  proof_hex: string;
  verified_at_burn: boolean;
  generation_time_ms: number;
}

export interface LoadBearingRedaction {
  box_id: string;
  label: string;
  burned_text_tag: string;
  bounding_box: BoundingBox;
  commitment: string;
  predicate: PredicateType;
  predicate_human_readable: string;
  proof: ZkProofArtifact;
  load_bearing_seal: string;
}

export interface HardwareAttestationReport {
  enclave_type: string;
  platform_arch: string;
  hardware_device_id: string;
  tpm_status: string;
  memory_isolation: string;
  network_isolated: boolean;
  challenge_nonce: string;
  attested_seal_digest: string;
  hardware_signature: string;
  timestamp: string;
}

export interface EnclaveLiveDiagnosticRun {
  allocated_bytes: number;
  memory_address_hex: string;
  mlock_active: boolean;
  madv_dontdump_active: boolean;
  tpm_version: string;
  cpu_virtualization: string;
  signature_generation_us: number;
  zeroization_confirmed: boolean;
  test_timestamp: string;
}

export interface EnclaveDiagnostics {
  platform: string;
  kernel_version: string;
  cpu_virtualization: string;
  hardware_tpm_version?: string;
  kvm_accessible: boolean;
  sandboxing_engine: string;
  memory_protection_level: string;
  hardware_device_id: string;
}

export interface ProvableRedactionBundle {
  bundle_id: string;
  document_title: string;
  original_document_hash: string;
  redacted_document_hash: string;
  redacted_content: string;
  redactions: LoadBearingRedaction[];
  master_audit_seal: string;
  created_at: string;
  client_environment: string;
  hardware_attestation?: HardwareAttestationReport;
}

export interface DocumentTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
  suggested_redactions: RedactionTargetInput[];
}

export interface VerificationCheck {
  step: string;
  passed: boolean;
  details: string;
  cryptographic_digest: string;
}

export interface VerificationReport {
  bundle_id: string;
  document_title: string;
  is_valid: boolean;
  total_redactions: number;
  checks: VerificationCheck[];
  audit_seal_valid: boolean;
  message: string;
  timestamp: string;
}
