/**
 * Zeroara Protocol Facade:
 * Re-exports from dedicated layer modules in src/layers/.
 * 
 * Layer 1: src/layers/layer1_ingest/ (Ingest & SHA-256 Preimage)
 * Layer 2: src/layers/layer2_ocr/ (OCR Spatial & Target Geometry)
 * Layer 3: src/layers/layer3_burn/ (Physical Pixel Burn & Raster Flattening)
 * Layer 4: src/layers/layer4_zk/ (Groth16 ZK Prover & Blinding)
 * Layer 5: src/layers/layer5_seal/ (Quad-Factor Master Audit Seal)
 * Layer 6: src/layers/layer6_verifier/ (Enterprise Verifier Portal)
 * Layer 7: src/layers/layer7_enclave/ (Hardware Enclave / TPM 2.0)
 * Layer 8: src/layers/layer8_transport/ (Web-to-Desktop Transport)
 */

export * from '../layers';

export interface BoundingBoxCoords {
  id: string;
  label: string;
  field: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}
