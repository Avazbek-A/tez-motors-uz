/**
 * Serve disk-stored media (self-host / Vostro). Streams files written under
 * IMAGE_STORE_DIR by /api/admin/disk-image. URLs are immutable (uuid filenames),
 * so Cloudflare caches them at the edge after the first hit — the Vostro serves
 * each image at most once. Node runtime (fs). 404 on miss / traversal.
 */
import type { NextRequest } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { safeMediaPath, MIME_BY_EXT } from "@/lib/disk-store";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  let file: string;
  try {
    file = safeMediaPath((path || []).join("/"));
  } catch {
    return new Response("Not found", { status: 404 });
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const ext = (file.split(".").pop() || "").toLowerCase();
    const bytes = await readFile(file);
    return new Response(bytes, {
      headers: {
        "content-type": MIME_BY_EXT[ext] || "application/octet-stream",
        "content-length": String(info.size),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
