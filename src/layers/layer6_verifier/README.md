# Layer 6: Enterprise Verifier Portal & Standalone Auditor Suite

## 📋 Module Overview
Layer 6 implements the external auditor side of the Zeroara Protocol. In production, verifiers (financial lenders, cryptocurrency exchanges, landlords, compliance auditors) do not have access to the user's sovereign desktop or unredacted document. Instead, they ingest the portable `.zeroara-audit.json` package and evaluate it against 5 independent mathematical gates:
1. **Gate 1: Sanitized PDF Preimage Integrity**: Validates $H(\text{Doc\_Redacted})$.
2. **Gate 2: Bounding Geometry Structural Consistency**: Confirms redaction boxes are non-degenerate and bound to page dimensions.
3. **Gate 3: Poseidon Pedersen Commitment Anchor**: Confirms the blinded commitment $C = \text{Poseidon}(\text{actual}, r)$ is mathematically well-formed.
4. **Gate 4: Groth16 zk-SNARK Soundness**: Executes in-browser bilinear pairing verification via `snarkjs` in WebAssembly against `verification_key.json`.
5. **Gate 5: Quad-Factor Master Audit Seal Recomputation**: Re-executes the seal equation $\text{Seal} = H(H(\text{Doc\_Redacted}) \parallel \text{BBoxes} \parallel C \parallel H(\pi))$ and confirms a 100% bitwise match.

---

## 👤 Ownership & Responsibility
- **Assigned Owner**: **Arihant (Lead) & Shrihaan**
- **Role**: Auditor Protocol & Verification Engine Architects
- **Handoff Note**: Contains the interactive `VerifierPortalView.tsx` and `runEnterpriseAudit()` engine with built-in attack/tamper simulation.

---

## ⚙️ Key Invariants & Rules
1. **Zero Knowledge Guarantee**: The verifier must verify that the applicant satisfies the policy threshold without ever seeing the raw balance or PII (0 bytes disclosed).
2. **Replay & Tamper Immunity**: A 1-pixel coordinate displacement or 1-bit proof corruption must immediately fail Gates 2, 4, or 5.
3. **Offline In-Browser Verification**: Verification key pairing must run locally in browser WebAssembly without external server dependencies.

---

## 📥 Inputs & 📤 Outputs
- **Input**: `ZeroaraAuditPackage` JSON bundle and optional sanitized PDF file bytes.
- **Output**: `VerifierAuditReport` detailing individual gate pass/fail latencies, tamper diagnostics, and overall verification compliance.
