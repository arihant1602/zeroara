export interface GateResult {
  gateNumber: number;
  gateName: string;
  passed: boolean;
  expectedValue: string;
  actualValue: string;
  details: string;
  latencyMs: number;
}

export interface VerifierAuditReport {
  overallValid: boolean;
  auditTimestamp: string;
  totalDurationMs: number;
  gates: GateResult[];
  confidentialBytesDisclosed: 0;
  zeroKnowledgeSoundness: boolean;
  packageMetadata: {
    fileName: string;
    requesterName: string;
    predicate: string;
    thresholdDisplay: string;
    masterSealHex: string;
  };
}

export type TamperMode =
  | 'NONE'
  | 'GEOMETRY_SHIFT'
  | 'PROOF_MUTATION'
  | 'COMMITMENT_FORGERY'
  | 'DOCUMENT_HASH_CORRUPTION';
