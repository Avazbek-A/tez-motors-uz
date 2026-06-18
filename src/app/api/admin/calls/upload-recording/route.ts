import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { unlink } from "node:fs/promises";
import { isAdminRequest, requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { safeMediaPath } from "@/lib/disk-store";
import { logRecording } from "@/lib/call-recording";

/**
 * No-SIP call-recording intake (the free path). An iOS Shortcut — or the admin UI —
 * uploads a recording (iOS 18.1 native Call Recording / Voice Memos / mic). The
 * actual store→transcribe→analyze→CRM pipeline lives in src/lib/call-recording.ts
 * (shared with the Telegram bot). This route just authenticates + parses the body.
 *
 *   POST: multipart {audio, transcript, caller_phone, direction, duration_sec}, OR a
 *         raw audio body (?caller_phone=&direction=), OR a raw text body = transcript.
 *         Auth: admin session OR Bearer/X-Calls-Token = CALLS_UPLOAD_SECRET.
 *   GET:  recent recordings (admin only) for the playback list.
 */
export const runtime = "nodejs";

function secretAuthed(req: NextRequest): boolean {
  const secret = (process.env.CALLS_UPLOAD_SECRET || "").trim();
  if (!secret) return false;
  const got =
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim() ||
    (req.headers.get("x-calls-token") || "").trim();
  if (!got) return false;
  const a = Buffer.from(got), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const isAdmin = await isAdminRequest(req).catch(() => false);
  if (!isAdmin && !secretAuthed(req)) {
    console.log("[upload-recording] 401 — no admin session and bad/missing CALLS_UPLOAD_SECRET");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const qp = new URL(req.url).searchParams;
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  let phoneRaw = "";
  let direction: "inbound" | "outbound" = "outbound";
  let transcript = "";
  let durationSec = 0;
  let audioBuffer: Buffer | null = null;
  let audioName = "";
  let audioType = "";

  if (ct.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "could not read multipart form" }, { status: 400 });
    }
    phoneRaw = String(form.get("caller_phone") || form.get("phone") || "");
    direction = String(form.get("direction") || "outbound").toLowerCase() === "inbound" ? "inbound" : "outbound";
    transcript = String(form.get("transcript") || "").trim();
    durationSec = Number(form.get("duration_sec") || 0) || 0;
    const audio = form.get("audio");
    if (audio && typeof audio === "object" && "arrayBuffer" in audio) {
      const file = audio as File;
      audioBuffer = Buffer.from(await file.arrayBuffer());
      audioName = file.name || "";
      audioType = (file.type || "").toLowerCase();
    }
  } else {
    // Raw-body modes: metadata in the query string. text/* (or json) body = the
    // transcript (tiny, reliable on flaky links); any other body = the audio.
    phoneRaw = String(qp.get("caller_phone") || qp.get("phone") || "");
    direction = String(qp.get("direction") || "outbound").toLowerCase() === "inbound" ? "inbound" : "outbound";
    transcript = String(qp.get("transcript") || "").trim();
    durationSec = Number(qp.get("duration_sec") || 0) || 0;
    const raw = Buffer.from(await req.arrayBuffer());
    if (ct.startsWith("text/") || ct.includes("json")) {
      if (!transcript) transcript = raw.toString("utf8").trim().slice(0, 20000);
    } else if (raw.byteLength > 0) {
      audioBuffer = raw;
      audioType = ct;
    }
  }

  console.log(
    `[upload-recording] auth=${isAdmin ? "session" : "secret"} mode=${ct.includes("multipart") ? "form" : "raw"} ` +
    `audio=${audioBuffer ? audioBuffer.byteLength + "b" : "none"} transcript=${transcript ? transcript.length + "ch" : "none"} phone="${phoneRaw.trim()}"`,
  );

  try {
    // Respond fast — enrichment (Whisper + analysis) runs in the background so a long
    // request never makes the client drop the connection.
    const { callId, recordingUrl } = await logRecording({
      audioBuffer, audioType, audioName, transcript, phone: phoneRaw, direction, durationSec, awaitEnrich: false,
    });
    return NextResponse.json({ success: true, call_log_id: callId, stored: !!recordingUrl, status: "processing" }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || "upload failed";
    const status = msg.includes("too large") ? 413 : msg.includes("no audio") ? 400 : 500;
    console.log(`[upload-recording] ${status} — ${msg}`);
    return NextResponse.json({ error: msg }, { status });
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

/** Delete a recording (admin only): removes the audio file from disk + the call row. */
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !/^[a-f0-9-]{1,64}$/i.test(id)) {
    return NextResponse.json({ error: "missing or invalid id" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data: row } = await supabase.from("calls").select("recording_url").eq("id", id).maybeSingle();
  const file = (row?.recording_url || "").split("/").pop() || "";
  if (file && /^[a-zA-Z0-9._-]+$/.test(file) && !file.includes("..")) {
    try {
      await unlink(safeMediaPath(`call-recordings/${file}`));
    } catch {
      // already gone — fine
    }
  }
  const { error } = await supabase.from("calls").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
