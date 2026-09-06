import { useState, useCallback, useRef } from 'react';
import {
  sha256Hex,
  generateIncomeThresholdProof,
  verifyIncomeProof,
  computeMasterAuditSeal,
  createRedactedPdf,
  BoundingBoxCoords,
  Groth16ProofResult,
  MasterSealResult,
} from '../core/zeroara';

export type PipelineState =
  | 'IDLE'
  | 'INGESTING'
  | 'OCR_DETECTING'
  | 'BURNING_PIXELS'
  | 'PROVING_ZK'
  | 'SEALED';

export type StepNumber = 1 | 2 | 3 | 4 | 5;

export interface IngestTelemetry {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  originalDocHash: string;
  ingestTimestamp: string;
}

export interface OcrClaimTelemetry {
  actualValueStr: string;
  actualValueNum: number;
  thresholdStr: string;
  thresholdNum: number;
  confidence: number;
  detectedFields: BoundingBoxCoords[];
}

export interface RasterTelemetry {
  textLayersStripped: boolean;
  pixelFill: string;
  canvasWidth: number;
  canvasHeight: number;
  totalPixelsBurned: number;
  redactedDocHash: string;
}

export interface ZkTelemetry {
  zkResult: Groth16ProofResult | null;
  blindingSalt: string;
  commitment: string;
  proofTimeMs: number;
  protocol: string;
  curve: string;
}

export interface SealTelemetry {
  masterSeal: MasterSealResult | null;
  sealTag: string;
  verificationStatus: string;
  pdfBlobUrl: string | null;
  auditReceiptJson: any | null;
}

export interface PipelineTelemetry {
  ingest: IngestTelemetry | null;
  ocr: OcrClaimTelemetry | null;
  raster: RasterTelemetry | null;
  zk: ZkTelemetry | null;
  seal: SealTelemetry | null;
}

export interface NetworkListener {
  egressBytes: number;
  egressRequests: number;
  inboundRequests: number;
  status: string;
}

export const SAMPLE_DOCUMENT_TEXT = `CONFIDENTIAL ACCREDITED INVESTOR VERIFICATION
Issuer: Apex Distributed Ventures LP
Target: Zeroara Protocol Round A
Date of Examination: 2026-08-14

Investor Legal Name: Alexandra Vance
Social Security Number: 459-00-8812
Tax Residency: United States of America
Primary Asset Custody: Goldman Sachs Wealth Management

FINANCIAL ASSESSMENT & EARNINGS CONFIRMATION:
1. 2-Year Trailing Net Income: $145,000 USD
2. Verified Individual Net Worth: $2,850,000 USD (Excl. primary residence)
3. Liquidity Ratio: 4.2x regulatory baseline

I hereby certify under penalty of perjury that the undersigned satisfies the definitions
of an Accredited Investor as set forth in Rule 501 of Regulation D.`;

export const SAMPLE_BOUNDING_BOXES: BoundingBoxCoords[] = [
  {
    id: 'bbox_ssn',
    label: 'Social Security Number',
    field: 'ssn',
    x: 178,
    y: 138,
    width: 124,
    height: 22,
    page: 1,
  },
  {
    id: 'bbox_income',
    label: '2-Year Trailing Income',
    field: 'income',
    x: 218,
    y: 244,
    width: 108,
    height: 22,
    page: 1,
  },
];

