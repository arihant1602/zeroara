# Layer 8: Web-to-Desktop Transport & Deep Link Protocol

## 📋 Module Overview
Layer 8 is the IPC communication bridge that allows web applications (lending portals, cryptocurrency exchanges, HR portals) to request provable redaction from the user's sovereign Zeroara desktop application.
It defines two communication channels:
1. **OS Custom URI Deep Link**: `zeroara://verify?request=<base64_json>`
2. **Local Loopback WebSocket/HTTP**: Dedicated local listener on `127.0.0.1:8383` restricted via strict Origin headers.

---

## 👤 Ownership & Responsibility
- **Assigned Owner**: **Arihant (Lead)**
- **Role**: Transport Protocol Architect
- **Implementation State**: Scaffolded for Milestone v0.4.

---

## ⚙️ Key Invariants & Rules
1. **Zero Raw Egress**: The desktop application NEVER sends back the raw unredacted document. It only returns the audited package bundle with the burned PDF and ZK proof.
2. **Origin Validation**: Loopback connections must strictly authenticate requester origins.

---

## 🤖 Instructions for AI Agents
- The deep link payload format is specified in `src/layers/layer8_transport/types.ts`.
- Ensure all callback endpoints validate the Master Audit Seal before processing loans or granting accreditation.
