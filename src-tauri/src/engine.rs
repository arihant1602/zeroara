use crate::crypto::{
    compute_commitment, compute_load_bearing_seal, generate_salt, prove_claim, sha256_hex,
    verify_proof,
};
use crate::types::{
    BoundingBox, DocumentTemplate, LoadBearingRedaction, PredicateType, ProvableRedactionBundle,
    RedactionTargetInput, VerificationCheck, VerificationReport, VisualCoordinates,
};
use chrono::Utc;
use uuid::Uuid;

pub struct RedactionEngine;

impl RedactionEngine {
    pub fn get_sample_templates() -> Vec<DocumentTemplate> {
        vec![
            DocumentTemplate {
                id: "tmpl_investor_cert".to_string(),
                title: "Accredited Investor Verification Certificate".to_string(),
                category: "Finance & Securities".to_string(),
                description: "SEC Rule 506(c) verification proving net worth and income thresholds without exposing tax numbers or bank balances.".to_string(),
                content: r#"CONFIDENTIAL ACCREDITED INVESTOR VERIFICATION
Issuer: Apex Distributed Ventures LP
Target Entity: Zeroara Protocol Round A
Date of Examination: 2026-08-14

Investor Legal Name: Alexandra Vance
Social Security Number: 459-00-8812
Tax Residency: United States of America
Primary Asset Custody: Goldman Sachs Wealth Management

FINANCIAL ASSESSMENT:
1. Verified Individual Net Worth: $2,850,000 USD (Excluding primary residence)
2. 2-Year Trailing Net Income: $340,000 USD
3. Liquidity Ratio: 4.2x requirements

I hereby certify under penalty of perjury that the undersigned satisfies the definitions of an Accredited Investor as set forth in Rule 501 of Regulation D."#.to_string(),
                suggested_redactions: vec![
                    RedactionTargetInput {
                        id: "red_ssn".to_string(),
                        label: "Social Security Number".to_string(),
                        raw_value: "459-00-8812".to_string(),
                        char_start: 172,
                        char_end: 183,
                        line_number: 6,
                        predicate: PredicateType::FormatCompliant {
                            standard: "SSN".to_string(),
                        },
                        visual_coords: Some(VisualCoordinates {
                            x: 185.0,
                            y: 142.0,
                            width: 120.0,
                            height: 18.0,
                            page: 1,
                        }),
                    },
                    RedactionTargetInput {
                        id: "red_net_worth".to_string(),
                        label: "Individual Net Worth".to_string(),
                        raw_value: "$2,850,000".to_string(),
                        char_start: 356,
                        char_end: 366,
                        line_number: 11,
                        predicate: PredicateType::GreaterOrEqual {
                            threshold: 1000000.0,
                            unit: Some("USD".to_string()),
                        },
                        visual_coords: Some(VisualCoordinates {
                            x: 235.0,
                            y: 228.0,
                            width: 110.0,
                            height: 18.0,
                            page: 1,
                        }),
                    },
                    RedactionTargetInput {
                        id: "red_income".to_string(),
                        label: "2-Year Trailing Income".to_string(),
                        raw_value: "$340,000".to_string(),
                        char_start: 432,
                        char_end: 440,
                        line_number: 12,
                        predicate: PredicateType::GreaterOrEqual {
                            threshold: 200000.0,
                            unit: Some("USD".to_string()),
                        },
                        visual_coords: Some(VisualCoordinates {
                            x: 225.0,
                            y: 250.0,
                            width: 95.0,
                            height: 18.0,
                            page: 1,
                        }),
                    },
                    RedactionTargetInput {
                        id: "red_residency".to_string(),
                        label: "Tax Residency".to_string(),
                        raw_value: "United States of America".to_string(),
                        char_start: 200,
                        char_end: 224,
                        line_number: 7,
                        predicate: PredicateType::SetMembership {
                            allowed_values: vec![
                                "United States of America".to_string(),
                                "Canada".to_string(),
                                "United Kingdom".to_string(),
                                "European Union".to_string(),
                            ],
                        },
                        visual_coords: Some(VisualCoordinates {
                            x: 165.0,
                            y: 164.0,
                            width: 190.0,
                            height: 18.0,
                            page: 1,
                        }),
                    },
                ],
            },
            DocumentTemplate {
                id: "tmpl_employment_offer".to_string(),
                title: "Executive Compensation & Security Clearance".to_string(),
                category: "Employment & Payroll".to_string(),
                description: "Proves senior salary bracket and background check clearance while burning exact numbers and investigator IDs.".to_string(),
                content: r#"EXECUTIVE ENGAGEMENT MEMORANDUM
Organization: Orbital Cybernetics Corp
Candidate: Dr. Maya Lin
Role: Principal Cryptographic Engineer

COMPENSATION TERMS:
1. Base Annual Salary: $295,000 USD payable semi-monthly
2. Guaranteed Sign-on Equity: 45,000 RSUs vesting over 4 years
3. Clearance Assessment: Level-4 Top Secret (SCI Eligible)
4. Background Audit Ref: BG-99201-CLEAR

This offer is contingent upon successful confirmation of eligibility standards."#.to_string(),
                suggested_redactions: vec![
                    RedactionTargetInput {
                        id: "red_salary".to_string(),
                        label: "Base Annual Salary".to_string(),
                        raw_value: "$295,000".to_string(),
                        char_start: 167,
                        char_end: 175,
                        line_number: 6,
                        predicate: PredicateType::GreaterOrEqual {
                            threshold: 180000.0,
                            unit: Some("USD".to_string()),
                        },
                        visual_coords: Some(VisualCoordinates {
                            x: 170.0,
                            y: 130.0,
                            width: 90.0,
                            height: 18.0,
                            page: 1,
                        }),
                    },
                    RedactionTargetInput {
                        id: "red_clearance".to_string(),
                        label: "Security Clearance Level".to_string(),
                        raw_value: "Level-4 Top Secret (SCI Eligible)".to_string(),
                        char_start: 282,
                        char_end: 315,
                        line_number: 8,
                        predicate: PredicateType::SetMembership {
                            allowed_values: vec![
                                "Level-3 Secret".to_string(),
                                "Level-4 Top Secret (SCI Eligible)".to_string(),
                                "Level-5 Q Clearance".to_string(),
                            ],
                        },
                        visual_coords: Some(VisualCoordinates {
                            x: 200.0,
                            y: 175.0,
                            width: 210.0,
                            height: 18.0,
                            page: 1,
                        }),
                    },
                ],
            },
        ]
    }

