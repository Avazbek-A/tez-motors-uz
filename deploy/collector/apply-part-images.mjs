/**
 * Attach Accio-sourced supplier images to draft parts. Accio (which has direct
 * Alibaba/AliExpress access — our Vostro IP is captcha-blocked) returns image
 * URLs per part; this rehosts each onto our media disk and attaches it.
 *
 * Input  ~/subs/accio-images.json : { "<part-slug>": ["<img url>", ...], ... }
 *        (keys may also be the part's name_en — both are matched.)
 *
 *   node apply-part-images.mjs            (dry-run)
 *   node apply-part-images.mjs --write    (rehost + attach)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const IN = (process.env.HOME || "/home/rayxona") + "/subs/accio-images.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}
const env = loadEnv();
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };
const MEDIA_URL = env.SELFHOST_URL || "http://127.0.0.1:3000";
const MEDIA_SECRET = env.MEDIA_UPLOAD_SECRET || "";
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57) return "image/webp";
  return null;
}
async function rehost(url) {
  const r = await fetch(url.startsWith("//") ? "https:" + url : url, { headers: { "user-agent": UA, accept: "image/*" }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`img ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength < 6000 || bytes.byteLength > 12 * 1024 * 1024) throw new Error("size");
  const mime = sniff(bytes); if (!mime) throw new Error("not image");
  const up = await fetch(`${MEDIA_URL}/api/admin/disk-image?bucket=part-images&dir=accio`, {
    method: "POST", headers: { "content-type": mime, authorization: `Bearer ${MEDIA_SECRET}` }, body: bytes, signal: AbortSignal.timeout(30000),
  });
  if (!up.ok) throw new Error(`disk ${up.status}`);
  const j = await up.json(); if (!j.url) throw new Error("disk no url");
  return j.url;
}

async function main() {
  if (!MEDIA_SECRET) { console.error("FATAL: MEDIA_UPLOAD_SECRET unset"); process.exit(1); }
  const map = JSON.parse(readFileSync(IN, "utf8"));
  const parts = await (await fetch(`${U}/rest/v1/parts?select=id,slug,name_en&is_published=eq.false&limit=5000`, { headers: H })).json();
  const bySlug = new Map(parts.map((p) => [p.slug, p]));
  const byName = new Map(parts.map((p) => [norm(p.name_en), p]));
  let attached = 0, missed = 0;
  for (const [key, urls] of Object.entries(map)) {
    const part = bySlug.get(key) || byName.get(norm(key));
    if (!part || !Array.isArray(urls) || !urls.length) { missed++; continue; }
    const rehosted = [];
    for (const u of urls.slice(0, 5)) { try { rehosted.push(await rehost(u)); } catch { /* skip bad url */ } }
    if (!rehosted.length) { missed++; console.log(`  ✗ ${key} — no usable image`); continue; }
    if (WRITE) { const rr = await fetch(`${U}/rest/v1/parts?id=eq.${part.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ images: rehosted }) }); if (rr.ok) attached++; }
    else attached++;
    console.log(`  ✓ ${part.slug} ← ${rehosted.length} img`);
  }
  console.log(`\n${WRITE ? "attached" : "(dry) would attach"} ${attached}, missed ${missed}`);
}
main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
