export interface EnclaveDiagnostics {
  platform: 'Linux' | 'macOS' | 'Windows' | 'Browser (Simulated)';
  hardwareEnclaveAvailable: boolean;
  tpmChipDetected: boolean;
  tpmVersion?: string;
  appleSecureEnclaveDetected: boolean;
  ramLockSupported: boolean;
  madviseDontDumpSupported: boolean;
  hardwareDeviceKeyDerivation: boolean;
}

export interface HardwareAttestationReport {
  enclaveType: string;
  attestationSignatureHex: string;
  devicePublicKeyHex: string;
  tpmPcrs?: Record<string, string>;
  timestamp: string;
  isSimulated: boolean;
}
