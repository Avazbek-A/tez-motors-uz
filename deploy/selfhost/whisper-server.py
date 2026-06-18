#!/usr/bin/env python3
"""
Tez Motors self-hosted speech-to-text (Whisper) — runs on the Vostro, NOT the edge.

The Calls suite's recording upload posts raw audio bytes here when a recording has
no transcript (iOS usually supplies its own); we transcribe with faster-whisper on
CPU — no cloud, no per-minute cost — and return JSON { text, language }.

Run via the tez-whisper systemd unit (see deploy/selfhost/KEYS.md). The app reaches
it through WHISPER_URL=http://127.0.0.1:8089. Bound to localhost only.

Env: WHISPER_MODEL (default "small"), WHISPER_PORT (default 8089),
     WHISPER_COMPUTE (default "int8").
"""
import json
import os
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from faster_whisper import WhisperModel

MODEL_NAME = os.environ.get("WHISPER_MODEL", "small")
PORT = int(os.environ.get("WHISPER_PORT", "8089"))
COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")
MAX_BYTES = 200 * 1024 * 1024

print(f"[whisper] loading model={MODEL_NAME} compute={COMPUTE} ...", flush=True)
MODEL = WhisperModel(MODEL_NAME, device="cpu", compute_type=COMPUTE)
LOCK = threading.Lock()  # transcribe() one at a time (low call volume; keeps RAM sane)
print(f"[whisper] ready on 127.0.0.1:{PORT}", flush=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):  # quiet
        pass

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._json(200, {"ok": True, "model": MODEL_NAME})

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > MAX_BYTES:
                return self._json(400, {"error": "bad content length"})
            data = self.rfile.read(n)
            # ?language=ru forces a language; otherwise auto-detect (handles RU/UZ/EN).
            lang = None
            if "?" in self.path and "language=" in self.path:
                lang = self.path.split("language=")[-1].split("&")[0] or None
            with tempfile.NamedTemporaryFile(suffix=".audio") as f:
                f.write(data)
                f.flush()
                with LOCK:
                    segments, info = MODEL.transcribe(f.name, language=lang, vad_filter=True)
                    text = " ".join(s.text.strip() for s in segments).strip()
            return self._json(200, {"text": text, "language": getattr(info, "language", None)})
        except Exception as e:  # never crash the service on one bad file
            return self._json(500, {"error": str(e)[:200]})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
