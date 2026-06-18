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
): Promise<string> {
  const url = (process.env.WHISPER_URL || "").trim();
  if (!url) return "";
  try {
    const form = new FormData();
    // whisper.cpp's server expects the field name "file"; faster-whisper wrappers
    // commonly accept "file" too. Send a generic m4a/wav blob.
    form.append("file", new Blob([new Uint8Array(audio)]), opts?.filename || "call.m4a");
    if (opts?.language) form.append("language", opts.language);
    // whisper.cpp server flags (ignored by wrappers that don't use them).
    form.append("response_format", "json");
    const res = await fetch(url, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(180_000), // long calls can take a while on CPU
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = (await res.json().catch(() => null)) as { text?: string; transcript?: string } | null;
      return (data?.text || data?.transcript || "").trim();
    }
    return (await res.text()).trim();
  } catch {
    return "";
  }
}
