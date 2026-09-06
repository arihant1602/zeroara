# Zeroara Surya OCR sidecar (local-only, pure PyTorch)

Stage 2 OCR uses [Surya](https://github.com/VikParuchuri/surya) running **on your machine**
at `127.0.0.1:8765` as plain Python/PyTorch models (no Ollama, no llama.cpp, no model
server). The browser sends the rendered document image to it; nothing leaves the device.
If the sidecar isn't running, Zeroara falls back to in-browser Tesseract.

```bash
python3 -m venv .surya && source .surya/bin/activate
pip install "surya-ocr>=0.14,<0.15"     # the pure-PyTorch Surya line
./sidecar/run.sh                         # first run downloads the det/rec models once
```
Health check: `curl http://127.0.0.1:8765/health` → `"model_loaded": true` once a real warm-up inference has succeeded.