    /// Burns PII and produces the cryptographically bound Provable Redaction Bundle inside the Secure Memory Region
    pub fn burn_and_prove(
        document_title: String,
        raw_content: String,
        targets: Vec<RedactionTargetInput>,
        challenge_nonce: Option<String>,
    ) -> Result<ProvableRedactionBundle, String> {
        // Ingest into RAM-locked SecureMemoryRegion (prevents swap to disk, prevents coredumps)
        let secure_mem = crate::enclave::SecureMemoryRegion::new(raw_content.as_bytes());
        let original_document_hash = sha256_hex(secure_mem.as_bytes());
        let bundle_id = format!("zr-{}", Uuid::new_v4().to_string()[..8].to_string());

        let mut load_bearing_redactions = Vec::new();
        let mut burned_content = raw_content.clone();

        // Sort targets by descending char_start so replacements don't invalidate offsets
        let mut sorted_targets = targets;
        sorted_targets.sort_by(|a, b| b.char_start.cmp(&a.char_start));

        for target in sorted_targets {
            let salt = generate_salt();
            let commitment = compute_commitment(&target.raw_value, &salt, &target.id);

            // Generate ZK proof
            let proof = prove_claim(&target.raw_value, &target.predicate, &commitment, &target.id)?;

            let bbox = BoundingBox {
                id: target.id.clone(),
                label: target.label.clone(),
                char_start: target.char_start,
                char_end: target.char_end,
                line_number: target.line_number,
                visual_coords: target.visual_coords,
            };

            let seal = compute_load_bearing_seal(
                &original_document_hash,
                &bbox,
                &commitment,
                &proof.proof_hex,
            );

            let human_readable_predicate = match &target.predicate {
                PredicateType::GreaterOrEqual { threshold, unit } => {
                    format!(">= {} {}", threshold, unit.as_deref().unwrap_or(""))
                }
                PredicateType::LessOrEqual { threshold, unit } => {
                    format!("<= {} {}", threshold, unit.as_deref().unwrap_or(""))
                }
                PredicateType::SetMembership { allowed_values } => {
                    format!("in [{}]", allowed_values.join(", "))
                }
                PredicateType::FormatCompliant { standard } => {
                    format!("valid {} format", standard)
                }
                PredicateType::KnowledgeOfPreimage => "verified preimage possession".to_string(),
            };

            let short_seal = &seal[..8];
            let burned_tag = format!("█[ZEROARA-PROOF:{} | {}]█", short_seal, human_readable_predicate);

            // Burn the text if raw_value appears or at substring
            if burned_content.contains(&target.raw_value) {
                burned_content = burned_content.replacen(&target.raw_value, &burned_tag, 1);
            }

            load_bearing_redactions.push(LoadBearingRedaction {
                box_id: target.id,
                label: target.label,
                burned_text_tag: burned_tag,
                bounding_box: bbox,
                commitment,
                predicate: target.predicate,
                predicate_human_readable: human_readable_predicate,
                proof,
                load_bearing_seal: seal,
            });
        }

        let redacted_document_hash = sha256_hex(burned_content.as_bytes());

        let master_preimage = format!(
            "zeroara:master:v1:bundle:{}:orig:{}:redacted:{}:count:{}",
            bundle_id,
            original_document_hash,
            redacted_document_hash,
            load_bearing_redactions.len()
        );
        let master_audit_seal = sha256_hex(master_preimage.as_bytes());

        let nonce = challenge_nonce.unwrap_or_else(|| "0xlocal_enclave_default_nonce".to_string());
        let hardware_attestation = Some(crate::enclave::LinuxEnclaveManager::generate_attestation(
            &master_audit_seal,
            &nonce,
        ));

        let client_env = if secure_mem.is_ram_locked() {
            "Zeroara Hardware-Attested Linux Enclave (RAM-Locked + Non-Dumpable)".to_string()
        } else {
            "Zeroara Protected Enclave (RAM Isolation Active)".to_string()
        };

        Ok(ProvableRedactionBundle {
            bundle_id,
            document_title,
            original_document_hash,
            redacted_document_hash,
            redacted_content: burned_content,
            redactions: load_bearing_redactions,
            master_audit_seal,
            created_at: Utc::now().to_rfc3339(),
            client_environment: client_env,
            hardware_attestation,
        })
    }

