/**
 * Enrich catalog cars with AutoHome GLOBAL (en-hk) data: full multi-trim
 * parameter spec_data + real manufacturer gallery photos. Clean path only —
 * plain JSON fetch against AutoHome's Next.js data API, NO browser / vision /
 * extractor needed:
 *
 *   homepage __NEXT_DATA__         → buildId + brandList (English names → brandId)
 *   /_next/data/{b}/en-hk/brand/{brandId}.json        → that brand's series list
 *   /_next/data/{b}/en-hk/config/series/{seriesId}.json → initData{bread,titlelist,datalist}
 *   /en-hk/image/series/{seriesId} (server HTML)      → autoimg.cn gallery photos
 *
 * Spec is shaped exactly like src/lib/autohome-spec.ts parseGlobalAutohome().
 * Gallery photos are re-hosted into Supabase (autoimg.cn 403s hotlinks without a
 * Referer; we send one). Matching is brand(English)→series(English name) — only
 * confident matches are written; everything else is left untouched (no fabrication).
 *
 *   node scripts/autohome-enrich-cars.mjs            # all cars missing spec_data
 *   node scripts/autohome-enrich-cars.mjs --all      # re-enrich every car
 *   node scripts/autohome-enrich-cars.mjs --dry      # match + report, no writes
 *   node scripts/autohome-enrich-cars.mjs --limit=5
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const H = { "user-agent": UA, accept: "text/html,application/json" };
const REFERER = "https://global.autohome.com/";
const MAX_GALLERY = 8;
const MIN_PHOTO_BYTES = 15_000;

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes("--dry");
const ALL = ARGS.includes("--all");
const LIMIT = Number((ARGS.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);

// Brand-name aliases: our catalog name → AutoHome global English name.
const BRAND_ALIAS = {
  "great wall": "gwm",
  "li auto": "li",
  jetour: "jetour",
};

function loadEnv() {
  const env = {};
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// --- spec_data shaping (port of parseGlobalAutohome) ---
function trimPrice(t) {
  const f = (t.formatPrice || "").trim();
  if (f && !/no quotation|暂无|n\/a/i.test(f)) return f;
  if (typeof t.price === "number" && t.price > 0) return `${t.priceUnit || ""}${t.price.toLocaleString("en-US")}`.trim();
  return null;
}

function buildSpec(init, sourceUrl) {
  const titlelist = Array.isArray(init.titlelist) ? init.titlelist : [];
  const datalist = Array.isArray(init.datalist) ? init.datalist : [];
  if (!titlelist.length || !datalist.length) return null;
  const groups = titlelist.map((g) => (g.itemType || "").trim()).filter(Boolean);
  const trims = datalist.map((t, ti) => {
    const byTitle = new Map();
    for (const p of t.paramconfList ?? []) {
      if (typeof p.titleId === "number" && p.itemName != null) byTitle.set(p.titleId, String(p.itemName));
    }
    const params = {};
    for (const g of titlelist) {
      const gName = (g.itemType || "").trim();
      if (!gName) continue;
      const section = {};
      for (const it of g.items ?? []) {
        const pName = (it.itemName || "").trim();
        if (!pName) continue;
        let v = null;
        if (Array.isArray(it.values) && it.values[ti] != null) v = String(it.values[ti]);
        else if (typeof it.titleId === "number" && byTitle.has(it.titleId)) v = byTitle.get(it.titleId);
        if (v != null && v !== "" && v !== "-") section[pName] = v;
      }
      if (Object.keys(section).length) params[gName] = section;
    }
    return { name: (t.specName || `Trim ${ti + 1}`).trim(), price_raw: trimPrice(t), year: t.year || null, params };
  });
  return {
    source: "global",
    source_url: sourceUrl,
    captured_at: new Date().toISOString(),
    brand: init.bread?.brandName?.trim(),
    model: init.bread?.seriesName?.trim(),
    series_id: typeof init.bread?.seriesId === "number" ? init.bread.seriesId : undefined,
    groups,
    trims,
  };
}

// --- image re-host (magic-byte sniff + Referer bypass) ---
function sniffMime(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
const extFor = (m) => (m === "image/jpeg" ? "jpg" : m === "image/png" ? "png" : "webp");

async function rehost(sb, url, seriesId) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "image/*", referer: REFERER }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`img ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength < MIN_PHOTO_BYTES) throw new Error("too small");
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("too large");
  const mime = sniffMime(bytes);
  if (!mime) throw new Error("not an image");
  const path = `autohome/${seriesId}-${Math.random().toString(36).slice(2, 10)}.${extFor(mime)}`;
  const up = await sb.storage.from("car-images").upload(path, bytes, { contentType: mime, cacheControl: "31536000", upsert: false });
  if (up.error) throw new Error(up.error.message);
  return sb.storage.from("car-images").getPublicUrl(path).data.publicUrl;
}

async function galleryUrls(seriesId) {
  try {
    const r = await fetch(`https://global.autohome.com/en-hk/image/series/${seriesId}`, { headers: H, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return [];
    const html = await r.text();
    const set = new Set();
    for (const m of html.matchAll(/https?:\/\/[^"'\s)]*autoimg\.cn[^"'\s)]*?\.(?:jpe?g|png|webp)/gi)) set.add(m[0]);
    return [...set];
  } catch {
    return [];
  }
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Bootstrap AutoHome: buildId + brand map.
  const home = await (await fetch("https://global.autohome.com/en-hk", { headers: H })).text();
  const nd = JSON.parse(home.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const buildId = nd.buildId;
  const brandMap = new Map(); // normalized English name -> brandId
  for (const b of nd.props.pageProps.brandList || []) brandMap.set(norm(b.brandEnglishName), b.brandId);
  console.log(`AutoHome buildId ${buildId}, ${brandMap.size} brands`);

  const seriesCache = new Map(); // brandId -> [{seriesId, name}]
  async function brandSeries(brandId) {
    if (seriesCache.has(brandId)) return seriesCache.get(brandId);
    let arr = [];
    try {
      const j = await getJson(`https://global.autohome.com/_next/data/${buildId}/en-hk/brand/${brandId}.json`);
      const find = (o, d = 0) => {
        if (!o || d > 5) return null;
        if (Array.isArray(o) && o[0] && (o[0].seriesId || o[0].seriesName)) return o;
        if (typeof o === "object") for (const v of Object.values(o)) { const r = find(v, d + 1); if (r) return r; }
        return null;
      };
      arr = (find(j.pageProps) || []).map((s) => ({ seriesId: s.seriesId, name: s.seriesEnglishName || s.seriesName }));
    } catch { /* none */ }
    seriesCache.set(brandId, arr);
    return arr;
  }

  let q = sb.from("cars").select("id,brand,model,year,images,spec_data");
  const { data: cars, error } = await q;
  if (error) throw error;
  let pool = ALL ? cars : cars.filter((c) => !c.spec_data);
  if (LIMIT) pool = pool.slice(0, LIMIT);
  console.log(`${pool.length} car(s) to process${DRY ? " (dry run)" : ""}\n`);

  const stats = { matched: 0, specWritten: 0, imagesAdded: 0, noBrand: 0, noSeries: 0 };

  for (const car of pool) {
    const brandKey = norm(car.brand);
    const brandId = brandMap.get(brandKey) ?? brandMap.get(norm(BRAND_ALIAS[brandKey] || ""));
    if (!brandId) { stats.noBrand++; console.log(`· ${car.brand} ${car.model} — brand not on global, skip`); continue; }

    const series = await brandSeries(brandId);
    const cm = norm(car.model);
    // Match: series name normalized contains the model tokens, or vice versa.
    const match = series.find((s) => {
      const sn = norm(s.name).replace(brandKey, "").trim();
      return sn && (sn === cm || sn.includes(cm) || cm.includes(sn));
    });
    if (!match) { stats.noSeries++; console.log(`· ${car.brand} ${car.model} — no series match (${series.length} candidates), skip`); continue; }

    stats.matched++;
    let spec = null;
    try {
      const j = await getJson(`https://global.autohome.com/_next/data/${buildId}/en-hk/config/series/${match.seriesId}.json`);
      spec = buildSpec(j.pageProps?.initData || {}, `https://global.autohome.com/en-hk/config/series/${match.seriesId}`);
    } catch (e) { console.log(`  ! spec fetch failed: ${e.message}`); }

    const params = spec ? spec.trims.reduce((a, t) => a + Object.values(t.params).reduce((x, g) => x + Object.keys(g).length, 0), 0) : 0;
    console.log(`✓ ${car.brand} ${car.model} → series ${match.seriesId} "${match.name}"${spec ? ` | ${spec.trims.length} trims, ${params} params` : " | no spec"}`);

    // Gallery → re-host (skip in dry run).
    let newImages = [];
    if (!DRY) {
      const urls = (await galleryUrls(match.seriesId)).slice(0, MAX_GALLERY * 3);
      for (const u of urls) {
        if (newImages.length >= MAX_GALLERY) break;
        try { newImages.push(await rehost(sb, u, match.seriesId)); } catch { /* skip bad/small */ }
      }
      console.log(`    re-hosted ${newImages.length} AutoHome photos`);
    }

    if (!DRY) {
      const existing = Array.isArray(car.images) ? car.images : [];
      const mergedImages = [...new Set([...newImages, ...existing])].slice(0, 14);
      const update = {};
      if (spec) { update.spec_data = spec; update.spec_captured_at = new Date().toISOString(); }
      if (newImages.length) update.images = mergedImages;
      if (Object.keys(update).length) {
        const { error: upErr } = await sb.from("cars").update(update).eq("id", car.id);
        if (upErr) console.log(`  ! update failed: ${upErr.message}`);
        else { if (spec) stats.specWritten++; stats.imagesAdded += newImages.length; }
      }
    }
    await sleep(600); // be gentle
  }

  console.log(`\n── done ──`);
  console.log(`matched: ${stats.matched} | spec written: ${stats.specWritten} | photos added: ${stats.imagesAdded}`);
  console.log(`skipped — brand not on global: ${stats.noBrand} | no series match: ${stats.noSeries}`);
}

main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
