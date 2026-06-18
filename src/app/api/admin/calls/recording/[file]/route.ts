import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { open, readFile, stat } from "node:fs/promises";
import { requireAdmin } from "@/lib/auth";
import { safeMediaPath } from "@/lib/disk-store";
import { parseRange } from "@/lib/http-range";

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

  const ext = (safe.split(".").pop() || "m4a").toLowerCase();
  const ctype = MIME[ext] || "audio/mp4";

  let size: number;
  try {
    size = (await stat(abs)).size;
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Honour HTTP Range requests so the audio player can seek without re-downloading
  // the whole file, and so a large recording isn't read entirely into memory per play.
  const range = parseRange(req.headers.get("range"), size);
  try {
    if (range) {
      const len = range.end - range.start + 1;
      const fh = await open(abs, "r");
      try {
        const buf = Buffer.alloc(len);
        await fh.read(buf, 0, len, range.start);
        return new Response(new Uint8Array(buf), {
          status: 206,
          headers: {
            "Content-Type": ctype,
            "Content-Length": String(len),
            "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, no-store",
          },
        });
      } finally {
        await fh.close();
      }
    }

    const bytes = await readFile(abs);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": ctype,
        "Content-Length": String(bytes.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
