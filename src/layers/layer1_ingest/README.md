# Layer 1: Document Ingest & SHA-256 Preimage Digest

## 📋 Module Overview
Layer 1 is the sovereign cryptographic gateway of the Zeroara Protocol. It accepts raw documents (PDF, PNG, JPG) from the local device and loads them strictly into browser physical memory isolate (RAM). It computes the FIPS 180-4 compliant SHA-256 Preimage Digest $H(\text{Doc})$, which serves as the immutable root anchor for all downstream zero-knowledge proofs and seals.

---

## 👤 Ownership & Responsibility
- **Assigned Owner**: **Arihant (Lead)**
- **Role**: Ingestion Architect & Memory Isolation Guardian
- **Handoff Note**: Any changes to file ingestion, hashing algorithms, or sample synthesis must preserve zero network egress.

---

## ⚙️ Key Invariants & Rules
1. **Zero Network Egress**: Absolutely 0 bytes of document data may leave client RAM. Never upload to S3, cloud APIs, or external storage.
2. **Avalanche Sensitivity**: Any 1-bit or 1-pixel change to the file must yield an entirely different hash $H(\text{Doc})$.
3. **No File Mutation**: Raw bytes are preserved unchanged so downstream proof seals can reference exact preimage lengths.

---

## 📥 Inputs & 📤 Outputs
- **Input**: Raw `File` or `Uint8Array` bytes.
- **Output**: `IngestedDoc` containing `fileName`, `fileSizeBytes`, `mimeType`, `hashHex`, `chunkedHash`, and `rawBytes`.

---

## 🤖 Instructions for AI Agents
- When extending Layer 1 to support multi-page documents or new formats (TIFF, WebP), ensure hashing is done in chunks over the complete binary byte stream.
- Preserve the `generateSamplePdfBytes()` offline synthesizer for deterministic testing without external dependencies.
