import { Groth16ProofPoints } from '../layer4_zk/types';

export interface MasterSealResult {
  sealHex: string;
  preimage: string;
  docRedactedHash: string;
  bboxSummary: string;
  commitment: string;
  proofDigest: string;
}

// PROOF_BACKED: a numeric predicate was proven in zero knowledge (prove-and-burn).
// SEAL_ONLY: redaction is bound to the document hash + bounding boxes, but no
//            numeric ZK proof was generated (identity / non-numeric documents).
export type RedactionMode = 'PROOF_BACKED' | 'SEAL_ONLY';

export interface AuditRedactedField {
  label: string;
  classification: string;
  action: 'PROVE_AND_BURN' | 'DIRECT_BURN' | 'DETECT_ONLY';
  fieldKey?: string;
}

export interface ZeroaraAuditPackage {
  protocol: 'Zeroara Provable Redaction Protocol';
  version: '1.0.0';
  generatedAt: string;
  scenario: {
    id: string;
    label: string;
    category: string;
  };
  redactionMode: RedactionMode;
  sourceDocument: {
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    preimageSha256: string;
  };
  sanitizedDocument: {
    fileSizeBytes: number;
    preimageSha256: string;
    burnedBoundingBoxes: Array<{ id: string; label: string; x: number; y: number; width: number; height: number; page: number }>;
    textStreamsDetected: number;
  };
  redactedFields: AuditRedactedField[];
  enterpriseRequirement: {
    requesterName: string;
    purpose: string;
    documentCategory: string;
    targetField: string;
    predicate: string;
    thresholdValue: number;
    currency: string;
    challengeNonce: string;
    requiredRedactionFields: string[];
  };
  // Present only for PROOF_BACKED packages. Absent for SEAL_ONLY.
  zeroKnowledgeProof?: {
    curve: string;
    protocol: string;
    publicSignals: string[];
    proof: Groth16ProofPoints;
    poseidonCommitment: string;
    blindingSalt: string;
    sessionBinding?: string;
    verified: boolean;
    verificationLatencyMs: number;
  };
  masterAuditSeal: MasterSealResult;
}
