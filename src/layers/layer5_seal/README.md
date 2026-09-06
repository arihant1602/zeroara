# Layer 5: Quad-Factor Master Audit Seal & Verification Envelope

## 📋 Module Overview
Layer 5 is the mathematical bonding apex of the Zeroara Protocol. It takes the four independent outputs from previous layers and irreversibly fuses them into a single 256-bit Master Audit Seal:
$$\text{Seal} = H(H(\text{Doc\_Redacted}) \parallel \text{BoundingBoxes} \parallel C \parallel H(\pi))$$
Modifying even 1 pixel of the sanitized PDF, shifting any redaction coordinate by 1px, or swapping the zero-knowledge proof immediately invalidates the seal.

---

## 👤 Ownership & Responsibility
- **Assigned Owner**: **Arihant & Shrihaan**
- **Role**: Master Cryptographic Seal & Verification Envelope Architects
- **Handoff Note**: Produces the standalone, portable `.zeroara-audit.json` verification package consumed by enterprise auditors in Layer 6.

---

## ⚙️ Key Invariants & Rules
1. **Quad-Factor Cryptographic Binding**: The seal must strictly bind:
   - Factor 1: $H(\text{Doc\_Redacted})$ from Layer 3.
   - Factor 2: Bounding coordinates string summary `[x:..,y:..,w:..,h:..]` from Layer 2.
   - Factor 3: Poseidon Pedersen commitment $C = \text{Poseidon}(\text{actual}, r)$ from Layer 4.
   - Factor 4: SHA-256 digest of the Groth16 proof points $(\pi_a, \pi_b, \pi_c)$ from Layer 4.
2. **Determinism**: Identical inputs must always produce the identical seal string.

---

## 📥 Inputs & 📤 Outputs
- **Input**: Sanitized PDF hash, bounding box array, Poseidon commitment, and Groth16 proof points.
- **Output**: `MasterSealResult` and `ZeroaraAuditPackage` JSON bundle.

---

## 🤖 Instructions for AI Agents
- The seal format string `zeroara:seal:v1:doc:...` is standardized. Do not alter delimiters or factor order without updating `verifyAuditPackage()`.
