/**
 * Enrich DRAFT parts with ORIGINAL trilingual names + descriptions (free
 * OpenRouter models — no spend). Used after import-gonzo-parts.mjs: turns a bare
 * Russian name into clean RU/UZ/EN names + 2–3-sentence descriptions written from
 * scratch (part type + car fit), never copied from any source.
 *
 *   node enrich-parts.mjs            (dry-run)
 *   node enrich-parts.mjs --write    (patch name_uz/en + description_ru/uz/en)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");

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
const MODELS = (process.env.LLM_CLEAN_MODELS ||
  "meta-llama/llama-3.3-70b-instruct:free,qwen/qwen3-next-80b-a3b-instruct:free,nvidia/nemotron-nano-9b-v2:free,google/gemma-4-31b-it:free")
  .split(",").map((s) => s.trim()).filter((s) => s.endsWith(":free"));
let preferred = 0;

async function gen(items) {
  const sys =
    "You are a spare-parts catalogue editor for Tez Motors, a Chinese-car dealer in Uzbekistan. " +
    "For each part, write ORIGINAL, professional catalogue copy from scratch in three languages. " +
    "Be factual: only describe what the part type + the car model imply (fitment, function, quality). " +
    "NEVER invent specs, prices, phone numbers, or OEM codes. Output ONLY JSON {\"results\":[...]}.";
  const user =
    `Return {"results":[...]}, one per index:\n` +
    `{"i":<index>,"name_ru":"<clean RU name e.g. 'Передний бампер BYD Han'>","name_uz":"<UZ latin>","name_en":"<EN>",` +
    `"desc_ru":"<2-3 warm factual sentences: what the part is, which car it fits, quality replacement available под заказ из Китая with delivery to Tashkent>",` +
    `"desc_uz":"<same in Uzbek latin>","desc_en":"<same in English>"}\n\nParts:\n` +
    items.map((it) => `${it.i}. "${it.name}" — ${it.brand || "?"} ${it.model || ""} (${it.category})`).join("\n");
  let txt = null, lastErr = "none";
  for (let off = 0; off < MODELS.length && txt == null; off++) {
    const idx = (preferred + off) % MODELS.length;
    const model = MODELS[idx];
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${OR_KEY}`, "content-type": "application/json", "HTTP-Referer": "https://tezmotors.uz", "X-Title": "Tez Motors" },
        body: JSON.stringify({ model, max_tokens: 6000, temperature: 0.5, response_format: { type: "json_object" }, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
        signal: AbortSignal.timeout(120000),
      });
      if (r.ok) { txt = (await r.json()).choices?.[0]?.message?.content || ""; preferred = idx; break; }
      lastErr = `${model} ${r.status}`;
      if (r.status === 429 && attempt === 0) { await new Promise((res) => setTimeout(res, 8000)); continue; }
      break;
    }
  }
  if (txt == null) throw new Error(`llm all models failed (${lastErr})`);
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no json");
  const obj = JSON.parse(m[0]);
  return Array.isArray(obj.results) ? obj.results : [];
}

async function main() {
  if (!OR_KEY) { console.error("FATAL: OPENROUTER_API_KEY unset"); process.exit(1); }
  // Drafts still missing UZ/EN names or any description.
  const parts = await (await fetch(`${U}/rest/v1/parts?select=id,name_ru,name_uz,name_en,brand,fits_models,category,description_ru&is_published=eq.false&order=created_at.desc&limit=5000`, { headers: H })).json();
  const todo = parts.filter((p) => !p.name_en || !p.description_ru);
  console.log(`drafts: ${parts.length}, need enrichment: ${todo.length} | models: ${MODELS.join(" → ")}`);
  let patched = 0;
  for (let b = 0; b < todo.length; b += 5) {
    const batch = todo.slice(b, b + 5);
    let res;
    try { res = await gen(batch.map((p, k) => ({ i: k, name: p.name_ru, brand: p.brand, model: (p.fits_models || [])[0], category: p.category }))); }
    catch (e) { console.log(`\nbatch ${b} skipped (${e.message})`); continue; }
    for (const r of res) {
      const p = batch[r.i]; if (!p) continue;
      const patch = {
        name_ru: (r.name_ru || p.name_ru).slice(0, 180),
        name_uz: (r.name_uz || "").slice(0, 180) || null,
        name_en: (r.name_en || "").slice(0, 180) || null,
        description_ru: (r.desc_ru || "").slice(0, 1200) || null,
        description_uz: (r.desc_uz || "").slice(0, 1200) || null,
        description_en: (r.desc_en || "").slice(0, 1200) || null,
      };
      if (WRITE) { const rr = await fetch(`${U}/rest/v1/parts?id=eq.${p.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(patch) }); if (rr.ok) patched++; }
      else if (b === 0) console.log("sample:", JSON.stringify(patch, null, 1).slice(0, 500));
    }
    process.stdout.write(".");
    await new Promise((res) => setTimeout(res, 2500));
  }
  console.log(`\n${WRITE ? `patched ${patched}` : "(dry-run; pass --write)"}`);
}
main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
