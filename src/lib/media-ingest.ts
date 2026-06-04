/**
 * Media ingestion for the catalog: pull image/video URLs from a source page
 * (best-effort) and re-host chosen images to the dealer's own Supabase Storage
 * (durable, not hotlinked). Built for sourcing car photos from AutoHome and part
 * photos from Alibaba/AliExpress — but works for any URL the dealer has rights
 * to use. Admin-only; rights are the dealer's responsibility.
 *
 * Notes:
 * - Heavy anti-bot / JS-rendered sites (AutoHome CN, AliExpress) may return only
 *   og:image or a challenge page to a server fetch — hence the "paste direct
 *   image URLs" path in the UI as the reliable fallback.
 * - SSRF guard: only http(s), and private/loopback/link-local hosts are rejected.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CANDIDATES = 40;
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface MediaCandidate {
  url: string;
  type: "image" | "video";
}

/** Reject non-http(s) and private/loopback/link-local targets (basic SSRF guard). */
export function isSafeRemoteUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  // Strip IPv6 brackets so "[::1]" compares as "::1".
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return false;
  // Integer ("http://2130706433") and hex ("0x7f000001") IP encodings are
  // classic loopback/SSRF bypasses — block any all-numeric / 0x-prefixed host.
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return false;
  // IPv4 private / loopback / link-local / unspecified.
  if (/^(127\.|10\.|169\.254\.|0\.)/.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  // IPv6 loopback (::1) and unique-local (fc00::/7) — only when it's truly IPv6
  // (contains a colon), so domains like "fcbarcelona.com" aren't false-blocked.
  if (host.includes(":") && (host === "::1" || /^f[cd]/.test(host))) return false;
  return true;
}

/** Maximum redirect hops we'll chase before giving up. */
const MAX_REDIRECTS = 5;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    // Manually follow redirects so we can re-run isSafeRemoteUrl() on EACH hop.
    // `redirect: "follow"` would defeat the SSRF guard: a public attacker URL
    // can return 301 → http://169.254.169.254/… or 127.0.0.1, and the runtime's
    // automatic follow happily fetches from the private network. By doing it
    // manually we validate every Location target.
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isSafeRemoteUrl(current)) throw new Error(`unsafe redirect target after ${hop} hop(s)`);
      const res = await fetch(current, { ...init, signal: ctrl.signal, redirect: "manual" });
      if (res.status < 300 || res.status >= 400) return res;
      const loc = res.headers.get("location");
      if (!loc) return res;
      // Resolve relative redirects against the current URL.
      try { current = new URL(loc, current).toString(); } catch { throw new Error("invalid redirect Location"); }
    }
    throw new Error(`too many redirects (> ${MAX_REDIRECTS})`);
  } finally {
    clearTimeout(t);
  }
}

function abs(base: string, candidate: string): string | null {
  try {
    return new URL(candidate, base).toString();
  } catch {
    return null;
  }
}

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|m3u8)(\?|$)/i;

/**
 * Best-effort extraction of media URLs from a page's HTML — og/twitter meta,
 * JSON-LD, <img>/<source>/<video>. Regex-based (no DOM dep). Fail-open: returns
 * [] on a blocked/failed fetch so the caller can fall back to manual URLs.
 */
