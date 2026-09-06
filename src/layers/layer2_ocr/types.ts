export interface ExtractedSpatialToken {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  confidence?: number;
}

// DIRECT_BURN: irreversible pixel redaction of a PII identifier (no proof).
// PROVE_AND_BURN: redaction + a Groth16 numeric predicate proof.
// DETECT_ONLY: located/flagged but not burned (no circuit/policy yet).
export type TargetAction = 'PROVE_AND_BURN' | 'DIRECT_BURN' | 'DETECT_ONLY';
export type TargetSource = 'OCR_AUTO' | 'MANUAL_USER';

export interface ClassifiedTarget {
  id: string;
  label: string;
  classification: string;
  extractedValue: string;
  numericValue?: number;
  satisfiesThreshold?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  action: TargetAction;
  source: TargetSource;
  confidence?: number;
  /** Scenario field key this target maps to (e.g. 'aadhaar', 'pay'). */
  fieldKey?: string;
}

export interface DocumentExtractionResult {
  tokens: ExtractedSpatialToken[];
  targets: ClassifiedTarget[];
  rawText: string;
  engineName: string;
  meanConfidence: number;
  latencyMs: number;
  width: number;
  height: number;
  numPages: number;
  usedOcrFallback: boolean;
}

export type OcrProgressFn = (percent: number, status: string) => void;
