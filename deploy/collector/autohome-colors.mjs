/**
 * Harvest AutoHome exterior + interior COLORS (name+hex+colorId) and a small set
 * of KEY photos per colour, into cars.spec_data.{exterior_colors,interior_colors}.
 *
 * Sources (all classic server-rendered HTML, GBK — plain fetch, no Playwright):
 *  - config page  car.autohome.com.cn/config/series/{S}.html  → `var color` (exterior)
 *    + `var innerColor` (interior): { name, value(hex), id, picnum } per colour.
 *  - per-colour exterior photos: /pic/series-{S}-{colorId}-1-{page}.html  (cat 1 = 车身外观)
 *  - per-colour interior photos: /pic/series-{S}-i{colorId}.html
 *  Photos are upsized to 1100px, hash-deduped, and SPREAD-sampled (evenly across the
 *  angle-ordered set) to the cap — diverse angles without an LLM. (--llm adds a vision
 *  pass later if a car needs it.)
 *
 * Run (Mac, recon/dry — reaches AutoHome): node autohome-colors.mjs --series=5769 --dry
 * Run (Vostro, write — DB + disk rehost):  node autohome-colors.mjs --write [--limit=N]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { translateColor } from "./cn-color-dict.mjs";

const ARGV = process.argv.slice(2);
const has = (f) => ARGV.includes(f);
const opt = (k, d = "") => (ARGV.find((a) => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const DRY = has("--dry") || !has("--write");
const ONLY_SERIES = opt("series");
const LIMIT = Number(opt("limit") || 0);
const EXT_CAP = Number(opt("ext") || 10);
const INT_CAP = Number(opt("int") || 15);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const REFERER = "https://car.autohome.com.cn/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const env = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (env.NEXT_PUBLIC_SUPABASE_URL) return env; } catch {}
  }
  return {};
}

// UTF-8 decode: the config page IS utf-8 (correct Chinese names); pic pages are
// GBK but we only extract ASCII image URLs from them, which survive utf-8 decode.
async function fetchHtml(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, referer: REFERER, accept: "text/html" }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return new TextDecoder("utf-8").decode(new Uint8Array(await r.arrayBuffer()));
}

// Pull a balanced {...} object that follows `var <name> =`.
function extractVarObject(html, name) {
  const m = html.indexOf(`var ${name}`);
  if (m < 0) return null;
  const eq = html.indexOf("=", m);
  const start = html.indexOf("{", eq);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false, q = "";
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

function colorsFrom(obj) {
  const out = new Map(); // id -> {name, hex, id, picnum}
  for (const spec of obj?.result?.specitems || []) {
    for (const c of spec.coloritems || []) {
      if (c?.id == null || out.has(c.id)) continue;
      out.set(c.id, { name_cn: String(c.name || "").trim(), hex: String(c.value || "").trim(), color_id: c.id, picnum: c.picnum || 0 });
    }
  }
  return [...out.values()].filter((c) => c.name_cn && c.hex);
}

const upsize = (u) => (u.startsWith("//") ? "https:" + u : u).replace(/\/\d{2,4}x\d{1,4}_/, "/1100x0_");
const photoHash = (u) => (u.match(/autohomecar__([A-Za-z0-9]+)/) || u.match(/([A-Za-z0-9]{20,})\.(?:jpe?g|png|webp)/i) || [, u])[1];

function cardfsFrom(html) {
  const urls = (html.match(/(?:https:)?\/\/[a-z0-9.]*autoimg\.cn\/[^"'\s)]*cardfs[^"'\s)]*\.jpg/gi) || []);
  const seen = new Set(), out = [];
  for (const raw of urls) {
    const u = upsize(raw); const h = photoHash(u);
    if (h && seen.has(h)) continue; if (h) seen.add(h);
    out.push(u);
  }
  return out;
}

// --- photo download + re-host to the Vostro disk (reuses the publish-from-targets shape) ---
function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57) return "image/webp";
  return null;
}
async function rehostToDisk(url, MEDIA_URL, MEDIA_SECRET) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "image/*", referer: REFERER }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`img ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength < 12000 || bytes.byteLength > 12 * 1024 * 1024) throw new Error("size");
  const mime = sniff(bytes); if (!mime) throw new Error("not image");
  const up = await fetch(`${MEDIA_URL}/api/admin/disk-image?bucket=car-images&dir=autohome`, {
    method: "POST", headers: { "content-type": mime, authorization: `Bearer ${MEDIA_SECRET}` }, body: bytes, signal: AbortSignal.timeout(30000),
  });
  if (!up.ok) throw new Error(`disk ${up.status}`);
  const j = await up.json(); if (!j.url) throw new Error("disk no url");
  return j.url;
}

// Evenly spread N picks across an angle-ordered list (diverse angles, no clustering).
function spread(list, n) {
  if (list.length <= n) return list;
  const step = list.length / n, out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.floor(i * step)]);
  return out;
}

async function picsForColor(series, colorId, kind) {
  // INTERIOR per-colour galleries are JS-rendered on AutoHome: the static
  // /pic/series-{S}-i{colorId}.html page carries only unrelated recommendation
  // thumbnails (which is exactly how exterior shots leaked into the interior sets).
  // There is no reliable per-interior-colour photo source in the static HTML, so
  // interior is swatch-only (name + hex, no gallery). Exterior is unaffected.
  if (kind !== "ext") return [];
  // Exterior category 1 (车身外观) — the real per-colour gallery, in static HTML.
  let html = "";
  try { html = await fetchHtml(`https://car.autohome.com.cn/pic/series-${series}-${colorId}-1-1.html`); } catch { return []; }
  // Deliberately NO fallback to the generic /pic/series-{S}-{colorId}.html page —
  // that page mixes interior + exterior and would pollute the exterior set.
  return spread(cardfsFrom(html), EXT_CAP);
}

async function main() {
  const env = loadEnv();
  const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
  const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };
  const MEDIA_URL = opt("media", env.SELFHOST_URL || "http://127.0.0.1:3000");
  const MEDIA_SECRET = env.MEDIA_UPLOAD_SECRET || "";
  const FORCE = has("--force");

  let cars;
  if (ONLY_SERIES) {
    cars = [{ id: null, slug: `series-${ONLY_SERIES}`, spec_data: { series_id: Number(ONLY_SERIES) } }];
  } else {
    cars = await (await fetch(`${U}/rest/v1/cars?select=id,slug,spec_data&limit=400`, { headers: H })).json();
    cars = cars.filter((c) => c.spec_data && c.spec_data.series_id);
    if (LIMIT) cars = cars.slice(0, LIMIT);
  }
  console.log(`cars: ${cars.length} | mode: ${DRY ? "DRY (no write)" : "WRITE"} | caps ext=${EXT_CAP} int=${INT_CAP}\n`);

  for (const c of cars) {
    const S = c.spec_data.series_id;
    if (!DRY && !FORCE && c.id && c.spec_data?.exterior_colors?.length) { console.log(`${c.slug}: skip (already has colors)`); continue; }
    try {
      const cfg = await fetchHtml(`https://car.autohome.com.cn/config/series/${S}.html`);
      const ext = colorsFrom(extractVarObject(cfg, "color"));
      const int = colorsFrom(extractVarObject(cfg, "innerColor"));
      console.log(`${c.slug} (series ${S}): ${ext.length} exterior, ${int.length} interior colors`);
      for (const col of ext) { col.images = await picsForColor(S, col.color_id, "ext"); await sleep(200); console.log(`  EXT ${col.name_cn} ${col.hex} → ${col.images.length} photos`); }
      for (const col of int) { col.images = await picsForColor(S, col.color_id, "int"); await sleep(200); console.log(`  INT ${col.name_cn} ${col.hex} → ${col.images.length} photos`); }
      // translate colour names (RU/UZ/EN) — free hand-built dict, no LLM
      for (const col of [...ext, ...int]) Object.assign(col, translateColor(col.name_cn));
      if (DRY) {
        try { writeFileSync(`/tmp/colors-${S}.json`, JSON.stringify({ exterior_colors: ext, interior_colors: int }, null, 1)); console.log(`  → /tmp/colors-${S}.json`); } catch {}
        continue;
      }
      // WRITE: re-host each colour's photos to the Vostro disk, then PATCH spec_data
      let n = 0;
      for (const col of [...ext, ...int]) {
        const local = [];
        for (const u of col.images || []) { try { local.push(await rehostToDisk(u, MEDIA_URL, MEDIA_SECRET)); n++; } catch {} }
        col.images = local;
        delete col.picnum;
      }
      const spec = { ...(c.spec_data || {}), exterior_colors: ext, interior_colors: int };
      const pr = await fetch(`${U}/rest/v1/cars?id=eq.${c.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ spec_data: spec }) });
      console.log(`  → PATCH ${pr.status} (${n} photos re-hosted)`);
    } catch (e) { console.log(`${c.slug} (series ${S}): ERROR ${e.message}`); }
    await sleep(400);
  }
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
