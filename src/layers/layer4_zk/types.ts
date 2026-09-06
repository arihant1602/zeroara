export interface Groth16ProofPoints {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface SessionContext {
  documentDigest: string;
  requesterName: string;
  purpose: string;
  thresholdValue: number;
  challengeNonce: string;
}

export interface Groth16ProofResult {
  proof: Groth16ProofPoints;
  publicSignals: string[];
  durationMs: number;
  commitment: string;
  blindingSalt: string;
  thresholdValue: number;
  sessionBinding: string;
  verified: boolean;
  verificationLatencyMs: number;
  generatedAt: string;
  protocol: string;
  curve: string;
}
