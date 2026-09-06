# Layer 7: Hardware Attestation & OS Enclave Binding

## 📋 Module Overview
Layer 7 binds Zeroara's cryptographic outputs to sovereign physical silicon. By utilizing Trusted Platform Modules (TPM 2.0) on Linux/Windows and Apple Secure Enclave (SEP) on macOS, the Master Audit Seal is signed by a hardware key that cannot be exported or cloned, certifying that computation ran in protected device hardware.

---

## 👤 Ownership & Responsibility
- **Assigned Owner**: **Arihant (Lead) & Rust System Engineer**
- **Role**: Hardware Security & Native Systems Engineer
- **Implementation State**: Fully operational in Rust desktop core (`src-tauri/src/enclave.rs`). Scheduled for browser IPC integration in Milestone v0.3.

---

## ⚙️ Key Invariants & Rules
1. **Volatile Memory Zeroization**: Any memory region holding unredacted document bytes must be pinned with `mlock` and zeroized (`0x00`) immediately on drop.
2. **Hardware Signature Preimage**: $\text{Sig} = \text{Sign}_{\text{TPM}}(\text{Seal} \parallel \text{Nonce})$.

---

## 🤖 Instructions for AI Agents
- Native code lives in `src-tauri/src/enclave.rs`.
- Do not attempt to mock hardware signatures in production builds; if TPM is absent, fall back to software simulation with clear user warnings.