    /// Verifies that the document, visual redactions, and ZK proofs are cryptographically consistent
    pub fn verify_bundle(bundle: &ProvableRedactionBundle) -> VerificationReport {
        let mut checks = Vec::new();
        let mut all_passed = true;

        // Check 1: Document Integrity Hash
        let computed_redacted_hash = sha256_hex(bundle.redacted_content.as_bytes());
        let hash_matches = computed_redacted_hash == bundle.redacted_document_hash;
        if !hash_matches {
            all_passed = false;
        }
        checks.push(VerificationCheck {
            step: "Redacted Document Integrity Check".to_string(),
            passed: hash_matches,
            details: if hash_matches {
                "Document body matches cryptographic hash. No unauthorized tampering detected.".to_string()
            } else {
                "CRITICAL: Document content hash mismatch! Redacted document has been altered.".to_string()
            },
            cryptographic_digest: computed_redacted_hash,
        });

        // Check 2: Master Audit Seal Verification
        let expected_master = format!(
            "zeroara:master:v1:bundle:{}:orig:{}:redacted:{}:count:{}",
            bundle.bundle_id,
            bundle.original_document_hash,
            bundle.redacted_document_hash,
            bundle.redactions.len()
        );
        let computed_master_seal = sha256_hex(expected_master.as_bytes());
        let master_seal_valid = computed_master_seal == bundle.master_audit_seal;
        if !master_seal_valid {
            all_passed = false;
        }
        checks.push(VerificationCheck {
            step: "Master Load-Bearing Audit Seal".to_string(),
            passed: master_seal_valid,
            details: if master_seal_valid {
                "Master audit seal binds all individual redaction proofs to the document root.".to_string()
            } else {
                "Master audit seal failed cryptographic signature verification.".to_string()
            },
            cryptographic_digest: computed_master_seal,
        });

        // Check 3: Individual Load-Bearing Redactions & ZK Proofs
        for redaction in &bundle.redactions {
            // Verify visual tag appears in document
            let tag_in_content = bundle.redacted_content.contains(&redaction.burned_text_tag);
            if !tag_in_content {
                all_passed = false;
                checks.push(VerificationCheck {
                    step: format!("Visual Black-Box Anchoring ({})", redaction.label),
                    passed: false,
                    details: format!(
                        "Burned tag '{}' was missing or displaced in document text.",
                        redaction.burned_text_tag
                    ),
                    cryptographic_digest: redaction.load_bearing_seal.clone(),
                });
                continue;
            }

            // Verify ZK Proof
            let proof_valid = verify_proof(&redaction.proof, &redaction.predicate);
            if !proof_valid {
                all_passed = false;
            }
            checks.push(VerificationCheck {
                step: format!("ZK Claim Verification ({})", redaction.label),
                passed: proof_valid,
                details: if proof_valid {
                    format!(
                        "Zero-knowledge proof satisfies claim '{}' without exposing secret. Commitment: {}...",
                        redaction.predicate_human_readable,
                        &redaction.commitment[..16]
                    )
                } else {
                    format!(
                        "ZK proof verification failed for claim '{}'",
                        redaction.predicate_human_readable
                    )
                },
                cryptographic_digest: redaction.proof.proof_hex.clone(),
            });

            // Verify Load-Bearing Seal
            let expected_seal = compute_load_bearing_seal(
                &bundle.original_document_hash,
                &redaction.bounding_box,
                &redaction.commitment,
                &redaction.proof.proof_hex,
            );
            let seal_valid = expected_seal == redaction.load_bearing_seal;
            if !seal_valid {
                all_passed = false;
            }
            checks.push(VerificationCheck {
                step: format!("Load-Bearing Cryptographic Seal ({})", redaction.label),
                passed: seal_valid,
                details: if seal_valid {
                    format!(
                        "Black-box geometry and document hash are mathematically bound to the proof."
                    )
                } else {
                    format!(
                        "Load-bearing seal broken! Redaction coordinates or commitment mismatch."
                    )
                },
                cryptographic_digest: expected_seal,
            });
        }

        // Check 4: Hardware Enclave Attestation
        if let Some(attest) = &bundle.hardware_attestation {
            let attest_valid = crate::enclave::LinuxEnclaveManager::verify_attestation(attest, &bundle.master_audit_seal);
            if !attest_valid {
                all_passed = false;
            }
            checks.push(VerificationCheck {
                step: format!("Hardware Enclave Attestation ({})", attest.tpm_status),
                passed: attest_valid,
                details: if attest_valid {
                    format!(
                        "Hardware Root-of-Trust signature verified. Hardware Device: {}, Nonce: {}, RAM Protection: {}",
                        attest.hardware_device_id, attest.challenge_nonce, attest.memory_isolation
                    )
                } else {
                    "Hardware attestation signature mismatch or seal compromised!".to_string()
                },
                cryptographic_digest: attest.hardware_signature.clone(),
            });
        }

        VerificationReport {
            bundle_id: bundle.bundle_id.clone(),
            document_title: bundle.document_title.clone(),
            is_valid: all_passed,
            total_redactions: bundle.redactions.len(),
            checks,
            audit_seal_valid: master_seal_valid,
            message: if all_passed {
                "PROVABLE REDACTION VERIFIED: All burned black boxes contain mathematically valid claims anchored to the unredacted document."
                    .to_string()
            } else {
                "VERIFICATION FAILED: Cryptographic inconsistencies or document tampering detected."
                    .to_string()
            },
            timestamp: Utc::now().to_rfc3339(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_burn_and_verify_provable_redaction() {
        let templates = RedactionEngine::get_sample_templates();
        let tmpl = &templates[0];

        let bundle = RedactionEngine::burn_and_prove(
            tmpl.title.clone(),
            tmpl.content.clone(),
            tmpl.suggested_redactions.clone(),
            None,
        )
        .expect("Burn and prove failed");

        assert_eq!(bundle.redactions.len(), tmpl.suggested_redactions.len());
        assert!(!bundle.redacted_content.contains("459-00-8812")); // SSN must be burned!

        // Verify valid bundle
        let report = RedactionEngine::verify_bundle(&bundle);
        assert!(report.is_valid);
        assert!(report.audit_seal_valid);
    }

    #[test]
    fn test_detect_tampered_document() {
        let templates = RedactionEngine::get_sample_templates();
        let tmpl = &templates[0];

        let mut bundle = RedactionEngine::burn_and_prove(
            tmpl.title.clone(),
            tmpl.content.clone(),
            tmpl.suggested_redactions.clone(),
            None,
        )
        .expect("Burn and prove failed");

        // Tamper with redacted content
        bundle.redacted_content.push_str(" Unauthorized modification");

        let report = RedactionEngine::verify_bundle(&bundle);
        assert!(!report.is_valid, "Tampered document must fail verification!");
    }
}

