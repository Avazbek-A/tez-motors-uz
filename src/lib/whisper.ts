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
): Promise<{ text: string; language: string | null }> {
  const url = (process.env.WHISPER_URL || "").trim();
  if (!url) return { text: "", language: null };
  try {
    // POST the raw audio bytes; the self-hosted faster-whisper service
    // (deploy/selfhost/whisper-server.py on the Vostro) reads the body, transcribes,
    // and returns JSON { text, language }. Raw body keeps the service trivial.
    const u = opts?.language ? `${url}${url.includes("?") ? "&" : "?"}language=${encodeURIComponent(opts.language)}` : url;
    const res = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(audio),
      signal: AbortSignal.timeout(180_000), // long calls take a while on CPU
    });
    if (!res.ok) return { text: "", language: null };
    const data = (await res.json().catch(() => null)) as { text?: string; transcript?: string; language?: string } | null;
    return { text: (data?.text || data?.transcript || "").trim(), language: data?.language || null };
  } catch {
    return { text: "", language: null };
  }
}
