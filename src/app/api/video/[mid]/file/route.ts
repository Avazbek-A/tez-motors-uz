/**
 * Serve a locally-cached AutoHome overview mp4 from the Vostro disk
 * (IMAGE_STORE_DIR/videos/{mid}.mp4) — fast from Uzbekistan via the tunnel,
 * instead of streaming from AutoHome's China CDN. Supports HTTP Range so
 * seeking works and iOS Safari can play. 404 if the file isn't cached (the
 * player then falls back to the direct AutoHome URL). Node runtime (fs).
 */
import type { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { safeMediaPath } from "@/lib/disk-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ mid: string }> }) {
  const { mid } = await params;
  if (!/^[A-Fa-f0-9]{16,48}$/.test(mid)) return new Response("bad", { status: 400 });

  let file: string;
  try {
    file = safeMediaPath(`videos/${mid}.mp4`);
  } catch {
    return new Response("not found", { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("not found", { status: 404 });
    size = info.size;
  } catch {
    return new Response("not found", { status: 404 });
  }

  const baseHeaders: Record<string, string> = {
    "content-type": "video/mp4",
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
  };

  const range = req.headers.get("range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m) {
    let start = m[1] ? parseInt(m[1], 10) : 0;
    let end = m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      return new Response("range not satisfiable", {
        status: 416,
        headers: { "content-range": `bytes */${size}` },
      });
    }
    end = Math.min(end, size - 1);
    const stream = createReadStream(file, { start, end });
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "content-range": `bytes ${start}-${end}/${size}`,
        "content-length": String(end - start + 1),
      },
    });
  }

  const stream = createReadStream(file);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "content-length": String(size) },
  });
}
