import { VerificationRequestPayload, TransportState } from './types';

/**
 * Layer 8 Web-to-Desktop Transport Protocol:
 * (UNIMPLEMENTED IN CLIENT WEB BROWSER - TARGET MILESTONE v0.4)
 * Coordinates deep-linking (`zeroara://verify?payload=...`) and local
 * loopback WebSocket transport (127.0.0.1:8383) between third-party
 * browser websites and the native Zeroara desktop app.
 */

export function parseZeroaraDeepLink(uri: string): VerificationRequestPayload | null {
  try {
    if (!uri.startsWith('zeroara://verify')) return null;
    const url = new URL(uri.replace('zeroara://', 'http://localhost/'));
    const payloadParam = url.searchParams.get('request');
    if (!payloadParam) return null;
    const jsonString = atob(payloadParam);
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

export function getTransportState(): TransportState {
  return {
    isListening: false,
    port: 8383,
    protocolScheme: 'zeroara://',
    activeSessions: 0,
  };
}
