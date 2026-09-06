// @ts-expect-error circomlibjs lacks ts declarations
import { buildPoseidon } from 'circomlibjs';
// @ts-expect-error snarkjs lacks full ts declarations
import * as snarkjs from 'snarkjs';
import { Groth16ProofPoints, SessionContext, Groth16ProofResult } from './types';
import { sha256Hex } from '../layer1_ingest/ingestEngine';

/**
 * Layer 4 Zero-Knowledge Prover Engine:
 * Compiles Circom R1CS constraints over BN128/BN254 curve, executes witness blinding,
 * generates non-interactive Groth16 proofs, and validates proofs locally in WebAssembly.
 */

let poseidonFn: any = null;
export async function getPoseidon() {
  if (!poseidonFn) {
    poseidonFn = await buildPoseidon();
  }
  return poseidonFn;
}

export async function computePoseidonCommitment(actualValue: number | bigint, salt: bigint): Promise<string> {
  const poseidon = await getPoseidon();
  const hash = poseidon([BigInt(actualValue), salt]);
  return poseidon.F.toString(hash);
}

export function generateRandomScalar(): bigint {
  const randBytes = new Uint8Array(31);
  crypto.getRandomValues(randBytes);
  let hex = '0x';
  randBytes.forEach((b) => (hex += b.toString(16).padStart(2, '0')));
  return BigInt(hex);
}

export async function computeSessionBinding(
  ctx: SessionContext,
  poseidonCommitment: string
): Promise<string> {
  const preimage = `zeroara:session:v1:doc:${ctx.documentDigest}:req:${ctx.requesterName}:purp:${ctx.purpose}:thresh:${ctx.thresholdValue}:nonce:${ctx.challengeNonce}:commit:${poseidonCommitment}`;
  return await sha256Hex(preimage);
}

export const EMBEDDED_VERIFICATION_KEY = {
  protocol: 'groth16',
  curve: 'bn128',
  nPublic: 2,
  vk_alpha_1: [
    '1132085767878658749409376369637788501447741591519865173283795686151822759388',
    '3282798298938032117830503359798871852643369395433812247428478219947216446490',
    '1',
  ],
  vk_beta_2: [
    [
      '21854834551775687658371874612048774433154452857817979791191285667997537280559',
      '17981622666479669800848298480629788820730936588637896767441671245487052874096',
    ],
    [
      '11838679258562354444956815608153906844477684323859767942383369580822448917979',
      '10970466534716718063204632921475593462272229178217392988334680029559015486892',
    ],
    ['1', '0'],
  ],
  vk_gamma_2: [
    [
      '10857046999023057135944570762232829481370756359578518086990519993285655852781',
      '11559732032986387107991004021392285783925812861821192530917403151452391805634',
    ],
    [
      '8495653923123431417604973247489272438418190587263600148770280649306958101930',
      '4082367875863433681332203403145435568316851327593401208105741076214120093531',
    ],
    ['1', '0'],
  ],
  vk_delta_2: [
    [
      '14609144745765883534725902755970976935605835263587079873099666723661998747266',
      '4293616449589817176190478190152251240107395928943330723874010282275996081946',
    ],
    [
      '10713718296807118499219129272431979852514905160335050748081176716082000551584',
      '15818718504269633069402578346289290388379721231833026277014259569639828034630',
    ],
    ['1', '0'],
  ],
  vk_alphabeta_12: [
    [
      [
        '18177465682781214043754612242359027355095772992500081319803599189564355451011',
        '6052839721985879182664650969073619278270028612854715223147626177807566166996',
      ],
      [
        '14253621230270439275895257337614751622852721800284008520265200486599084319461',
        '1200785670181728065157261238881378619833578095948457840688730590852631813671',
      ],
      [
        '13719692662506512016773820976600134474488266777984412288053578783564563972769',
        '15682341612624731052064098789113733791549482508097458392943443873375861721339',
      ],
    ],
    [
      [
        '9310385774642528782526512392187485963805070793247515665588858236334795608329',
        '5435335697840845956845187463945358543121252250872307841394845296287231823010',
      ],
      [
        '2439393116855241727410972811196015759774571415940057717973935026318733330485',
        '16539501097342644627544715501849565175799058338945035433325479454945221847003',
      ],
      [
        '6971734944134061712094313920488526151283870057298536582213428129679685704308',
        '3955865200136789006984856982099339533147618996657258462989726322452359148669',
      ],
    ],
  ],
  IC: [
    [
      '888126466450815662922338595315744180413420726307686589694088101732885080323',
      '18467008887725728302769589515452878423306838440474899046705042576132965292246',
      '1',
    ],
    [
      '20062475442328182584341055368040011701060468277194292937962442671568606941158',
      '15513527174613372168500006040415868643398597033706073158522555583959149347722',
      '1',
    ],
    [
      '20355528636251031468944530864402435390295310897503904929095072669991690498202',
      '20132800285513019554538289636324179915116522291700767435318110852604873396758',
      '1',
    ],
  ],
};

