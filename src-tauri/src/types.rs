use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PredicateType {
    /// Value must be greater than or equal to threshold (e.g. income >= $150,000)
    GreaterOrEqual { threshold: f64, unit: Option<String> },
    /// Value must be less than or equal to threshold (e.g. debt <= $10,000)
    LessOrEqual { threshold: f64, unit: Option<String> },
    /// Value must be in an allowed set (e.g. country in [US, CA, UK])
    SetMembership { allowed_values: Vec<String> },
    /// Format matches specific pattern (e.g. SSN, National ID, Email)
    FormatCompliant { standard: String },
    /// Knowledge of secret pre-image matching cryptographic commitment
    KnowledgeOfPreimage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub id: String,
    pub label: String,
    pub char_start: usize,
    pub char_end: usize,
    pub line_number: usize,
    pub visual_coords: Option<VisualCoordinates>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualCoordinates {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub page: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionTargetInput {
    pub id: String,
    pub label: String,
    pub raw_value: String,
    pub char_start: usize,
    pub char_end: usize,
    pub line_number: usize,
    pub predicate: PredicateType,
    pub visual_coords: Option<VisualCoordinates>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZkProofArtifact {
    pub proof_id: String,
    pub proof_system: String,
    pub curve_or_hash_engine: String,
    pub commitment: String,
    pub public_inputs: Vec<String>,
    pub proof_hex: String,
    pub verified_at_burn: bool,
    pub generation_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadBearingRedaction {
    pub box_id: String,
    pub label: String,
    pub burned_text_tag: String,
    pub bounding_box: BoundingBox,
    pub commitment: String,
    pub predicate: PredicateType,
    pub predicate_human_readable: String,
    pub proof: ZkProofArtifact,
    pub load_bearing_seal: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvableRedactionBundle {
    pub bundle_id: String,
    pub document_title: String,
    pub original_document_hash: String,
    pub redacted_document_hash: String,
    pub redacted_content: String,
    pub redactions: Vec<LoadBearingRedaction>,
    pub master_audit_seal: String,
    pub created_at: String,
    pub client_environment: String,
    pub hardware_attestation: Option<crate::enclave::HardwareAttestationReport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentTemplate {
    pub id: String,
    pub title: String,
    pub category: String,
    pub description: String,
    pub content: String,
    pub suggested_redactions: Vec<RedactionTargetInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationCheck {
    pub step: String,
    pub passed: bool,
    pub details: String,
    pub cryptographic_digest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationReport {
    pub bundle_id: String,
    pub document_title: String,
    pub is_valid: bool,
    pub total_redactions: usize,
    pub checks: Vec<VerificationCheck>,
    pub audit_seal_valid: bool,
    pub message: String,
    pub timestamp: String,
}
