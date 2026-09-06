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
  commitment: string = '',
  proof?: Groth16ProofPoints | null
): Promise<MasterSealResult> {
  const bboxSummary = bboxes
    .map((b) => `${b.id}[x:${b.x},y:${b.y},w:${b.width},h:${b.height}]`)
    .join(';');
  // Seal-only outputs have no ZK proof/commitment; bind sentinels deterministically
  // so the same seal recomputes on the verifier side. Proof-backed seals are unchanged.
  const proofDigest = proof ? await sha256Hex(JSON.stringify(proof)) : 'NO_PROOF';
  const commitmentField = commitment || 'NO_COMMITMENT';
  const preimage = `zeroara:seal:v1:doc:${docRedactedHash}:bbox:${bboxSummary}:commit:${commitmentField}:proof:${proofDigest}`;
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
  // 1. Recompute Master Seal (proof/commitment optional for seal-only packages)
  const zk = pkg.zeroKnowledgeProof;
  const bboxes = pkg.sanitizedDocument.burnedBoundingBoxes;
  const recomputed = await computeMasterAuditSeal(
    pkg.sanitizedDocument.preimageSha256,
    bboxes,
    zk?.poseidonCommitment ?? '',
    zk?.proof ?? null
  );

  const sealValid = recomputed.sealHex.toLowerCase() === pkg.masterAuditSeal.sealHex.toLowerCase();

  // 2. Verify ZK Proof — only when the package is proof-backed.
  let proofValid = true; // seal-only: no numeric proof to fail
  if (zk) {
    const proofVerify = await verifyIncomeProof(zk.proof, zk.publicSignals);
    proofValid = proofVerify.isValid;
  }

  return {
    sealValid,
    proofValid,
    computedSealHex: recomputed.sealHex,
    expectedSealHex: pkg.masterAuditSeal.sealHex,
  };
}
