/**
 * LLM clean-up pass over DRAFT scooters (free OpenRouter models — no spend).
 *
 * For each scraped listing the model decides if it's a genuine e-scooter / e-bike
 * for sale (not a part, accessory, toy, or unrelated ad), refines kind/brand/model,
 * and extracts any specs stated in the title (motor W, battery Wh, range km, top
 * speed, foldable). Non-scooters are deleted, near-duplicates collapsed, and the
 * survivors with a photo + price are PUBLISHED. Mirrors parts-llm-clean.mjs.
 *
 * Run (dry):           node scooters-llm-clean.mjs
 * Run (clean only):    node scooters-llm-clean.mjs --write
 * Run (clean+publish): node scooters-llm-clean.mjs --write --publish
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const PUBLISH = process.argv.includes("--publish");

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
  const sys = "You are a light-EV catalogue editor for a dealer in Uzbekistan. For each raw OLX listing decide if it is a GENUINE electric scooter or electric bike FOR SALE (NOT a spare part, accessory, charger, wheel, kids' push-scooter, or unrelated ad) and write a clean catalogue entry. Output ONLY a JSON object {\"results\":[...]} — no prose, no markdown.";
  const user =
    `Return {"results":[...]} with one object per listing index:\n` +
    `{"i":<index>,"keep":<true only if a real e-scooter/e-bike>,"kind":"<escooter|ebike>","brand":"<brand name, e.g. Kugoo/Ninebot/Xiaomi; if unknown use 'Generic'>","model":"<short clean model name, no prices/phones/ALLCAPS spam>","motor_power_w":<integer watts or null>,"battery_wh":<integer Wh or null>,"range_km":<integer or null>,"top_speed_kmh":<integer or null>,"foldable":<true|false|null>}\n\nListings:\n` +
    items.map((it) => `${it.i}. "${it.name}" (current kind: ${it.kind})`).join("\n");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${OR_KEY}`, "content-type": "application/json", "HTTP-Referer": "https://tezmotors.uz", "X-Title": "Tez Motors" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, temperature: 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) throw new Error(`llm ${r.status}`);
  const txt = (await r.json()).choices?.[0]?.message?.content || "";
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no json in response");
  const obj = JSON.parse(m[0]);
  return Array.isArray(obj.results) ? obj.results : Array.isArray(obj) ? obj : [];
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-zа-я0-9]+/g, "");
const intOrNull = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };

async function main() {
  if (!OR_KEY) { console.error("FATAL: OPENROUTER_API_KEY unset"); process.exit(1); }
  const parts = await (await fetch(`${U}/rest/v1/scooters?select=id,brand,model,kind,price_usd,images&is_published=eq.false&limit=5000`, { headers: H })).json();
  console.log(`draft scooters: ${parts.length} | model: ${MODEL}`);

  const cleaned = [];
  const drop = [];
  for (let b = 0; b < parts.length; b += 6) {
    const batch = parts.slice(b, b + 6);
    let res;
    try { res = await classify(batch.map((p, k) => ({ i: k, name: `${p.brand} ${p.model}`, kind: p.kind }))); }
    catch (e) { console.log(`\nbatch ${b} skipped (${e.message}) — leaving as-is`); continue; }
    for (const r of res) {
      const p = batch[r.i]; if (!p) continue;
      if (!r.keep) { drop.push(p.id); continue; }
      cleaned.push({
        id: p.id,
        kind: r.kind === "ebike" ? "ebike" : "escooter",
        brand: String(r.brand || p.brand || "Generic").slice(0, 60).trim(),
        model: String(r.model || p.model).slice(0, 100).trim(),
        motor_power_w: intOrNull(r.motor_power_w),
        battery_wh: intOrNull(r.battery_wh),
        range_km: intOrNull(r.range_km),
        top_speed_kmh: intOrNull(r.top_speed_kmh),
        foldable: typeof r.foldable === "boolean" ? r.foldable : null,
        price_usd: p.price_usd, hasPhoto: Array.isArray(p.images) && p.images.length > 0,
      });
    }
    process.stdout.write(".");
  }
  console.log(`\nclassified → keep ${cleaned.length}, drop ${drop.length}`);

  const seen = new Set();
  const dupIds = [];
  const keep = [];
  for (const c of cleaned) {
    const key = `${norm(c.brand)}|${norm(c.model)}|${c.kind}`;
    if (seen.has(key)) { dupIds.push(c.id); continue; }
    seen.add(key); keep.push(c);
  }
  const publishable = keep.filter((c) => c.hasPhoto && Number(c.price_usd) > 0);
  console.log(`dedup → ${keep.length} unique (${dupIds.length} dup) | publishable (photo+price): ${publishable.length}`);

  if (!WRITE) { console.log("(dry-run; pass --write [--publish])"); return; }

  const del = [...drop, ...dupIds];
  for (let i = 0; i < del.length; i += 50) {
    const ids = del.slice(i, i + 50);
    await fetch(`${U}/rest/v1/scooters?id=in.(${ids.join(",")})&is_published=eq.false`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } }).catch(() => {});
  }
  let updated = 0, published = 0;
  for (const c of keep) {
    const patch = { kind: c.kind, brand: c.brand, model: c.model, motor_power_w: c.motor_power_w, battery_wh: c.battery_wh, range_km: c.range_km, top_speed_kmh: c.top_speed_kmh, foldable: c.foldable };
    if (PUBLISH && c.hasPhoto && Number(c.price_usd) > 0) { patch.is_published = true; published++; }
    const r = await fetch(`${U}/rest/v1/scooters?id=eq.${c.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    if (r.ok) updated++;
  }
  console.log(`done — deleted ${del.length}, cleaned ${updated}${PUBLISH ? `, PUBLISHED ${published}` : ""}.`);
}
main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
