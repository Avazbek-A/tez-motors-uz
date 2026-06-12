/**
 * Disk-image upload (self-host / Vostro). Accepts raw image bytes and writes them
 * under IMAGE_STORE_DIR (served back by /api/media/...). Lets the off-box AutoHome
 * scraper deposit hi-res photos onto the host's own disk — no cloud storage cap.
 *
 * Auth: Bearer MEDIA_UPLOAD_SECRET (constant-time). Feature is OFF (503) until the
 * secret is set. Validates by MAGIC BYTES (not Content-Type), caps size, and writes
 * to a server-generated uuid path (no caller-controlled filename → no traversal).
 * Node runtime (fs) — the Vostro server, not the Workers edge.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { mediaRoot, safeMediaPath, sniffImage } from "@/lib/disk-store";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;
const MIN_BYTES = 8 * 1024;
// Only these logical buckets may be written to.
const BUCKETS = new Set(["car-images", "part-images"]);

function authed(req: NextRequest): boolean {
  const secret = process.env.MEDIA_UPLOAD_SECRET || "";
  if (!secret) return false;
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!process.env.MEDIA_UPLOAD_SECRET) return NextResponse.json({ error: "disk store disabled" }, { status: 503 });
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket") || "car-images";
  const sub = (url.searchParams.get("dir") || "autohome").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "autohome";
  if (!BUCKETS.has(bucket)) return NextResponse.json({ error: "bad bucket" }, { status: 400 });

  const len = Number(req.headers.get("content-length") || 0);
  if (len && len > MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength < MIN_BYTES) return NextResponse.json({ error: "too small" }, { status: 400 });
  if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });

  const kind = sniffImage(bytes);
  if (!kind) return NextResponse.json({ error: "not an image" }, { status: 415 });

  const rel = `${bucket}/${sub}/${randomUUID()}.${kind.ext}`;
  let abs: string;
  try { abs = safeMediaPath(rel); } catch { return NextResponse.json({ error: "bad path" }, { status: 400 }); }
  try {
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
  } catch (e) {
    return NextResponse.json({ error: "write failed", detail: String((e as Error).message).slice(0, 120) }, { status: 500 });
  }

  // Return a ROOT-RELATIVE URL: resolves to whatever origin serves the page —
  // localhost now (photos on the Mac), tezmotors.uz after the media folder is copied
  // to the Vostro. No DB rewrite needed on transfer. (Absolute opt-in via ?absolute=1.)
  void mediaRoot();
  const rootRel = `/api/media/${rel}`;
  const absolute = url.searchParams.get("absolute") === "1";
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `${url.protocol}//${url.host}`;
  return NextResponse.json({ ok: true, url: absolute ? `${base}${rootRel}` : rootRel, bytes: bytes.byteLength, mime: kind.mime });
}
