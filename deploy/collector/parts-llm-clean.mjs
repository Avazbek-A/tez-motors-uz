/**
 * LLM clean-up pass over DRAFT parts (free OpenRouter models — no spend).
 *
 * For each scraped listing the model decides if it's a genuine spare PART and emits
 * a clean professional name (RU + EN), an OEM number if the title has one, and the
 * right category. Then: non-parts are deleted, near-duplicates collapsed, and the
 * survivors with a photo + price are PUBLISHED. Turns a scrape into a catalogue.
 *
 * Run (dry):           node parts-llm-clean.mjs
 * Run (clean only):    node parts-llm-clean.mjs --write
 * Run (clean+publish): node parts-llm-clean.mjs --write --publish
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const PUBLISH = process.argv.includes("--publish");
const CATS = ["engine", "body", "electrical", "suspension", "brakes", "interior", "other"];

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}
const env = loadEnv();
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };
const OR_KEY = env.OPENROUTER_API_KEY;
const MODEL = process.env.LLM_CLEAN_MODEL || "nvidia/nemotron-3-nano-30b-a3b:free";

async function classify(items) {
  const sys = "You are a spare-parts catalogue editor for a car dealer in Uzbekistan. For each raw OLX listing decide if it is a GENUINE auto spare PART for sale (NOT a whole car, NOT a service/repair offer, NOT tires-only, NOT junk) and write a clean professional catalogue entry. Output ONLY a JSON array — no prose, no markdown.";
  const user =
    `Return a JSON array with one object per listing index:\n` +
    `{"i":<index>,"keep":<true only if a real spare part>,"name_ru":"<clean concise Russian part name — no seller notes, prices, phones, ALLCAPS spam>","name_en":"<short English name>","oem":<OEM/part number string if present in the title, else null>,"category":"<one of: ${CATS.join(", ")}>"}\n\nListings:\n` +
    items.map((it) => `${it.i}. "${it.name}" (brand: ${it.brand || "?"}, current cat: ${it.category})`).join("\n");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${OR_KEY}`, "content-type": "application/json", "HTTP-Referer": "https://tezmotors.uz", "X-Title": "Tez Motors" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2200, temperature: 0.1, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) throw new Error(`llm ${r.status}`);
  const txt = (await r.json()).choices?.[0]?.message?.content || "";
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("no json in response");
  return JSON.parse(m[0]);
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-zа-я0-9]+/g, "");

async function main() {
  if (!OR_KEY) { console.error("FATAL: OPENROUTER_API_KEY unset"); process.exit(1); }
  const parts = await (await fetch(`${U}/rest/v1/parts?select=id,name_ru,category,brand,price_usd,images,fits_brands&is_published=eq.false&limit=5000`, { headers: H })).json();
  console.log(`draft parts: ${parts.length} | model: ${MODEL}`);

  const cleaned = []; // surviving parts with cleaned fields
  const drop = [];
  for (let b = 0; b < parts.length; b += 10) {
    const batch = parts.slice(b, b + 10);
    let res;
    try { res = await classify(batch.map((p, k) => ({ i: k, name: p.name_ru, brand: p.brand, category: p.category }))); }
    catch (e) { console.log(`\nbatch ${b} skipped (${e.message}) — leaving as-is`); continue; }
    for (const r of res) {
      const p = batch[r.i]; if (!p) continue;
      if (!r.keep) { drop.push(p.id); continue; }
      cleaned.push({
        id: p.id,
        name_ru: String(r.name_ru || p.name_ru).slice(0, 180).trim(),
        name_en: r.name_en ? String(r.name_en).slice(0, 180).trim() : null,
        oem_number: r.oem ? String(r.oem).slice(0, 60).trim() : null,
        category: CATS.includes(r.category) ? r.category : p.category,
        brand: p.brand, fits_brands: p.fits_brands || [],
        price_usd: p.price_usd, hasPhoto: Array.isArray(p.images) && p.images.length > 0,
      });
    }
    process.stdout.write(".");
  }
  console.log(`\nclassified → keep ${cleaned.length}, drop ${drop.length}`);

  // dedup survivors: by OEM, else clean-name + brand + category. Keep the first.
  const seen = new Set();
  const dupIds = [];
  const keep = [];
  for (const c of cleaned) {
    const key = c.oem_number ? `oem:${norm(c.oem_number)}` : `n:${norm(c.name_ru)}|${norm(c.brand)}|${c.category}`;
    if (seen.has(key)) { dupIds.push(c.id); continue; }
    seen.add(key); keep.push(c);
  }
  const publishable = keep.filter((c) => c.hasPhoto && Number(c.price_usd) > 0);
  console.log(`dedup → ${keep.length} unique (${dupIds.length} dup) | publishable (photo+price): ${publishable.length}`);

  if (!WRITE) { console.log("(dry-run; pass --write [--publish])"); return; }

  // delete non-parts + duplicates (drafts only)
  const del = [...drop, ...dupIds];
  for (let i = 0; i < del.length; i += 50) {
    const ids = del.slice(i, i + 50);
    await fetch(`${U}/rest/v1/parts?id=in.(${ids.join(",")})&is_published=eq.false`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } }).catch(() => {});
  }
  // patch cleaned fields + optionally publish
  let updated = 0, published = 0;
  for (const c of keep) {
    const patch = { name_ru: c.name_ru, name_en: c.name_en, oem_number: c.oem_number, category: c.category };
    if (PUBLISH && c.hasPhoto && Number(c.price_usd) > 0) { patch.is_published = true; published++; }
    const r = await fetch(`${U}/rest/v1/parts?id=eq.${c.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    if (r.ok) updated++;
  }
  console.log(`done — deleted ${del.length}, cleaned ${updated}${PUBLISH ? `, PUBLISHED ${published}` : ""}.`);
}
main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
