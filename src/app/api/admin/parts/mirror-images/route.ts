import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { isSafeRemoteUrl, sniffImageMime } from "@/lib/media-ingest";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per image
const MAX_IMAGES_PER_REQUEST = 100;
const FETCH_TIMEOUT_MS = 15000;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Same-origin Referer — bypasses hotlink protection (Alibaba alicdn, AutoHome
 *  autoimg, etc. 403 image hotlinks that arrive without one). */
function refererFor(url: string): string | undefined {
  try {
    return `${new URL(url).origin}/`;
  } catch {
    return undefined;
  }
}

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

/** Maximum redirect hops we'll chase before giving up. */
const MAX_REDIRECTS = 5;

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    // SECURITY: manually follow redirects so we can re-run isSafeRemoteUrl on
    // EACH hop. `redirect: "follow"` would defeat the SSRF guard — a public
    // attacker URL can return 301 → http://169.254.169.254/... or http://10.0.0.1/...
    // and the runtime's automatic follow would happily fetch from the private
    // network on our behalf. The Referer is recomputed per hop because hotlink
    // CDNs key on the immediate origin, not the original one.
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isSafeRemoteUrl(current)) throw new Error(`unsafe redirect target after ${hop} hop(s)`);
      const referer = refererFor(current);
      const res = await fetch(current, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: { "user-agent": BROWSER_UA, accept: "image/*", ...(referer ? { referer } : {}) },
      });
      if (res.status < 300 || res.status >= 400) return res;
      const loc = res.headers.get("location");
      if (!loc) return res;
      try { current = new URL(loc, current).toString(); } catch { throw new Error("invalid redirect Location"); }
    }
    throw new Error(`too many redirects (> ${MAX_REDIRECTS})`);
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
        // SSRF guard: only http(s), reject private/loopback/link-local hosts
        // before we fetch an admin-supplied URL into our own storage.
        if (!isSafeRemoteUrl(original)) {
          throw new Error("unsafe or non-http(s) URL");
        }

        const res = await fetchWithTimeout(original);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength === 0) throw new Error("empty body");
        if (buf.byteLength > MAX_BYTES) throw new Error(`too large (${buf.byteLength} B)`);

        // SECURITY: trust the bytes, not the headers. A remote server can
        // claim Content-Type: image/png and serve arbitrary bytes; sniff the
        // magic bytes instead so we never upload non-image content labeled
        // as an image into our public bucket.
        const sniffed = sniffImageMime(buf);
        const headerMime = (res.headers.get("content-type") || "").split(";")[0].trim();
        // sniffImageMime only knows jpeg/png/webp; accept GIF only when the
        // header agrees AND the alleged GIF starts with the standard signature.
        const mime =
          sniffed ||
          (headerMime === "image/gif" && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46
            ? "image/gif"
            : null);
        if (!mime || !ALLOWED_MIME.has(mime)) {
          throw new Error(`unsupported mime: header=${headerMime || "unknown"} sniff=${sniffed || "unknown"}`);
        }

        const ext = extensionForMime(mime);
        const stamp = Date.now();
        // Web-Crypto random — Math.random has ~30 bits of state per call; at
        // bulk-mirror scale (100 images per run × parts × runs) birthday
        // collisions on a 6-char base36 path are plausible. Use a proper PRNG.
        const randBytes = new Uint8Array(4);
        crypto.getRandomValues(randBytes);
        const rand = Array.from(randBytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
