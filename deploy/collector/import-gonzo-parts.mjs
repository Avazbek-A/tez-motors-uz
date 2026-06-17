/**
 * Import the Gonzo-scraped catalogue (~/subs/gonzo-parts.json) into the `parts`
 * table as reviewable DRAFTS (is_published=false). Replaces the OLX pipeline.
 *
 *   - price: Gonzo's price is the REFERENCE (stored in original_price_usd); our
 *     price_usd undercuts it ~8% (UNDERCUT_PCT). UZS prices → USD via FX.
 *   - brand/model: parsed from the breadcrumb + name; category classified from
 *     the part name → the parts.category enum.
 *   - images: left EMPTY here — source-part-images.mjs fills supplier/OEM photos
 *     (never Gonzo's). Drafts stay unpublished until they have an image + review.
 *   - names: Gonzo's name goes into name_ru as a starting point; parts-llm-clean
 *     rewrites fresh trilingual names + descriptions before publish.
 *
 *   node import-gonzo-parts.mjs            (dry-run: prints what it would insert)
 *   node import-gonzo-parts.mjs --write    (insert drafts)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const UNDERCUT_PCT = 8;        // we sit ~8% under Gonzo
const USD_UZS = 12600;         // fallback FX for any UZS-priced part
const IN = (process.env.HOME || "/home/rayxona") + "/subs/gonzo-parts.json";

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}
const env = loadEnv();
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };

// Brand spelling normalization (match our car catalogue).
const BRAND_ALIAS = { lixiang: "Li Auto", "li xiang": "Li Auto", byd: "BYD", zeekr: "Zeekr", bmw: "BMW", neta: "Neta", hongqi: "Hongqi", changan: "Changan", "li auto": "Li Auto" };
const normBrand = (b) => { const k = (b || "").trim().toLowerCase(); return BRAND_ALIAS[k] || (b ? b.trim() : null); };

// Part name (RU) → parts.category enum.
function classify(nameRu) {
  const s = (nameRu || "").toLowerCase();
  if (/фар|фонар|оптик|лампа|габарит|птф|led|диод/.test(s)) return "electrical";
  if (/пневмо|стойк|амортизатор|подвеск|рычаг|пружин|сайлентблок|шаров/.test(s)) return "suspension";
  if (/тормоз|колодк|суппорт|диск\s*тормоз/.test(s)) return "brakes";
  if (/двигател|мотор\b|радиатор|насос|фильтр|свеч|турбин|грм|ремень/.test(s)) return "engine";
  if (/салон|сидень|руль|торпед|обшивк|панель приборов|подлокотник|коврик/.test(s)) return "interior";
  if (/бампер|крыл|капот|двер|багажник|спойлер|порог|молдинг|решётк|решетк|зеркал|стекл|лобов|кузов|крышк/.test(s)) return "body";
  return "other";
}

// Pull "BRAND MODEL" out of a name like "Передний бампер для BYD Han".
function brandModel(name, crumbBrand) {
  const brand = normBrand(crumbBrand) || (name.match(/\b(BYD|Zeekr|Lixiang|Li Auto|BMW|Neta|Hongqi|Changan)\b/i)?.[1] || null);
  let model = null;
  if (brand) {
    const re = new RegExp(`${brand.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s+([\\w-]+(?:\\s*\\d+)?)`, "i");
    const m = name.match(re) || name.match(new RegExp(`(?:для|на|for)\\s+${brand}\\s+([\\w-]+\\s*\\d*)`, "i"));
    if (m) model = m[1].trim();
  }
  return { brand: normBrand(brand), model: model ? model.replace(/\s+/g, " ").trim() : null };
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9а-я]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 70);
const translit = (s) => s.replace(/[а-яё]/gi, (c) => ({ а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" }[c.toLowerCase()] || c));

function main() {
  const raw = JSON.parse(readFileSync(IN, "utf8"));
  const seen = new Set();
  const rows = [];
  let skipped = 0;
  for (const p of raw) {
    if (!p.name || !p.price || p.error) { skipped++; continue; }
    const name = p.name.replace(/\s+/g, " ").trim();
    const { brand, model } = brandModel(name, p.brand);
    const priceUsd = p.currency === "UZS" ? p.price / USD_UZS : p.price;
    if (!(priceUsd > 0)) { skipped++; continue; }
    const gonzo = Math.round(priceUsd);
    const ours = Math.round(priceUsd * (1 - UNDERCUT_PCT / 100));
    const baseSlug = slugify(translit(`${brand || ""} ${name}`)) || slugify(translit(name));
    let slug = baseSlug, i = 2;
    while (seen.has(slug)) slug = `${baseSlug}-${i++}`;
    seen.add(slug);
    rows.push({
      slug,
      name_ru: name.slice(0, 200),
      category: classify(name),
      brand: brand || null,
      price_usd: ours,
      original_price_usd: gonzo,   // Gonzo reference → UI shows strike-through
      images: [],                   // filled by source-part-images.mjs
      is_published: false,          // DRAFT
      stock_qty: 0,
      fits_brands: brand ? [brand] : [],
      fits_models: model ? [model] : [],
    });
  }
  console.log(`parsed ${raw.length} → ${rows.length} importable (skipped ${skipped})`);
  const byBrand = {}, byCat = {};
  for (const r of rows) { byBrand[r.brand || "?"] = (byBrand[r.brand || "?"] || 0) + 1; byCat[r.category] = (byCat[r.category] || 0) + 1; }
  console.log("by brand:", byBrand);
  console.log("by category:", byCat);
  console.log("sample:", rows.slice(0, 5).map((r) => `${r.brand}/${r.fits_models[0] || "?"} · ${r.category} · $${r.price_usd} (was $${r.original_price_usd}) · ${r.name_ru.slice(0, 40)}`));
  if (!WRITE) { console.log("\n(dry-run — pass --write to insert drafts)"); return rows; }
  return rows;
}

const rows = main();
if (WRITE && rows && rows.length) {
  const r = await fetch(`${U}/rest/v1/parts`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
  console.log(r.ok ? `inserted/updated ${rows.length} draft parts ✓` : `FAIL ${r.status}: ${(await r.text()).slice(0, 300)}`);
}
