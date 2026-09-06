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

export type TargetAction = 'PROVE_AND_BURN' | 'DIRECT_BURN';
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
