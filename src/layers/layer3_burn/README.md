# Layer 3: Physical Pixel Burning & Text Stream Stripping

## 📋 Module Overview
Layer 3 solves the notorious "black-box overlay" vulnerability where sensitive characters remain in the PDF text stream beneath an opaque drawing layer. Zeroara draws pitch-black `#000000` pixels directly into the in-memory RGB raster, flattens the canvas, and strips all `/Font`, `/Text`, and `BT...ET` operator streams. Copy-pasting or inspecting the sanitized document yields strictly 0 characters.

---

## 👤 Ownership & Responsibility
- **Assigned Owner**: **Animesh Raj**
- **Role**: Memory Sanitization & PostScript/PDF Engine Engineer
- **Handoff Note**: Responsible for maintaining non-extractability. The sanitized PDF must pass automated verification yielding `textStreamCount === 0`.

---

## ⚙️ Key Invariants & Rules
1. **Irreversible Destruction**: Target coordinate memory must be overwritten with pitch-black pixels before emitting the final image raster.
2. **Text Stream Obliteration**: The resulting PDF must contain ONLY an XObject image raster. No vector glyph streams or OCR text layers may persist.
3. **Preimage Anchor**: Computes $H(\text{Doc\_Redacted}) = \text{SHA-256}(\text{flattened\_bytes})$. This exact hash binds the burned document to the Layer 5 Master Audit Seal.

---

## 📥 Inputs & 📤 Outputs
- **Input**: Source document canvas and classified redaction target zones `ClassifiedTarget[]`.
- **Output**: `RedactionResult` containing sanitized PDF bytes, $H(\text{Doc\_Redacted})$ hash, burned zones count, and duration.

---

## 🤖 Instructions for AI Agents
- Always verify that the output PDF contains zero extractable text items using `pdfjs.getTextContent()`.
- Do not compress or resample the raster after computing $H(\text{Doc\_Redacted})$, as modifying even 1 byte will break the Master Audit Seal.
