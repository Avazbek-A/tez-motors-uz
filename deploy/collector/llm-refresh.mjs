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

// Tier candidate rankers over the free catalog (NVIDIA-first, by need).
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