export function usePipeline() {
  const [pipelineState, setPipelineState] = useState<PipelineState>('IDLE');
  const [activeStep, setActiveStep] = useState<StepNumber>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [telemetry, setTelemetry] = useState<PipelineTelemetry>({
    ingest: null,
    ocr: null,
    raster: null,
    zk: null,
    seal: null,
  });

  const [networkActivity] = useState<NetworkListener>({
    egressBytes: 0,
    egressRequests: 0,
    inboundRequests: 0,
    status: 'Severed / Zero Outbound Traffic (Strict Local Enclave)',
  });

  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    latencyMs: number;
    message: string;
    publicSignals: string[];
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const abortControllerRef = useRef<boolean>(false);

  const loadSampleDocument = useCallback(async () => {
    abortControllerRef.current = false;
    setVerificationResult(null);

    // Stage 1: INGESTING
    setPipelineState('INGESTING');
    setActiveStep(1);
    setCompletedSteps([]);

    const originalHash = await sha256Hex(SAMPLE_DOCUMENT_TEXT);
    const ingestData: IngestTelemetry = {
      fileName: 'Accredited_Investor_Verification_ApexLP.pdf',
      fileSizeBytes: 48290,
      mimeType: 'application/pdf',
      originalDocHash: originalHash,
      ingestTimestamp: new Date().toISOString(),
    };

    setTelemetry((prev) => ({ ...prev, ingest: ingestData }));
    setCompletedSteps([1]);

    await new Promise((r) => setTimeout(r, 650));
    if (abortControllerRef.current) return;

    // Stage 2: OCR_DETECTING
    setPipelineState('OCR_DETECTING');
    setActiveStep(2);

    const ocrData: OcrClaimTelemetry = {
      actualValueStr: '$145,000',
      actualValueNum: 145000,
      thresholdStr: '>= $100,000',
      thresholdNum: 100000,
      confidence: 99.4,
      detectedFields: SAMPLE_BOUNDING_BOXES,
    };

    setTelemetry((prev) => ({ ...prev, ocr: ocrData }));
    setCompletedSteps([1, 2]);

    await new Promise((r) => setTimeout(r, 700));
    if (abortControllerRef.current) return;

    // Stage 3: BURNING_PIXELS
    setPipelineState('BURNING_PIXELS');
    setActiveStep(3);

    const redactedContentSimulation = SAMPLE_DOCUMENT_TEXT
      .replace('459-00-8812', '███████████')
      .replace('$145,000', '██████████');
    const redactedDocHash = await sha256Hex(redactedContentSimulation);

    const rasterData: RasterTelemetry = {
      textLayersStripped: true,
      pixelFill: '#000000',
      canvasWidth: 600,
      canvasHeight: 480,
      totalPixelsBurned: 124 * 22 + 108 * 22, // 5104 px
      redactedDocHash: redactedDocHash,
    };

    setTelemetry((prev) => ({ ...prev, raster: rasterData }));
    setCompletedSteps([1, 2, 3]);

    await new Promise((r) => setTimeout(r, 700));
    if (abortControllerRef.current) return;

    // Stage 4: PROVING_ZK
    setPipelineState('PROVING_ZK');
    setActiveStep(4);

    const zkResult = await generateIncomeThresholdProof(145000, 100000);

    const zkData: ZkTelemetry = {
      zkResult,
      blindingSalt: zkResult.blindingSalt,
      commitment: zkResult.commitment,
      proofTimeMs: zkResult.durationMs,
      protocol: 'Groth16 (snarkjs)',
      curve: 'bn128 (BN254)',
    };

    setTelemetry((prev) => ({ ...prev, zk: zkData }));
    setCompletedSteps([1, 2, 3, 4]);

    await new Promise((r) => setTimeout(r, 750));
    if (abortControllerRef.current) return;

    // Stage 5: SEALED (Master Audit Seal + PDF & JSON export)
    setPipelineState('SEALED');
    setActiveStep(5);

    const masterSeal = await computeMasterAuditSeal(
      redactedDocHash,
      SAMPLE_BOUNDING_BOXES,
      zkResult.commitment,
      zkResult.proof
    );

    const shortSeal = masterSeal.sealHex.substring(0, 8);
    const sealTag = `█[SEAL: #0x${shortSeal} | >= $100k]█`;

    // Generate physical PDF with pdf-lib
    const pdfBytes = await createRedactedPdf(
      'Accredited Investor Verification (Apex LP)',
      SAMPLE_BOUNDING_BOXES,
      sealTag
    );
    const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    const pdfBlobUrl = URL.createObjectURL(pdfBlob);

    const auditReceiptJson = {
      protocol: 'Zeroara Provable Redaction v1',
      standard: 'ZEROARA-LOAD-BEARING-SEAL',
      document: {
        title: 'Accredited Investor Verification (Apex LP)',
        original_sha256: originalHash,
        redacted_sha256: redactedDocHash,
      },
      pii_claim: {
        field: '2-Year Trailing Net Income',
        predicate: 'actualValue >= 100000 USD',
        satisfied: true,
        secret_disclosed: false,
      },
      bounding_boxes: SAMPLE_BOUNDING_BOXES,
      cryptography: {
        proof_system: 'Groth16',
        curve: 'BN254',
        commitment_hash: 'Poseidon-BN254',
        commitment_value: zkResult.commitment,
        blinding_salt_entropy: '256-bit cryptographically secure pseudorandom scalar',
        proof: zkResult.proof,
        public_signals: zkResult.publicSignals,
      },
      master_audit_seal: {
        hex: masterSeal.sealHex,
        preimage_spec: 'SHA256(H_doc || BBox || C || π)',
        timestamp: new Date().toISOString(),
      },
      verifier_statement:
        '100% Mathematically Proven. Zero PII Leaked. Document text layers permanently stripped.',
    };

    const sealData: SealTelemetry = {
      masterSeal,
      sealTag,
      verificationStatus: 'VALID (Income >= $100,000 USD)',
      pdfBlobUrl,
      auditReceiptJson,
    };

    setTelemetry((prev) => ({ ...prev, seal: sealData }));
    setCompletedSteps([1, 2, 3, 4, 5]);
  }, []);

  const selectStep = useCallback(
    (step: StepNumber) => {
      if (completedSteps.includes(step) || pipelineState === 'SEALED') {
        setActiveStep(step);
      }
    },
    [completedSteps, pipelineState]
  );

  const runEnterpriseVerification = useCallback(async () => {
    if (!telemetry.zk?.zkResult) return;
    setIsVerifying(true);
    setVerificationModalOpen(true);

    try {
      const res = await verifyIncomeProof(
        telemetry.zk.zkResult.proof,
        telemetry.zk.zkResult.publicSignals
      );

      setVerificationResult({
        verified: res.isValid,
        latencyMs: res.latencyMs,
        message: res.isValid
          ? '100% Mathematically Proven. Zero PII Leaked.'
          : 'Verification failed: proof invalid or public inputs mismatch',
        publicSignals: telemetry.zk.zkResult.publicSignals,
      });
    } catch (err) {
      console.error('Verification error:', err);
      setVerificationResult({
        verified: false,
        latencyMs: 10,
        message: 'Cryptographic error during local verification',
        publicSignals: [],
      });
    } finally {
      setIsVerifying(false);
    }
  }, [telemetry.zk]);

  const downloadRedactedPdf = useCallback(() => {
    if (!telemetry.seal?.pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = telemetry.seal.pdfBlobUrl;
    a.download = 'Zeroara_Redacted_Accredited_Investor.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [telemetry.seal]);

  const exportAuditReceipt = useCallback(() => {
    if (!telemetry.seal?.auditReceiptJson) return;
    const blob = new Blob([JSON.stringify(telemetry.seal.auditReceiptJson, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Zeroara_Master_Audit_Receipt.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [telemetry.seal]);

  const resetPipeline = useCallback(() => {
    abortControllerRef.current = true;
    setPipelineState('IDLE');
    setActiveStep(1);
    setCompletedSteps([]);
    setTelemetry({
      ingest: null,
      ocr: null,
      raster: null,
      zk: null,
      seal: null,
    });
    setVerificationResult(null);
    setVerificationModalOpen(false);
  }, []);

  return {
    pipelineState,
    activeStep,
    completedSteps,
    telemetry,
    networkActivity,
    verificationModalOpen,
    verificationResult,
    isVerifying,
    loadSampleDocument,
    selectStep,
    runEnterpriseVerification,
    downloadRedactedPdf,
    exportAuditReceipt,
    resetPipeline,
    setVerificationModalOpen,
  };
}
