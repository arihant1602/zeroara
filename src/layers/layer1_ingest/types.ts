export interface IngestedDoc {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  hashHex: string;
  chunkedHash: string;
  timestamp: string;
  isSample?: boolean;
  rawBytes?: Uint8Array;
  fileObj?: File;
}

export interface IngestTelemetry {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  hashHex: string;
  latencyMs: number;
  isolatedRam: boolean;
  networkEgressBlocked: boolean;
}
