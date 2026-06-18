/**
 * Shared call-recording pipeline — used by BOTH the HTTP upload endpoint
 * (/api/admin/calls/upload-recording) and the Telegram bot (forward a recording to
 * @tezmotors_bot). Stores the audio privately, logs a `calls` row immediately, then
 * transcribes (iOS transcript if given, else self-hosted Whisper) + AI-analyzes +
 * links the CRM inquiry in the background.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createServiceClient } from "@/lib/supabase/service";
import { safeMediaPath } from "@/lib/disk-store";
import { analyzeCall, type CallAnalysis } from "@/lib/call-intel";
import { generateVoiceSignature } from "@/lib/biometrics";
import { contactKey } from "@/lib/crm";
import { alertDealer } from "@/lib/error-report";
import { transcribeAudio } from "@/lib/whisper";

export const MAX_RECORDING_BYTES = 80 * 1024 * 1024;

export const AUDIO_EXT: Record<string, string> = {
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/aac": "aac",
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/webm": "webm", "audio/wav": "wav",
  "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/oga": "ogg", "audio/3gpp": "3gp",
};

function pickExt(type: string, name: string): string {
  const ext =
    AUDIO_EXT[type.toLowerCase()] ||
    name.match(/\.([a-z0-9]{2,4})$/i)?.[1]?.toLowerCase().replace(/^mp4$/, "m4a") ||
    "m4a";
  return /^(m4a|aac|mp3|webm|wav|ogg|3gp)$/.test(ext) ? ext : "m4a";
}

export interface LogRecordingInput {
  audioBuffer?: Buffer | null;
  audioType?: string;
  audioName?: string;
  transcript?: string;
  phone?: string;
  direction?: "inbound" | "outbound";
  durationSec?: number;
  /** When true, await transcription + analysis and return the result (the bot wants
   *  the summary for its reply); when false, enrich in the background (the HTTP
   *  endpoint responds in <1s). */
  awaitEnrich?: boolean;
}

export interface LogRecordingResult {
  callId: string;
  recordingUrl: string | null;
  analysis: CallAnalysis | null;
  transcript: string;
}

/** Store audio (if any) + insert the call row, then enrich (await or background). */
export async function logRecording(input: LogRecordingInput): Promise<LogRecordingResult> {
  const transcript0 = (input.transcript || "").trim();
  const phoneRaw = (input.phone || "").trim().slice(0, 40);
  const direction = input.direction === "inbound" ? "inbound" : "outbound";
  const durationSec = Math.max(0, Math.round(input.durationSec || 0) || 0);
  const audioBuffer = input.audioBuffer && input.audioBuffer.byteLength > 0 ? input.audioBuffer : null;

  if (audioBuffer && audioBuffer.byteLength > MAX_RECORDING_BYTES) {
    throw new Error("audio too large");
  }
  if (!transcript0 && !audioBuffer) {
    throw new Error("no audio and no transcript");
  }

  let recordingFile: string | null = null;
  if (audioBuffer) {
    recordingFile = `${randomUUID()}.${pickExt(input.audioType || "", input.audioName || "")}`;
    const abs = safeMediaPath(`call-recordings/${recordingFile}`);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, audioBuffer);
  }
  const recordingUrl = recordingFile ? `/api/admin/calls/recording/${recordingFile}` : null;
  const needsTranscription = !transcript0 && !!audioBuffer;

  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from("calls")
    .insert({
      customer_phone: phoneRaw || null,
      direction,
      duration_sec: durationSec || null,
      recording_url: recordingUrl,
      transcript: transcript0 || null,
      summary: null,
      lead_score: 0,
      metadata: { source: "upload", status: needsTranscription ? "transcribing" : "analyzing" },
      voice_signature: generateVoiceSignature(audioBuffer, durationSec, phoneRaw),
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(`failed to log call: ${error?.message || "no row"}`);

  const enrichArgs = { callId: row.id as string, audioBuffer, transcript: transcript0, durationSec, phoneRaw };
  if (input.awaitEnrich) {
    const { analysis, transcript } = await enrichRecording(enrichArgs);
    return { callId: row.id, recordingUrl, analysis, transcript };
  }
  void enrichRecording(enrichArgs);
  return { callId: row.id, recordingUrl, analysis: null, transcript: transcript0 };
}

/** Background: transcribe (if needed) → AI-analyze → update the row + CRM inquiry +
 *  alert on a negative call. Best-effort; returns the analysis for callers that await. */
export async function enrichRecording(args: {
  callId: string;
  audioBuffer: Buffer | null;
  transcript: string;
  durationSec: number;
  phoneRaw: string;
}): Promise<{ analysis: CallAnalysis | null; transcript: string }> {
  const supabase = createServiceClient();
  try {
    let transcript = args.transcript;
    if (!transcript && args.audioBuffer) {
      transcript = await transcribeAudio(args.audioBuffer).catch(() => "");
    }
    const analysis = await analyzeCall(transcript, args.durationSec);

    await supabase
      .from("calls")
      .update({
        transcript: transcript || null,
        summary: analysis.summary || null,
        lead_score: analysis.leadScore,
        metadata: { ...(analysis.metadata || {}), source: "upload", status: "done" },
      })
      .eq("id", args.callId);

    const phoneCore = contactKey(args.phoneRaw);
    if (phoneCore) {
      const closingProb = analysis.metadata?.extracted_entities?.closing_probability ?? 25;
      const { data: inq } = await supabase
        .from("inquiries")
        .select("id, notes, metadata")
        .ilike("phone", `%${phoneCore}%`)
        .limit(1)
        .maybeSingle();
      if (inq) {
        const dateStr = new Date().toLocaleDateString();
        const notes = analysis.summary
          ? `${inq.notes || ""}\n\n[Recorded call ${dateStr}]: ${analysis.summary}`.trim()
          : inq.notes;
        await supabase
          .from("inquiries")
          .update({ notes, metadata: { ...((inq.metadata as Record<string, unknown>) || {}), closing_probability: closingProb } })
          .eq("id", inq.id);
      } else if (args.phoneRaw) {
        await supabase.from("inquiries").insert({
          name: `Call (${args.phoneRaw})`,
          phone: args.phoneRaw,
          status: "new",
          type: "callback",
          notes: `[Auto-created from a recorded call]: ${analysis.summary || ""}`.trim(),
          metadata: { closing_probability: closingProb },
        });
      }
    }

    // Alert ONLY on a genuinely negative/frustrated call — not low compliance.
    const sentiment = analysis.metadata?.sentiment;
    if (sentiment && ["negative", "frustrated"].includes(sentiment)) {
      await alertDealer(
        "Recorded call — negative sentiment",
        [`Phone: ${args.phoneRaw || "—"}`, `Sentiment: ${sentiment}`, `Summary: ${analysis.summary}`],
        { key: `call_upload_audit:${args.callId}` },
      ).catch(() => {});
    }
    return { analysis, transcript };
  } catch (e) {
    console.error("recording enrichment failed:", e);
    await supabase.from("calls").update({ metadata: { source: "upload", status: "error" } }).eq("id", args.callId);
    return { analysis: null, transcript: args.transcript };
  }
}
