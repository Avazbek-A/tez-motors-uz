#!/usr/bin/env node
/**
 * LLM bake-off — run the app's REAL prompt shapes (RU + UZ marketing/assistant)
 * through several providers side by side, so you choose the default on evidence
 * (especially Uzbek quality) instead of a guess. Cost is pennies; the point is
 * to read the actual output.
 *
 *   1) cp scripts/llm-bakeoff.config.example.json scripts/llm-bakeoff.config.json
 *   2) fill in the providers you want to compare (keys, urls, models)
 *   3) npm run llm:bakeoff           # or: node scripts/llm-bakeoff.mjs <config.json>
 *
 * The config file is gitignored (it holds keys). Providers are OpenAI-compatible
 * or "anthropic" — the same two shapes the app supports, so a winner drops
 * straight into .env with no code change.
 */
import { readFileSync, existsSync } from "node:fs";

const configPath = process.argv[2] || "scripts/llm-bakeoff.config.json";
if (!existsSync(configPath)) {
  console.error(`\n  No config at ${configPath}.\n  Copy scripts/llm-bakeoff.config.example.json → ${configPath} and fill in your providers.\n`);
  process.exit(1);
}
const providers = JSON.parse(readFileSync(configPath, "utf8")).providers || [];
if (providers.length === 0) {
  console.error("  config has no providers[]");
  process.exit(1);
}

// Representative prompts — mirror how the app actually uses the LLM. Uzbek is
// the deciding language, so it's front and centre.
const INVENTORY = JSON.stringify([
  { brand: "BYD", model: "Song Plus", year: 2024, price_usd: 29900, monthly_usd: 620, body_type: "suv", fuel_type: "hybrid" },
  { brand: "Chery", model: "Tiggo 8 Pro", year: 2024, price_usd: 27500, monthly_usd: 570, body_type: "suv", fuel_type: "petrol" },
]);
const PROMPTS = [
  {
    label: "RU · marketing nudge",
    system: "You are the marketing copywriter for Tez Motors, a Chinese-car importer in Tashkent. Write in Russian. 1–2 short warm sentences, no preamble, never invent prices.",
    user: "Follow-up to Bek about the BYD Song Plus 2024. Intent: gently nudge them to book a test drive.",
  },
  {
    label: "UZ · marketing nudge",
    system: "You are the marketing copywriter for Tez Motors, a Chinese-car importer in Tashkent. Write in Uzbek (Latin script). 1–2 short warm sentences, no preamble, never invent prices.",
    user: "Follow-up to Bek about the BYD Song Plus 2024. Intent: gently nudge them to book a test drive.",
  },
  {
    label: "UZ · assistant (grounded)",
    system: "You are the sales assistant for Tez Motors. Reply in Uzbek (Latin script), 2–4 short sentences. Recommend ONLY from the INVENTORY JSON; never invent a car or price. End by inviting a phone number.",
    user: `Customer request: "oilaviy krossover, 30000$ gacha"\n\nINVENTORY: ${INVENTORY}`,
  },
];

function chatUrl(base) {
  const u = (base || "").replace(/\/$/, "");
  if (/chat\/completions$/.test(u)) return u;
  if (/\/v1$/.test(u)) return `${u}/chat/completions`;
  return `${u}/v1/chat/completions`;
}

async function callOne(p, prompt) {
  const started = Date.now();
  try {
    let url, headers, body;
    if (p.provider === "anthropic") {
      url = p.url || "https://api.anthropic.com/v1/messages";
      headers = { "x-api-key": p.key || "", "anthropic-version": "2023-06-01", "content-type": "application/json" };
      body = JSON.stringify({ model: p.model, max_tokens: 200, system: prompt.system, messages: [{ role: "user", content: prompt.user }] });
    } else {
      url = chatUrl(p.url);
      headers = { "content-type": "application/json", ...(p.key ? { authorization: `Bearer ${p.key}` } : {}) };
      body = JSON.stringify({ model: p.model, max_tokens: 200, temperature: 0.4, stream: false, messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }] });
    }
    const res = await fetch(url, { method: "POST", headers, body });
    const ms = Date.now() - started;
    if (!res.ok) return { ms, text: `[HTTP ${res.status}] ${(await res.text().catch(() => "")).slice(0, 160)}` };
    const data = await res.json();
    const text = p.provider === "anthropic"
      ? (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim()
      : (data.choices?.[0]?.message?.content || "").trim();
    return { ms, text: text || "[empty]" };
  } catch (e) {
    return { ms: Date.now() - started, text: `[error] ${e?.message || e}` };
  }
}

console.log(`\n  LLM bake-off — ${providers.length} providers × ${PROMPTS.length} prompts\n`);
for (const prompt of PROMPTS) {
  console.log(`\n══════ ${prompt.label} ══════`);
  for (const p of providers) {
    const r = await callOne(p, prompt);
    console.log(`\n  ▸ ${p.name} (${p.model}) — ${r.ms}ms`);
    console.log(`    ${r.text.replace(/\n/g, "\n    ")}`);
  }
}
console.log("\n  Done. Read the Uzbek outputs closely — that's the decider.\n");
