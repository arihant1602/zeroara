pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/*
  Zeroara Provable Redaction: Income Threshold Range Check & Commitment
  - Verifies that private actualValue >= public thresholdValue without revealing actualValue.
  - Enforces bit decomposition range check via circomlib GreaterEqThan(64).
  - Binds the private witness to a Poseidon commitment: expectedCommitment === Poseidon([actualValue, blindingSalt]).
*/
template IncomeThreshold() {
    // --- Private Witness ---
    signal input actualValue;
    signal input blindingSalt;

    // --- Public Inputs ---
    signal input thresholdValue;
    signal input expectedCommitment;

    // 1. Bit-decomposition range check (actualValue >= thresholdValue)
    // 64-bit bounds prevent overflow in BN254 field (254 bits).
    component gte = GreaterEqThan(64);
    gte.in[0] <== actualValue;
    gte.in[1] <== thresholdValue;
    gte.out === 1;

    // 2. Cryptographic Poseidon commitment binding
    component hasher = Poseidon(2);
    hasher.inputs[0] <== actualValue;
    hasher.inputs[1] <== blindingSalt;
    hasher.out === expectedCommitment;
}

component main {public [thresholdValue, expectedCommitment]} = IncomeThreshold();