export async function generateIncomeThresholdProof(
  actualValue: number,
  thresholdValue: number,
  sessionCtx?: SessionContext,
  customSalt?: bigint
): Promise<Groth16ProofResult> {
  const startTime = performance.now();
  const salt = customSalt ?? generateRandomScalar();
  const expectedCommitment = await computePoseidonCommitment(actualValue, salt);

  const circuitInput = {
    actualValue: actualValue,
    blindingSalt: salt.toString(),
    thresholdValue: thresholdValue,
    expectedCommitment: expectedCommitment,
  };

  const wasmUrl = '/zk/income_threshold.wasm';
  const zkeyUrl = '/zk/income_threshold.zkey';

  let proof: Groth16ProofPoints;
  let publicSignals: string[];

  try {
    const res = await snarkjs.groth16.fullProve(
      circuitInput,
      wasmUrl,
      zkeyUrl
    );
    proof = res.proof;
    publicSignals = res.publicSignals;
  } catch (err: any) {
    if (actualValue < thresholdValue) {
      throw new Error(
        `ZK Constraint Unsatisfied: Witness value does not meet the enterprise threshold (≥ $${thresholdValue.toLocaleString()}). Circom bit-decomposition range check failed.`
      );
    }
    throw new Error(`In-browser Groth16 proof generation failed: ${err?.message || err}`);
  }

  const durationMs = Math.max(1, Math.round(performance.now() - startTime));

  let sessionBinding = '';
  if (sessionCtx) {
    sessionBinding = await computeSessionBinding(sessionCtx, expectedCommitment);
  } else {
    sessionBinding = await sha256Hex(`zeroara:session:v1:thresh:${thresholdValue}:commit:${expectedCommitment}`);
  }

  const verifyRes = await verifyIncomeProof(proof, publicSignals);

  return {
    proof,
    publicSignals,
    durationMs,
    commitment: expectedCommitment,
    blindingSalt: '0x' + salt.toString(16),
    thresholdValue,
    sessionBinding,
    verified: verifyRes.isValid,
    verificationLatencyMs: verifyRes.latencyMs,
    generatedAt: new Date().toISOString(),
    protocol: proof.protocol || 'groth16',
    curve: proof.curve || 'bn128',
  };
}

export async function verifyIncomeProof(
  proof: Groth16ProofPoints,
  publicSignals: string[]
): Promise<{ isValid: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    let vKey: any = null;
    try {
      const vKeyResp = await fetch('/zk/verification_key.json');
      if (vKeyResp.ok) {
        vKey = await vKeyResp.json();
      }
    } catch {
      // Offline fallback
    }

    if (!vKey) {
      vKey = EMBEDDED_VERIFICATION_KEY;
    }

    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    return { isValid: Boolean(isValid), latencyMs };
  } catch {
    return { isValid: false, latencyMs: Math.max(1, Math.round(performance.now() - start)) };
  }
}
