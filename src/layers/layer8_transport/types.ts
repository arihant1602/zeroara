export interface VerificationRequestPayload {
  requestId: string;
  requesterName: string;
  requesterOrigin: string;
  targetField: string;
  predicate: string;
  thresholdValue: number;
  currency: string;
  challengeNonce: string;
  callbackUrl?: string;
}

export interface TransportState {
  isListening: boolean;
  port: number;
  protocolScheme: 'zeroara://';
  activeSessions: number;
}
