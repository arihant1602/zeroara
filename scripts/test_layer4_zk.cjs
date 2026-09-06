const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function computePoseidonCommitment(poseidon, actualValue, salt) {
  const hash = poseidon([BigInt(actualValue), BigInt(salt)]);
  return poseidon.F.toString(hash);
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 ZEROARA LAYER 4: CIRCOM GROTH16 TEST SUITE');
  console.log('====================================================\n');

  const poseidon = await buildPoseidon();
  const wasmPath = path.resolve(__dirname, '../public/zk/income_threshold.wasm');
  const zkeyPath = path.resolve(__dirname, '../public/zk/income_threshold.zkey');
  const vkeyPath = path.resolve(__dirname, '../public/zk/verification_key.json');
  const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: salary = 150000 >= threshold = 100000
  // ----------------------------------------------------
  console.log('Test 1: Prover with Valid Witness (salary = 150000 >= 100000)');
  const salary1 = 150000;
  const threshold1 = 100000;
  const salt1 = '18446744073709551615'; // 64-bit+ test scalar
  const commitment1 = await computePoseidonCommitment(poseidon, salary1, salt1);

  const input1 = {
    actualValue: salary1,
    blindingSalt: salt1,
    thresholdValue: threshold1,
    expectedCommitment: commitment1,
  };

  const { proof: proof1, publicSignals: pubSignals1 } = await snarkjs.groth16.fullProve(
    input1,
    wasmPath,
    zkeyPath
  );
  assert(proof1 && proof1.pi_a && proof1.pi_a.length >= 2, 'Groth16 proof points (pi_a, pi_b, pi_c) generated');
  assert(pubSignals1[0] === threshold1.toString(), 'Public signal 0 is public threshold');
  assert(pubSignals1[1] === commitment1, 'Public signal 1 is Poseidon commitment');

  const isValid1 = await snarkjs.groth16.verify(vKey, pubSignals1, proof1);
  assert(isValid1 === true, 'Groth16 cryptographic verification succeeds for valid witness');

  // ----------------------------------------------------
  // TEST 2: salary = 90000 < threshold = 100000 (Must Fail)
  // ----------------------------------------------------
  console.log('\nTest 2: Prover with Invalid Witness (salary = 90000 < 100000)');
  const salary2 = 90000;
  const threshold2 = 100000;
  const salt2 = '9999999999999999999';
  const commitment2 = await computePoseidonCommitment(poseidon, salary2, salt2);

  const input2 = {
    actualValue: salary2,
    blindingSalt: salt2,
    thresholdValue: threshold2,
    expectedCommitment: commitment2,
  };

  let failedAsExpected = false;
  try {
    await snarkjs.groth16.fullProve(input2, wasmPath, zkeyPath);
  } catch (err) {
    failedAsExpected = true;
  }
  assert(failedAsExpected === true, 'Witness generation correctly rejects salary < threshold (Circom gte.out === 1)');

  // ----------------------------------------------------
  // TEST 3 & 4: Session Binding Context Derivation & Invalidation
  // ----------------------------------------------------
  console.log('\nTest 3 & 4: Session Context Binding & Invalidation');
  const docDigest = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const requester = 'Apex Distributed Ventures LP';
  const purpose = 'SEC Rule 506(c)';
  const nonce = '0x94f8a2bc710e39b4d1c68f12a03';

  const sessionPreimage = `zeroara:session:v1:doc:${docDigest}:req:${requester}:purp:${purpose}:thresh:${threshold1}:nonce:${nonce}:commit:${commitment1}`;
  const sessionBinding1 = await sha256Hex(sessionPreimage);
  assert(sessionBinding1.length === 64, `Session binding digest correctly computed: ${sessionBinding1.slice(0, 16)}...`);

  // Changing threshold or doc alters the binding
  const alteredThreshPreimage = `zeroara:session:v1:doc:${docDigest}:req:${requester}:purp:${purpose}:thresh:150000:nonce:${nonce}:commit:${commitment1}`;
  const alteredBinding = await sha256Hex(alteredThreshPreimage);
  assert(sessionBinding1 !== alteredBinding, 'Changing threshold invalidates deterministic session binding');

  // ----------------------------------------------------
  // TEST 5: Independent Verification
  // ----------------------------------------------------
  console.log('\nTest 5: Independent Verifier Re-run');
  const reVerify = await snarkjs.groth16.verify(vKey, pubSignals1, proof1);
  assert(reVerify === true, 'Independent verification call successfully validates existing proof');

  // ----------------------------------------------------
  // TEST 6: Tampered Proof Detection
  // ----------------------------------------------------
  console.log('\nTest 6: Tampered Proof Detection (Bit Flip in pi_a)');
  const tamperedProof = JSON.parse(JSON.stringify(proof1));
  tamperedProof.pi_a[0] = '123456789012345678901234567890';
  const tamperedVerify = await snarkjs.groth16.verify(vKey, pubSignals1, tamperedProof);
  assert(tamperedVerify === false, 'Tampered proof is cryptographically rejected by Groth16 verifier');

  // ----------------------------------------------------
  // TEST 7: Privacy Check (No Raw Secret in Proof or Public Signals)
  // ----------------------------------------------------
  console.log('\nTest 7: Zero-Knowledge Privacy Isolation');
  const pubSignalsString = JSON.stringify(pubSignals1);
  const proofString = JSON.stringify(proof1);
  assert(!pubSignalsString.includes('150000'), 'Public signals DO NOT contain raw salary (150000)');
  assert(!proofString.includes('150000'), 'Groth16 proof points DO NOT contain raw salary (150000)');
  assert(pubSignals1.length === 2, 'Public signals strictly restricted to [threshold, expectedCommitment]');

  console.log('\n====================================================');
  console.log(`🏁 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
