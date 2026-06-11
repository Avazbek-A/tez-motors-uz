/**
 * Disk-backed media store (self-host / Vostro). Lets the app save + serve large
 * image sets from the host's local disk instead of cloud object storage — no size
 * cap, no egress cost. Used by the AutoHome enrichment: the Mac-run scraper uploads
 * photos to /api/admin/disk-image (on the Vostro, through the tunnel), which writes
 * them under IMAGE_STORE_DIR; /api/media/[...path] streams them back (Cloudflare
 * caches the immutable URLs). Node runtime only (needs fs) — i.e. the self-host
 * Vostro server, not the Workers edge.
 *
 * IMAGE_STORE_DIR should be an ABSOLUTE path OUTSIDE the git checkout so `git pull`
 * deploys don't touch it (e.g. /home/<user>/tez-motors-media). Defaults to a sibling
 * "media" dir next to the app.
 */
import { join, normalize, sep } from "node:path";

export function mediaRoot(): string {
  const d = process.env.IMAGE_STORE_DIR;
  if (d && d.trim()) return normalize(d.trim());
  return normalize(join(process.cwd(), "..", "tez-motors-media"));
}

/** Join a caller-supplied relative path to the media root, blocking traversal. */
export function safeMediaPath(rel: string): string {
  const root = mediaRoot();
  // strip any leading slashes / drive letters; normalize
  const cleaned = String(rel).replace(/^[/\\]+/, "");
  const full = normalize(join(root, cleaned));
  if (full !== root && !full.startsWith(root + sep)) throw new Error("path traversal");
  return full;
}

const MAGIC: Array<{ ext: string; mime: string; test: (b: Uint8Array) => boolean }> = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "webp", mime: "image/webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
];

/** Magic-byte sniff → {ext, mime} or null (don't trust the Content-Type header). */
export function sniffImage(bytes: Uint8Array): { ext: string; mime: string } | null {
  if (bytes.length < 12) return null;
  for (const m of MAGIC) if (m.test(bytes)) return { ext: m.ext, mime: m.mime };
  return null;
}

export const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};
