import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { isAdminRequest, requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { safeMediaPath } from "@/lib/disk-store";
import { analyzeCall } from "@/lib/call-intel";
import { generateVoiceSignature } from "@/lib/biometrics";
import { contactKey } from "@/lib/crm";
import { alertDealer } from "@/lib/error-report";
import { transcribeAudio } from "@/lib/whisper";

/**
 * No-SIP call-recording intake (the free path). An iOS Shortcut (Share Sheet → this
 * endpoint) — or the admin UI — uploads a recording captured by iOS 18.1 native Call
 * Recording / Voice Memos / in-person mic. We store the audio privately on disk,
 * use iOS's own transcript when given (else self-hosted Whisper), then run the SAME
 * analyze → log-to-CRM flow as the SIP webhook's recording_ready event.
 *
 *   POST  multipart: audio (file, optional), transcript (text, optional),
 *         caller_phone, direction(inbound|outbound), duration_sec.
 *         Auth: admin session OR Bearer/X-Calls-Token = CALLS_UPLOAD_SECRET.
 *   GET   recent recordings (admin only) for the playback list.
 */
export const runtime = "nodejs";

const MAX_BYTES = 80 * 1024 * 1024; // calls run longer than photos
const AUDIO_EXT: Record<string, string> = {
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/aac": "aac",
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/webm": "webm", "audio/wav": "wav",
  "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/3gpp": "3gp",
};

function secretAuthed(req: NextRequest): boolean {
  const secret = (process.env.CALLS_UPLOAD_SECRET || "").trim();
  if (!secret) return false;
  const got = (
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim() ||
    (req.headers.get("x-calls-token") || "").trim()
  );
  if (!got) return false;
  const a = Buffer.from(got), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // Admin session (browser) OR the shared secret (so a phone Shortcut can post
  // without a login). No auth at all → 401.
  const isAdmin = await isAdminRequest(req).catch(() => false);
  if (!isAdmin && !secretAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const phoneRaw = String(form.get("caller_phone") || form.get("phone") || "").trim().slice(0, 40);
  const direction = String(form.get("direction") || "outbound").toLowerCase() === "inbound" ? "inbound" : "outbound";
  let transcript = String(form.get("transcript") || "").trim();
  const durationSec = Math.max(0, Math.round(Number(form.get("duration_sec") || 0)) || 0);
  const audio = form.get("audio");

  // Store audio (if present) to the PRIVATE disk store (served only via the
  // admin-gated /api/admin/calls/recording/<file> route).
  let recordingFile: string | null = null;
  let audioBuffer: Buffer | null = null;
  if (audio && typeof audio === "object" && "arrayBuffer" in audio) {
    const file = audio as File;
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength === 0) return NextResponse.json({ error: "empty audio file" }, { status: 400 });
    if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ error: "audio too large" }, { status: 413 });
    audioBuffer = bytes;
    const ext =
      AUDIO_EXT[(file.type || "").toLowerCase()] ||
      file.name?.match(/\.([a-z0-9]{2,4})$/i)?.[1]?.toLowerCase().replace(/^mp4$/, "m4a") ||
      "m4a";
    const safeExt = /^(m4a|aac|mp3|webm|wav|ogg|3gp)$/.test(ext) ? ext : "m4a";
    recordingFile = `${randomUUID()}.${safeExt}`;
    try {
      const abs = safeMediaPath(`call-recordings/${recordingFile}`);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, bytes);
    } catch (e) {
      return NextResponse.json({ error: "failed to store audio", detail: String((e as Error).message).slice(0, 120) }, { status: 500 });
    }
  }

  if (!transcript && !recordingFile) {
    return NextResponse.json({ error: "provide a transcript or an audio file" }, { status: 400 });
  }

  // Insert the row with whatever we already have, then RETURN immediately. Whisper
  // transcription + AI analysis run in the BACKGROUND: a long synchronous request
  // (Whisper on CPU can take 30–90s) makes iOS / the Cloudflare tunnel drop the
  // connection ("network connection lost"). Responding in <1s avoids that; the
  // recordings page shows the call at once and fills in the transcript/summary after.
  const recordingUrl = recordingFile ? `/api/admin/calls/recording/${recordingFile}` : null;
  const needsTranscription = !transcript && !!audioBuffer;

  const supabase = createServiceClient();
  const { data: callLog, error: callError } = await supabase
    .from("calls")
    .insert({
      customer_phone: phoneRaw || null,
      direction,
      duration_sec: durationSec || null,
      recording_url: recordingUrl,
      transcript: transcript || null,
      summary: null,
      lead_score: 0,
      metadata: { source: "upload", status: needsTranscription ? "transcribing" : "analyzing" },
      voice_signature: generateVoiceSignature(audioBuffer, durationSec, phoneRaw),
    })
    .select("id")
    .single();
  if (callError) {
    return NextResponse.json({ error: `failed to log call: ${callError.message}` }, { status: 500 });
  }

  // Fire-and-forget enrichment — keeps running after the response on the long-lived
  // Vostro Node server.
  void enrichRecording({ callId: callLog.id, audioBuffer, transcript, durationSec, phoneRaw, direction });

  return NextResponse.json(
    { success: true, call_log_id: callLog.id, stored: !!recordingFile, status: "processing" },
    { status: 201 },
  );
}

/**
 * Background enrichment: transcribe (if needed) → AI-analyze → update the call row,
 * the CRM inquiry, and fire a dealer alert on a bad call. Best-effort — errors are
 * logged (the upload already returned 201) and the row is marked status:"error".
 */
async function enrichRecording(args: {
  callId: string;
  audioBuffer: Buffer | null;
  transcript: string;
  durationSec: number;
  phoneRaw: string;
  direction: string;
}) {
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

    if (analysis.metadata) {
      const lowCompliance = (analysis.metadata.compliance_score ?? 100) < 50;
      const negative = ["negative", "frustrated"].includes(analysis.metadata.sentiment);
      if (lowCompliance || negative) {
        const triggers: string[] = [];
        if (lowCompliance) triggers.push(`Low compliance (${analysis.metadata.compliance_score}%)`);
        if (negative) triggers.push(`Negative sentiment (${analysis.metadata.sentiment})`);
        await alertDealer(
          "Recorded call — review",
          [`Phone: ${args.phoneRaw || "—"}`, `Trigger: ${triggers.join(", ")}`, `Summary: ${analysis.summary}`],
          { key: `call_upload_audit:${args.callId}` },
        ).catch(() => {});
      }
    }
  } catch (e) {
    console.error("recording enrichment failed:", e);
    await supabase.from("calls").update({ metadata: { source: "upload", status: "error" } }).eq("id", args.callId);
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("calls")
    .select("id, customer_phone, direction, duration_sec, summary, lead_score, transcript, recording_url, metadata, created_at")
    .not("recording_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, recordings: data || [] });
}
