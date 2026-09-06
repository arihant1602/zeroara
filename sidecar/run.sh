#!/usr/bin/env bash
# Launch the Zeroara Surya OCR sidecar — pure PyTorch, local-only (127.0.0.1:8765).
# No external binaries or model servers; the OCR models run in-process.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PY="${SURYA_PYTHON:-$HERE/../.surya/bin/python}"
# Weights come from Hugging Face on first run; its Xet transfer fails on some
# networks, so force plain HTTPS. Downloads happen once, then run offline.
export HF_HUB_DISABLE_XET=1
[ -x "$PY" ] || PY="$(command -v python3)"
exec "$PY" "$HERE/surya_sidecar.py" --port "${PORT:-8765}"
