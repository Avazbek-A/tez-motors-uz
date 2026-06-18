/**
 * Self-hosted speech-to-text (Whisper) — FAIL-SOFT.
 *
 * The Calls suite's recording upload uses iOS's own transcript when present; only
 * when an audio file arrives WITHOUT a transcript does it fall back to this. Points
 * at a local Whisper HTTP service on the Vostro (whisper.cpp `server` or a
 * faster-whisper wrapper) via WHISPER_URL — no cloud, no per-minute cost.
 *
 * Returns "" on any failure or when WHISPER_URL is unset, so callers degrade
 * gracefully (store the audio, leave the transcript blank) instead of throwing.
 */
export async function transcribeAudio(
  audio: Buffer | Uint8Array,
  opts?: { language?: string; filename?: string },
): Promise<{ text: string; language: string | null; duration: number }> {
  const url = (process.env.WHISPER_URL || "").trim();
  if (!url) return { text: "", language: null, duration: 0 };
  try {
    // POST the raw audio bytes; the self-hosted faster-whisper service
    // (deploy/selfhost/whisper-server.py on the Vostro) reads the body, transcribes,
    // and returns JSON { text, language }. Raw body keeps the service trivial.
    const u = opts?.language ? `${url}${url.includes("?") ? "&" : "?"}language=${encodeURIComponent(opts.language)}` : url;
    // CPU transcription runs at ~1–3× realtime on the Vostro, so a long sales call
    // (10–20 min) needs far more than the old 180s — at that limit a long call aborted
    // mid-way and silently produced an EMPTY transcript (the worst outcome, on exactly
    // the calls that matter most). Transcription is backgrounded (HTTP) or awaited
    // behind a "⏳ processing" message (Telegram bot), so a generous ceiling is safe.
    const timeoutMs = Math.max(60_000, Number(process.env.WHISPER_TIMEOUT_MS) || 1_800_000); // default 30 min
    const res = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(audio),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { text: "", language: null, duration: 0 };
    const data = (await res.json().catch(() => null)) as { text?: string; transcript?: string; language?: string; duration?: number } | null;
    return {
      text: (data?.text || data?.transcript || "").trim(),
      language: data?.language || null,
      duration: Math.max(0, Math.round(Number(data?.duration) || 0)),
    };
  } catch {
    return { text: "", language: null, duration: 0 };
  }
}
