#!/usr/bin/env python3
"""
Tez Motors self-hosted speech-to-text (Whisper) — runs on the Vostro, NOT the edge.

The Calls suite posts raw audio bytes here when a recording has no transcript; we
transcribe with faster-whisper on CPU — no cloud, no per-minute cost — and return
JSON { text, language }.

Tuned for the dealer's calls (Russian + Uzbek):
  - Default model "medium" — far better Uzbek + language ID than "small".
  - LANGUAGE FIX: Whisper confuses Uzbek with other Turkic languages (esp.
    Azerbaijani "az"). When auto-detect returns a Turkic-non-Russian language, we
    RE-transcribe forcing Uzbek so the text decodes correctly.
  - DOMAIN PROMPT: seeds brand/place names Whisper otherwise mangles.
  - ?language=ru|uz|en forces a language (skips detection).

Run via the tez-whisper cron supervisor (see deploy/selfhost/KEYS.md). The app
reaches it at WHISPER_URL=http://127.0.0.1:8089. Bound to localhost only.

Env: WHISPER_MODEL (default "medium"), WHISPER_PORT (8089), WHISPER_COMPUTE (int8).
"""
import json
import os
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from faster_whisper import WhisperModel

MODEL_NAME = os.environ.get("WHISPER_MODEL", "medium")
PORT = int(os.environ.get("WHISPER_PORT", "8089"))
COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")
MAX_BYTES = 200 * 1024 * 1024

# Languages Whisper commonly mis-detects for Uzbek (Turkic family). When detection
# lands on one of these, we force Uzbek decoding instead.
TURKIC_MISDETECT = {"az", "tr", "tk", "tt", "kk", "ky", "ba", "cv", "ug", "kaa", "uz"}

# Domain prompt — proper nouns Whisper mangles (language-neutral brand/place names).
DOMAIN_PROMPT = "Tez Motors, BYD, Chery, Geely, Haval, Tank, Changan, Toyota, Tashkent, Samarkand."

print(f"[whisper] loading model={MODEL_NAME} compute={COMPUTE} ...", flush=True)
MODEL = WhisperModel(MODEL_NAME, device="cpu", compute_type=COMPUTE)
LOCK = threading.Lock()  # one transcription at a time (low volume; keeps RAM sane)
print(f"[whisper] ready on 127.0.0.1:{PORT}", flush=True)


def _run(path: str, language):
    segments, info = MODEL.transcribe(
        path,
        language=language,
        beam_size=5,
        vad_filter=True,
        initial_prompt=DOMAIN_PROMPT,
        # condition_on_previous_text=False: feeding each window the PREVIOUS window's
        # text is the #1 cause of runaway repetition / hallucination on noisy phone
        # audio (a whole call decoded as one repeated phrase). Turning it off trades a
        # little cross-segment spelling consistency for far more robust transcripts.
        # The initial_prompt still seeds brand/place proper nouns on the first window.
        condition_on_previous_text=False,
        # Drop low-confidence / gibberish segments instead of emitting hallucinated text
        # during silence (defaults, made explicit so they survive faster-whisper changes).
        no_speech_threshold=0.6,
        compression_ratio_threshold=2.4,
        log_prob_threshold=-1.0,
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    return text, getattr(info, "language", language), getattr(info, "duration", 0) or 0


def transcribe(path: str, override):
    if override:
        return _run(path, override)
    # Pass 1: auto-detect.
    text, lang, dur = _run(path, None)
    # If detection landed on a Turkic language (but NOT Russian/English), it's almost
    # certainly Uzbek mis-ID'd — re-decode forcing Uzbek for correct text.
    if lang in TURKIC_MISDETECT and lang != "uz":
        text2, _, dur2 = _run(path, "uz")
        if text2:
            return text2, "uz", dur2
    return text, lang, dur


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
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
            override = None
            if "?" in self.path and "language=" in self.path:
                override = (self.path.split("language=")[-1].split("&")[0] or "").strip() or None
            with tempfile.NamedTemporaryFile(suffix=".audio") as f:
                f.write(data)
                f.flush()
                with LOCK:
                    text, lang, dur = transcribe(f.name, override)
            return self._json(200, {"text": text, "language": lang, "duration": round(dur)})
        except Exception as e:
            return self._json(500, {"error": str(e)[:200]})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
