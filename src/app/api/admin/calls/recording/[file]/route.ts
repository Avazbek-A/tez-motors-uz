import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { requireAdmin } from "@/lib/auth";
import { safeMediaPath } from "@/lib/disk-store";

/**
 * Stream a stored call recording — ADMIN ONLY. Recordings are sensitive customer
 * audio, so unlike /api/media (public) they're served here behind the admin gate.
 * Files live under <media root>/call-recordings/<uuid>.<ext> (written by the
 * upload-recording endpoint); the filename is a server-generated uuid.
 */
export const runtime = "nodejs";

const MIME: Record<string, string> = {
  m4a: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg", webm: "audio/webm",
  wav: "audio/wav", ogg: "audio/ogg", "3gp": "audio/3gpp",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const { file } = await params;
  const safe = (file || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe.includes("..")) return NextResponse.json({ error: "bad file" }, { status: 400 });

  let abs: string;
  try {
    abs = safeMediaPath(`call-recordings/${safe}`);
  } catch {
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  }

  try {
    const bytes = await readFile(abs);
    const ext = (safe.split(".").pop() || "m4a").toLowerCase();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": MIME[ext] || "audio/mp4",
        "Content-Length": String(bytes.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
