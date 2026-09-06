pub mod crypto;
pub mod enclave;
pub mod engine;
pub mod types;

use enclave::{EnclaveDiagnostics, EnclaveLiveDiagnosticRun, LinuxEnclaveManager};
use engine::RedactionEngine;
use types::{DocumentTemplate, ProvableRedactionBundle, RedactionTargetInput, VerificationReport};

#[tauri::command]
fn get_sample_documents() -> Vec<DocumentTemplate> {
    RedactionEngine::get_sample_templates()
}

#[tauri::command]
fn get_enclave_diagnostics() -> EnclaveDiagnostics {
    LinuxEnclaveManager::detect_hardware()
}

#[tauri::command]
fn run_live_enclave_benchmark() -> EnclaveLiveDiagnosticRun {
    LinuxEnclaveManager::run_live_benchmark()
}

#[tauri::command]
fn burn_and_prove(
    document_title: String,
    raw_content: String,
    targets: Vec<RedactionTargetInput>,
    challenge_nonce: Option<String>,
) -> Result<ProvableRedactionBundle, String> {
    RedactionEngine::burn_and_prove(document_title, raw_content, targets, challenge_nonce)
}

#[tauri::command]
fn verify_bundle(bundle: ProvableRedactionBundle) -> VerificationReport {
    RedactionEngine::verify_bundle(&bundle)
}

#[tauri::command]
fn tamper_bundle_test(
    mut bundle: ProvableRedactionBundle,
    tamper_type: String,
) -> ProvableRedactionBundle {
    match tamper_type.as_str() {
        "tamper_content" => {
            bundle.redacted_content.push_str(" [TAMPERED_INJECTION]");
        }
        "tamper_proof" => {
            if let Some(r) = bundle.redactions.first_mut() {
                r.proof.proof_hex = "0x01zk_forged_proof_signature_mismatch00000000".to_string();
            }
        }
        "tamper_seal" => {
            if let Some(r) = bundle.redactions.first_mut() {
                r.load_bearing_seal = "0000000000000000000000000000000000000000".to_string();
            }
        }
        "tamper_hw" => {
            if let Some(attest) = &mut bundle.hardware_attestation {
                attest.hardware_signature = "0xhw_forged_signature_corrupted00000000".to_string();
                attest.attested_seal_digest = "0000000000000000000000000000000000000000".to_string();
            }
        }
        _ => {}
    }
    bundle
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_sample_documents,
            get_enclave_diagnostics,
            run_live_enclave_benchmark,
            burn_and_prove,
            verify_bundle,
            tamper_bundle_test
        ])
        .run(tauri::generate_context!())
        .expect("error while running Zeroara application");
}
