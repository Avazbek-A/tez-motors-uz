import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per image
const MAX_IMAGES_PER_REQUEST = 100;
const FETCH_TIMEOUT_MS = 15000;

function isSupabasePublicUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(base && url.startsWith(`${base}/storage/v1/object/public/`));
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Walk every part's `images` array. Any URL that isn't already served from
 * our Supabase Storage bucket is downloaded, uploaded into `part-images`,
 * and its entry rewritten to the public URL we host.
 *
 * Request body (all optional):
 *   { part_ids?: string[] }   // restrict to specific parts
 *
 * Response:
 *   { scanned, mirrored, unchanged, errors[] }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: { part_ids?: string[] } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = createServiceClient();

  let query = supabase.from("parts").select("id, slug, images");
  if (body.part_ids?.length) query = query.in("id", body.part_ids);

  const { data: parts, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const report = {
    scanned: 0,
    mirrored: 0,
    unchanged: 0,
    errors: [] as Array<{ part_slug: string; url: string; message: string }>,
  };

  let processedUrls = 0;

  for (const part of parts ?? []) {
    if (!part.images?.length) continue;

    const newImages: string[] = [];
    let changed = false;

    for (const original of part.images as string[]) {
      report.scanned += 1;

      if (isSupabasePublicUrl(original)) {
        newImages.push(original);
        report.unchanged += 1;
        continue;
      }

      if (processedUrls >= MAX_IMAGES_PER_REQUEST) {
        // Budget exceeded — keep the URL as-is; the admin can re-run.
        newImages.push(original);
        report.errors.push({
          part_slug: part.slug,
          url: original,
          message: `per-request limit (${MAX_IMAGES_PER_REQUEST}) reached; re-run to continue`,
        });
        continue;
      }
      processedUrls += 1;

      try {
        if (!/^https?:\/\//i.test(original)) {
          throw new Error("not an http(s) URL");
        }

        const res = await fetchWithTimeout(original);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
        if (!ALLOWED_MIME.has(mime)) {
          throw new Error(`unsupported mime: ${mime || "unknown"}`);
        }

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength === 0) throw new Error("empty body");
        if (buf.byteLength > MAX_BYTES) throw new Error(`too large (${buf.byteLength} B)`);

        const ext = extensionForMime(mime);
        const stamp = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const path = `${part.slug}/${stamp}-${rand}.${ext}`;

        const upload = await supabase.storage
          .from("part-images")
          .upload(path, buf, { contentType: mime, upsert: false });
        if (upload.error) throw new Error(upload.error.message);

        const { data: pub } = supabase.storage.from("part-images").getPublicUrl(path);
        if (!pub?.publicUrl) throw new Error("failed to resolve public URL");

        newImages.push(pub.publicUrl);
        report.mirrored += 1;
        changed = true;
      } catch (e) {
        // On failure, keep the original URL so the part still has an image,
        // and record the error.
        newImages.push(original);
        report.errors.push({
          part_slug: part.slug,
          url: original,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (changed) {
      const { error: upErr } = await supabase
        .from("parts")
        .update({ images: newImages })
        .eq("id", part.id);
      if (upErr) {
        report.errors.push({
          part_slug: part.slug,
          url: "(update)",
          message: upErr.message,
        });
      }
    }
  }

  return NextResponse.json(report);
}
