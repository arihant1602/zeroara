export interface RedactionResult {
  redactedPdfBytes: Uint8Array;
  redactedHashHex: string;
  chunkedHash: string;
  textStreamCount: number;
  burnedZonesCount: number;
  durationMs: number;
  flattenedPngDataUrl: string;
  fileSizeBytes: number;
}
