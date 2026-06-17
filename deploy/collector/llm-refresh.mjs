/**
 * Keep the per-tier LLM model picks current with OpenRouter's FREE catalog.
 *
 * Strategy = "keep-if-working, replace-if-broken" (stable, low churn):
 *   - For each tier (chat / reason / vision) the current primary+fallback are kept
 *     IF they're still in the free catalog AND pass a liveness probe.
 *   - A model that vanished from the free list or fails the probe is replaced by
 *     the best NVIDIA-free candidate for that tier (chat=fast/small, reason=largest,
 *     vision=multimodal). Everything stays FREE (no spend) and NVIDIA-first.
 *   - If anything changed, upsert site_settings('llm_models') (the app reads it live
 *     within ~5 min) and Telegram-notify the owner.
 *
 * Run (recon/dry):  node llm-refresh.mjs
 * Run (apply):      node llm-refresh.mjs --write
 * Schedule weekly via crontab on the Vostro.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const OR_BASE = "https://openrouter.ai/api/v1";

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}
const env = loadEnv();
const OR_KEY = env.OPENROUTER_API_KEY || env.LLM_API_KEY;
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };

// STRICT free check — must carry the `:free` suffix (matches the app's paid guard
// in llm.ts). The account has credit, so anything else would be billed. Never pick
// a non-:free model.
const isFree = (m) => typeof m.id === "string" && m.id.endsWith(":free");
const isVision = (m) => JSON.stringify(m.architecture?.input_modalities || m.architecture?.modality || "").includes("image");
const sizeB = (id) => { const m = id.match(/(\d+)\s*b\b/i); return m ? parseInt(m[1], 10) : 0; };

// Tier candidate rankers over the free catalog (NVIDIA-first, by need) — used to
// REPLACE a broken pick (keep-if-working/replace-if-broken stays NVIDIA-first +
// low-churn). The broader cross-family ranker below (scoreModel) is used only to
// SUGGEST upgrades to the owner, never to auto-switch.
const TIERS = {
  chat: (free) => free
    .filter((m) => /nvidia|nemotron/i.test(m.id) && !isVision(m) && !/content-safety|guard|safety/i.test(m.id))
    .sort((a, b) => (sizeB(a.id) || 999) - (sizeB(b.id) || 999)), // smallest/fastest first
  reason: (free) => free
    .filter((m) => /nvidia|nemotron/i.test(m.id) && !isVision(m) && !/content-safety|guard|safety/i.test(m.id))
    .sort((a, b) => sizeB(b.id) - sizeB(a.id)), // largest/strongest first
  vision: (free) => free
    .filter((m) => /nvidia|nemotron/i.test(m.id) && isVision(m) && !/content-safety|guard|safety/i.test(m.id))
    .sort((a, b) => (/omni|reasoning/i.test(b.id) ? 1 : 0) - (/omni|reasoning/i.test(a.id) ? 1 : 0)), // prefer omni/reasoning
};

// ---- Cross-family upgrade scorer (for weekly SUGGESTIONS, all free families) --
// Newer/stronger families rank higher; sizes/context add to it. Chat favors
// speed (smaller), reason/vision favor strength. Transparent + easy to retune.
const FAMILIES = [
  { re: /deepseek/i, rank: 9, name: "DeepSeek" },
  { re: /qwen-?3|qwen3/i, rank: 8, name: "Qwen3" },
  { re: /llama-?4|llama4/i, rank: 8, name: "Llama 4" },
  { re: /gpt-oss/i, rank: 7, name: "GPT-OSS" },
  { re: /llama-?3\.3/i, rank: 7, name: "Llama 3.3" },
  { re: /glm-?4/i, rank: 7, name: "GLM-4" },
  { re: /nemotron/i, rank: 6, name: "Nemotron" },
  { re: /gemma-?3/i, rank: 6, name: "Gemma 3" },
  { re: /mistral|mixtral|magistral|devstral/i, rank: 6, name: "Mistral" },
  { re: /qwen-?2\.5|qwen2/i, rank: 5, name: "Qwen2.5" },
];
const family = (id) => FAMILIES.find((f) => f.re.test(id)) || { rank: 3, name: "other" };
const ctxOf = (m) => Number(m.context_length || m.top_provider?.context_length || 0) || 0;
const TEXT_OK = (m) => !isVision(m) && !/guard|safety|moderat|embed|rerank|tts|whisper|audio|image-gen/i.test(m.id);

function scoreModel(m, tier) {
  const fam = family(m.id).rank;
  const size = sizeB(m.id);
  const ctx = ctxOf(m);
  if (tier === "reason") return fam * 100 + Math.min(size, 700) + ctx / 100000;
  if (tier === "vision") return fam * 100 + Math.min(size, 200) + ctx / 100000;
  const speed = size === 0 ? 8 : size <= 12 ? 10 : size <= 30 ? 8 : size <= 70 ? 4 : 1; // chat: prefer fast
  return fam * 100 + speed * 5 + ctx / 200000;
}
function poolFor(tier, free) {
  return tier === "vision" ? free.filter((m) => isVision(m) && !/guard|safety/i.test(m.id)) : free.filter(TEXT_OK);
}
function rankTier(tier, free) {
  return poolFor(tier, free).map((m) => ({ id: m.id, score: scoreModel(m, tier), m })).sort((a, b) => b.score - a.score);
}
function topByTier(free) {
  const t = {};
  for (const tier of ["chat", "reason", "vision"]) t[tier] = rankTier(tier, free).slice(0, 5).map((x) => x.id);
  return t;
}
// One upgrade suggestion per tier: the best LIVE free model that meaningfully
// beats the current primary. `live` is the shared probe (cached). Never switches
// — only advises the owner.
async function buildSuggestions(free, picks, live) {
  const out = [];
  for (const tier of ["chat", "reason", "vision"]) {
    const ranked = rankTier(tier, free);
    if (!ranked.length) continue;
    const current = picks[tier];
    const curScore = ranked.find((x) => x.id === current)?.score ?? 0;
    for (const cand of ranked) {
      if (cand.id === current) break;          // current is already at/above here
      if (cand.score <= curScore * 1.05) break; // nothing meaningfully better remains
      if (!(await live(cand.id))) continue;     // must actually answer
      const f = family(cand.id), size = sizeB(cand.id), ctx = ctxOf(cand.m);
      out.push({
        tier,
        current: current || "—",
        suggest: cand.id,
        reason: `${f.name}${size ? `, ${size}B` : ""}${ctx ? `, ${Math.round(ctx / 1000)}k ctx` : ""} — сильнее текущей (${tier === "chat" ? "быстрее/умнее" : "мощнее"})`,
      });
      break; // one per tier
    }
  }
  return out;
}

async function probe(id) {
  try {
    const r = await fetch(`${OR_BASE}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${OR_KEY}`, "content-type": "application/json", "HTTP-Referer": "https://tezmotors.uz", "X-Title": "Tez Motors" },
      body: JSON.stringify({ model: id, max_tokens: 16, messages: [{ role: "user", content: "ping" }] }),
      signal: AbortSignal.timeout(60000),
    });
    return r.ok; // alive = no 4xx/5xx (reasoning models may return empty content, still alive)
  } catch { return false; }
}

// Notify the owner over BOTH Telegram + email (each fails open; email no-ops until
// RESEND_API_KEY/EMAIL_FROM/DEALER_EMAIL are set). Used for refresh changes AND the
// critical "free models unavailable" alert.
async function notify(title, lines = []) {
  const text = [title, ...lines].join("\n").slice(0, 3500);
  const jobs = [];
  const chat = env.TELEGRAM_ERROR_CHAT_ID || env.TELEGRAM_CHAT_ID;
  if (env.TELEGRAM_BOT_TOKEN && chat) {
    jobs.push(fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    }).catch(() => {}));
  }
  if (env.RESEND_API_KEY && env.EMAIL_FROM && env.DEALER_EMAIL) {
    jobs.push(fetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: env.DEALER_EMAIL, subject: `[Tez Motors] ${title}`.slice(0, 180), text }),
    }).catch(() => {}));
  }
  await Promise.allSettled(jobs);
}

async function main() {
  if (!OR_KEY || !U || !K) { console.error("FATAL: missing OPENROUTER_API_KEY / Supabase env"); process.exit(1); }

  const models = (await (await fetch(`${OR_BASE}/models`, { headers: { accept: "application/json" } })).json()).data || [];
  const free = models.filter(isFree);
  console.log(`OpenRouter: ${models.length} models, ${free.length} free`);

  const cur = (await (await fetch(`${U}/rest/v1/site_settings?id=eq.llm_models&select=values`, { headers: H })).json())[0]?.values || {};
  const prevCatalog = (await (await fetch(`${U}/rest/v1/site_settings?id=eq.llm_catalog&select=values`, { headers: H })).json())[0]?.values || {};
  const freeIds = new Set(free.map((m) => m.id));
  const probeCache = new Map();
  const live = async (id) => { if (!id) return false; if (!probeCache.has(id)) probeCache.set(id, await probe(id)); return probeCache.get(id); };

  const next = { ...cur };
  const fields = { chat: ["chat", "chatFallback"], reason: ["reason", "reasonFallback"], vision: ["vision", "visionFallback"] };
  const changes = [];
  const down = []; // tiers with NO live free candidate → free models stopped

  for (const [tier, [pKey, fKey]] of Object.entries(fields)) {
    const ranked = TIERS[tier](free).map((m) => m.id);
    // pick the first N live candidates for [primary, fallback]
    const picks = [];
    for (const id of ranked) { if (picks.length >= 2) break; if (await live(id)) picks.push(id); }
    if (!picks.length && !(cur[pKey] && freeIds.has(cur[pKey]) && (await live(cur[pKey])))) down.push(tier);
    for (const [i, key] of [pKey, fKey].entries()) {
      const current = cur[key];
      const keep = current && freeIds.has(current) && (await live(current));
      if (keep) { next[key] = current; continue; }
      const replacement = picks.find((id) => !Object.values(next).includes(id)) || picks[i] || current;
      if (replacement && replacement !== current) { next[key] = replacement; changes.push(`${key}: ${current || "—"} → ${replacement}`); }
    }
  }

  // CRITICAL: free models stopped for a tier → alert the owner (Telegram + email).
  if (down.length) {
    console.log("FREE MODELS DOWN for tiers: " + down.join(", "));
    await notify("🚨 OpenRouter FREE models unavailable", [
      ...down.map((t) => `• ${t}: no live free NVIDIA model found`),
      "AI replies are falling back to the deterministic template.",
      "Nothing switched to a paid model. Check OpenRouter free-tier status.",
    ]);
  }

  // ---- Weekly upgrade scan: rank the WHOLE free catalog per tier, suggest the
  // best live model that beats the current primary, persist for the admin
  // dashboard, and digest NEW suggestions to the owner (never auto-switch). -----
  const suggestions = await buildSuggestions(free, next, live);
  const catalog = { scanned_at: new Date().toISOString(), free_count: free.length, suggestions, top: topByTier(free) };
  if (WRITE) {
    const rc = await fetch(`${U}/rest/v1/site_settings`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "llm_catalog", values: catalog }) });
    console.log(rc.ok ? "catalog saved ✓" : "catalog save FAIL " + rc.status);
  }
  if (suggestions.length) {
    console.log("SUGGESTIONS:\n  " + suggestions.map((s) => `${s.tier}: ${s.current} → ${s.suggest} (${s.reason})`).join("\n  "));
    // Only ping on suggestions we haven't already advised (avoid weekly repeats).
    const prevKeys = new Set((prevCatalog.suggestions || []).map((s) => `${s.tier}:${s.suggest}`));
    const fresh = suggestions.filter((s) => !prevKeys.has(`${s.tier}:${s.suggest}`));
    if (WRITE && fresh.length) {
      await notify("💡 Новые бесплатные AI-модели (можно улучшить)", [
        ...fresh.map((s) => `• ${s.tier}: ${s.suggest}\n  ${s.reason}`),
        "",
        "Открыть: Админ → AI-модели. Применить — там же или скажите мне.",
      ]);
    }
  } else {
    console.log("no upgrade suggestions — current picks lead the free catalog ✓");
  }

  // ---- Apply keep/replace pick changes ---------------------------------------
  if (!changes.length) { console.log("no model changes — current picks are free + live ✓"); return; }
  console.log("CHANGES:\n  " + changes.join("\n  "));
  if (!WRITE) { console.log("(dry-run; pass --write to apply)"); return; }

  next.source = "auto-refresh";
  next.updated_at = new Date().toISOString();
  const r = await fetch(`${U}/rest/v1/site_settings`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "llm_models", values: next }) });
  console.log(r.ok ? "applied ✓" : "FAIL " + r.status);
  if (r.ok) await notify("🤖 LLM models auto-refreshed (OpenRouter free)", changes.map((c) => "• " + c));
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
