import { Groth16ProofPoints } from '../layer4_zk/types';

export interface MasterSealResult {
  sealHex: string;
  preimage: string;
  docRedactedHash: string;
  bboxSummary: string;
  commitment: string;
  proofDigest: string;
}

export interface ZeroaraAuditPackage {
  protocol: 'Zeroara Provable Redaction Protocol';
  version: '1.0.0';
  generatedAt: string;
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
  enterpriseRequirement: {
    requesterName: string;
    purpose: string;
    targetField: string;
    predicate: string;
    thresholdValue: number;
    currency: string;
    challengeNonce: string;
  };
  zeroKnowledgeProof: {
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