export async function extractMediaFromPage(pageUrl: string): Promise<MediaCandidate[]> {
  if (!isSafeRemoteUrl(pageUrl)) return [];
  let html: string;
  try {
    const res = await fetchWithTimeout(pageUrl, {
      headers: { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return [];
    html = (await res.text()).slice(0, 4_000_000); // cap parse size
  } catch {
    return [];
  }
  return parseMediaFromHtml(html, pageUrl);
}

/** Junk image URLs (icons/sprites/placeholders) to skip in the raw-URL scan. */
const JUNK_IMG = /sprite|favicon|\bicons?\b|logo|placeholder|blank[._-]|avatar|loading|1x1|spacer|pixel|\.gif/i;

/**
 * Pure HTML → media candidates. Parses og/twitter meta, JSON-LD, <img>/<source>,
 * AND does a raw-URL scan that catches image URLs embedded in inline <script>
 * JSON (lazy-load galleries on JS-heavy sites like AutoHome's autoimg.cn CDN)
 * which never appear as <img> tags in server HTML. Exported for unit tests.
 */
export function parseMediaFromHtml(html: string, pageUrl: string): MediaCandidate[] {
  const images = new Set<string>();
  const videos = new Set<string>();
  const add = (raw: string | null | undefined, set: Set<string>) => {
    if (!raw) return;
    const resolved = abs(pageUrl, raw.trim());
    if (resolved && isSafeRemoteUrl(resolved)) set.add(resolved);
  };

  // og:/twitter: meta + link rel=image_src
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)) {
    add(m[2], images);
  }
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](og:video(?::url|:secure_url)?)["'][^>]+content=["']([^"']+)["']/gi)) {
    add(m[2], videos);
  }
  for (const m of html.matchAll(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi)) {
    add(m[1], images);
  }

  // JSON-LD blocks
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(m[1].trim());
      const walk = (node: unknown) => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node === "object") {
          const o = node as Record<string, unknown>;
          for (const key of ["image", "thumbnailUrl", "contentUrl"]) {
            const v = o[key];
            if (typeof v === "string") add(v, IMAGE_EXT.test(v) || key === "image" ? images : images);
            else if (Array.isArray(v)) v.forEach((x) => typeof x === "string" && add(x, images));
            else if (v && typeof v === "object" && typeof (v as Record<string, unknown>).url === "string") add((v as Record<string, string>).url, images);
          }
          if (typeof o.contentUrl === "string" && VIDEO_EXT.test(o.contentUrl)) add(o.contentUrl, videos);
          Object.values(o).forEach(walk);
        }
      };
      walk(json);
    } catch {
      // skip malformed JSON-LD
    }
  }

  // <img src/data-src/data-original> + first srcset entry
  for (const m of html.matchAll(/<img[^>]+(?:data-src|data-original|src)=["']([^"']+)["']/gi)) {
    if (IMAGE_EXT.test(m[1])) add(m[1], images);
  }
  for (const m of html.matchAll(/srcset=["']([^"']+)["']/gi)) {
    const first = m[1].split(",")[0]?.trim().split(/\s+/)[0];
    if (first && IMAGE_EXT.test(first)) add(first, images);
  }
  // <video src> / <source src>
  for (const m of html.matchAll(/<(?:video|source)[^>]+src=["']([^"']+)["']/gi)) {
    if (VIDEO_EXT.test(m[1])) add(m[1], videos);
  }

  // Raw URL scan — last, so structured (og/jsonld/img) candidates rank first.
  // Catches image URLs embedded in inline-script JSON (AutoHome autoimg.cn,
  // AliExpress, etc.) that the tag-based passes miss. The admin selects which to
  // keep, so some noise is fine; obvious junk (icons/sprites) is filtered.
  for (const m of html.matchAll(/(?:https?:)?\/\/[^"'\s\\<>()]+?\.(?:jpe?g|png|webp)(?:\?[^"'\s\\<>()]*)?/gi)) {
    if (!JUNK_IMG.test(m[0])) add(m[0], images);
  }

  const out: MediaCandidate[] = [
    ...Array.from(images).map((url) => ({ url, type: "image" as const })),
    ...Array.from(videos).map((url) => ({ url, type: "video" as const })),
  ];
  return out.slice(0, MAX_CANDIDATES);
}

/** Identify an image strictly by magic bytes (never trust Content-Type). Only
 *  raster jpeg/png/webp pass — SVG and everything else are rejected, which
 *  blocks content-type spoofing and SVG-borne XSS in re-hosted media. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

function extForMime(mime: string): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

function randomId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Download one remote image and re-host it to a Storage bucket. Validates by
 * magic bytes (not Content-Type) and size. Returns the new public URL or throws
 * with a human-readable reason.
 */
export async function ingestImageUrl(
  supabase: SupabaseClient,
  imageUrl: string,
  opts: { bucket: string; referer?: string },
): Promise<string> {
  if (!isSafeRemoteUrl(imageUrl)) throw new Error("unsafe or invalid URL");

  const res = await fetchWithTimeout(imageUrl, {
    // A Referer is required by some CDNs (e.g. AutoHome's autoimg.cn returns 403
    // to hotlinks without one).
    headers: { "user-agent": BROWSER_UA, accept: "image/*", ...(opts.referer ? { referer: opts.referer } : {}) },
  });
  if (!res.ok) throw new Error(`source returned ${res.status}`);

  const len = Number(res.headers.get("content-length") || 0);
  if (len && len > MAX_IMAGE_BYTES) throw new Error("image too large");

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large");

  const mime = sniffImageMime(bytes);
  if (!mime || !ALLOWED_IMAGE_MIME.has(mime)) throw new Error("not a JPEG/PNG/WebP image");

  const path = `${new Date().getFullYear()}/import-${randomId()}.${extForMime(mime)}`;
  const { error } = await supabase.storage.from(opts.bucket).upload(path, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return supabase.storage.from(opts.bucket).getPublicUrl(path).data.publicUrl;
}
