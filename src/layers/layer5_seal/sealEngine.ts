import { MasterSealResult, ZeroaraAuditPackage } from './types';
import { Groth16ProofPoints } from '../layer4_zk/types';
import { sha256Hex } from '../layer1_ingest/ingestEngine';
import { verifyIncomeProof } from '../layer4_zk/zkEngine';

/**
 * Layer 5 Master Audit Seal Engine:
 * Welds the four cryptographic factors into a load-bearing seal:
 * Seal = Hash(H(Doc_Redacted) || BBoxes || WitnessCommitment || H(pi))
 */

export async function computeMasterAuditSeal(
  docRedactedHash: string,
  bboxes: Array<{ id: string; x: number; y: number; width: number; height: number; [key: string]: any }>,
  commitment: string,
  proof: Groth16ProofPoints
): Promise<MasterSealResult> {
  const bboxSummary = bboxes
    .map((b) => `${b.id}[x:${b.x},y:${b.y},w:${b.width},h:${b.height}]`)
    .join(';');
  const proofDigest = await sha256Hex(JSON.stringify(proof));
  const preimage = `zeroara:seal:v1:doc:${docRedactedHash}:bbox:${bboxSummary}:commit:${commitment}:proof:${proofDigest}`;
  const sealHex = await sha256Hex(preimage);

  return {
    sealHex,
    preimage,
    docRedactedHash,
    bboxSummary,
    commitment,
    proofDigest,
  };
}

export async function verifyAuditPackage(pkg: ZeroaraAuditPackage): Promise<{
  sealValid: boolean;
  proofValid: boolean;
  computedSealHex: string;
  expectedSealHex: string;
}> {
  // 1. Recompute Master Seal
  const bboxes = pkg.sanitizedDocument.burnedBoundingBoxes;
  const recomputed = await computeMasterAuditSeal(
    pkg.sanitizedDocument.preimageSha256,
    bboxes,
    pkg.zeroKnowledgeProof.poseidonCommitment,
    pkg.zeroKnowledgeProof.proof
  );

  const sealValid = recomputed.sealHex.toLowerCase() === pkg.masterAuditSeal.sealHex.toLowerCase();

  // 2. Verify ZK Proof
  const proofVerify = await verifyIncomeProof(
    pkg.zeroKnowledgeProof.proof,
    pkg.zeroKnowledgeProof.publicSignals
  );

  return {
    sealValid,
    proofValid: proofVerify.isValid,
    computedSealHex: recomputed.sealHex,
    expectedSealHex: pkg.masterAuditSeal.sealHex,
  };
}
