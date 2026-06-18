/**
 * Per-tier LLM model selection, resolved at RUNTIME so the weekly auto-refresh
 * job (/api/cron/llm-refresh) can swap models live — no redeploy/restart.
 *
 * Precedence: DB row site_settings('llm_models')  >  env (LLM_MODEL_*)  >  defaults.
 * The DB row is what the cron writes; env lets the owner pin a model manually;
 * defaults are the quality-max NVIDIA-free picks the dealer chose (2026-06-15).
 *
 * Three tiers, each with a primary + a fallback (the cloud-only fallback chain:
 * primary free model → second free model → caller's deterministic template):
 *   - chat   : buyer assistant (web/TG/WhatsApp) + journey msgs — fast, multilingual
 *   - reason : listing/RFQ parse, content gen, operator/copilot, call-intel — strong
 *   - vision : spec-sheet screenshots (CN/RU/UZ in images) — multimodal
 * All defaults are OpenRouter FREE models (no spend), verified live on the key.
 */
// Import from /service (NOT /server) — /server pulls in next/headers (cookies),
// which breaks the build if this module is ever reached from a client bundle.
import { createServiceClient } from "@/lib/supabase/service";

export type LlmTier = "chat" | "reason" | "vision";

/**
 * Hard paid-guard: a model is callable ONLY if it's an OpenRouter free variant
 * (`:free` suffix). The dealer is cost-averse and the account HAS credit, so a
 * non-free id would actually be billed — we never call one. A misconfigured paid
 * model is skipped (→ fall back / alert), never charged.
 */
export const isFreeModel = (id: string | undefined | null): boolean =>
  typeof id === "string" && id.trim().endsWith(":free");

export interface TierModels {
  chat: string;
  chatFallback: string;
  reason: string;
  reasonFallback: string;
  vision: string;
  visionFallback: string;
}

/** Quality-max defaults (dealer choice 2026-06-15) — all OpenRouter free NVIDIA Nemotron. */
export const DEFAULT_TIER_MODELS: TierModels = {
  // Current, verified-live OpenRouter `:free` instruction models (the older Nemotron
  // ids 404'd on OpenRouter's free pool). Instruction (not reasoning) models — they
  // emit clean JSON instead of burning the token budget on <think> blocks.
  chat: "openai/gpt-oss-20b:free",
  chatFallback: "meta-llama/llama-3.3-70b-instruct:free",
  reason: "meta-llama/llama-3.3-70b-instruct:free",
  reasonFallback: "qwen/qwen3-next-80b-a3b-instruct:free",
  vision: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  visionFallback: "nvidia/nemotron-nano-12b-v2-vl:free",
};

function envOverrides(): Partial<TierModels> {
  const e = process.env;
  const o: Partial<TierModels> = {};
  if (e.LLM_MODEL_CHAT) o.chat = e.LLM_MODEL_CHAT;
  if (e.LLM_MODEL_CHAT_FALLBACK) o.chatFallback = e.LLM_MODEL_CHAT_FALLBACK;
  if (e.LLM_MODEL_REASON) o.reason = e.LLM_MODEL_REASON;
  if (e.LLM_MODEL_REASON_FALLBACK) o.reasonFallback = e.LLM_MODEL_REASON_FALLBACK;
  if (e.LLM_VISION_MODEL) o.vision = e.LLM_VISION_MODEL;
  if (e.LLM_VISION_MODEL_FALLBACK) o.visionFallback = e.LLM_VISION_MODEL_FALLBACK;
  return o;
}

let cache: TierModels | null = null;
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

/** Resolve the live per-tier model config (cached 5 min). Never throws. */
export async function getTierModels(): Promise<TierModels> {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  let dbRow: Partial<TierModels> = {};
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("site_settings").select("values").eq("id", "llm_models").maybeSingle();
    const v = (data?.values ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(DEFAULT_TIER_MODELS) as (keyof TierModels)[]) {
      if (typeof v[k] === "string" && (v[k] as string).trim()) dbRow[k] = (v[k] as string).trim();
    }
  } catch {
    dbRow = {};
  }
  cache = { ...DEFAULT_TIER_MODELS, ...envOverrides(), ...dbRow };
  cachedAt = Date.now();
  return cache;
}

/** [primary, fallback] model ids for a tier. */
export function tierPair(tier: LlmTier, m: TierModels): [string, string] {
  if (tier === "reason") return [m.reason, m.reasonFallback];
  if (tier === "vision") return [m.vision, m.visionFallback];
  return [m.chat, m.chatFallback];
}

/**
 * Universal free fallbacks appended AFTER the configured primary+fallback. The
 * free NVIDIA models rotate (transient 404/429), and a tier pair of just 2 left
 * replies dropping to the deterministic template too often. These extra :free ids
 * (verified live on the key) keep the buyer auto-reply producing real AI. All
 * `:free`; the paid-guard filters anything else. Tier-appropriate (vision stays
 * multimodal). Kept short so a total free-tier outage doesn't stack timeouts.
 */
const EXTRA_FREE_FALLBACKS: Record<LlmTier, string[]> = {
  chat: ["openai/gpt-oss-20b:free", "meta-llama/llama-3.3-70b-instruct:free", "qwen/qwen3-next-80b-a3b-instruct:free"],
  reason: ["openai/gpt-oss-120b:free", "qwen/qwen3-coder:free", "meta-llama/llama-3.3-70b-instruct:free"],
  vision: ["nvidia/nemotron-nano-12b-v2-vl:free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"],
};

/** Ordered model chain for a tier: configured primary + fallback, then the
 *  universal free fallbacks — deduped. Try-next-on-failure resilience. */
export function tierChain(tier: LlmTier, m: TierModels): string[] {
  const [primary, fallback] = tierPair(tier, m);
  const seen = new Set<string>();
  return [primary, fallback, ...EXTRA_FREE_FALLBACKS[tier]].filter(
    (x): x is string => !!x && !seen.has(x) && (seen.add(x), true),
  );
}

/** Force the next getTierModels() to re-read the DB (called by the refresh cron after a write). */
export function invalidateTierModelsCache(): void {
  cache = null;
  cachedAt = 0;
}

// ---- Multi-provider failover (added 2026-06-17) ----------------------------
// Each tier now fails over ACROSS providers, not just across OpenRouter's free
// models. OpenRouter's `:free` ids share ONE global pool (the 404/429 churn we
// saw); every other provider gives us our OWN per-key rate limit, which is the
// real reliability fix. A provider is only used when its key env is set, so this
// stays INERT (identical to today's OpenRouter-only behaviour) until the owner
// drops a key into the Vostro .env.local — then it lights up automatically.
//
// PRIVACY GATE: the customer-facing `chat` tier can carry a name/phone in the
// message text, so it only uses providers that do NOT train on inputs
// (pii:"ok"). The internal `reason`/`vision` tiers (listing parse, spec
// screenshots — no customer PII) may use data-training free tiers (Gemini) for
// their stronger / multimodal models.

export interface ProviderInfo { baseUrl: string; keyEnv: string; pii: "ok" | "avoid" }

/** OpenAI-compatible providers we can fail over to. All use the OpenAI request
 *  shape (so llm.ts buildChatRequest("openai", …) works unchanged). */
export const PROVIDERS: Record<string, ProviderInfo> = {
  // No-train (safe for customer chat):
  openrouter:  { baseUrl: "https://openrouter.ai/api/v1",                             keyEnv: "OPENROUTER_API_KEY",  pii: "ok" },
  groq:        { baseUrl: "https://api.groq.com/openai/v1",                           keyEnv: "GROQ_API_KEY",        pii: "ok" },
  nvidia:      { baseUrl: "https://integrate.api.nvidia.com/v1",                      keyEnv: "NVIDIA_API_KEY",      pii: "ok" },
  // May train on free-tier inputs / unclear → internal non-PII tiers only:
  gemini:      { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyEnv: "GEMINI_API_KEY",      pii: "avoid" },
  siliconflow: { baseUrl: "https://api.siliconflow.com/v1",                           keyEnv: "SILICONFLOW_API_KEY", pii: "avoid" },
};

// Model id per (provider, tier). OpenRouter is special — it pulls its ids from
// the configured free chain (site_settings / defaults), not from here.
const PROVIDER_TIER_MODEL: Record<string, Partial<Record<LlmTier, string>>> = {
  groq:        { chat: "llama-3.3-70b-versatile", reason: "llama-3.3-70b-versatile" },
  nvidia:      { chat: "meta/llama-3.3-70b-instruct", reason: "deepseek-ai/deepseek-r1", vision: "meta/llama-3.2-90b-vision-instruct" },
  gemini:      { chat: "gemini-2.5-flash", reason: "gemini-2.5-flash", vision: "gemini-2.5-flash" },
  siliconflow: { chat: "Qwen/Qwen3-8B", reason: "Qwen/Qwen3-8B" }, // DeepSeek-R1-Distill is "disabled" on SiliconFlow free now (403); Qwen3-8B verified live
};

// Provider preference order per tier (best first). "openrouter" expands to the
// configured free chain at that position.
const TIER_PROVIDER_ORDER: Record<LlmTier, string[]> = {
  chat:   ["groq", "openrouter", "nvidia", "siliconflow"],
  // Lead with the free no-train routers (OpenRouter + Groq). This (a) honours the
  // "use the free routers" preference, and (b) keeps PII-bearing reason work — call
  // transcripts via analyzeCall — on no-train providers in practice; the data-training
  // free tiers (gemini/siliconflow) are demoted to last-resort fallbacks.
  reason: ["openrouter", "groq", "nvidia", "gemini", "siliconflow"],
  vision: ["gemini", "openrouter", "nvidia"],
};

export interface ResolvedModel { provider: string; model: string; url: string; key: string; pii: "ok" | "avoid" }

/**
 * Pure chain builder (unit-tested): expand a tier's provider order into model
 * entries given the OpenRouter sub-chain + which provider keys are available.
 * Drops providers without a key; drops pii:"avoid" providers on the `chat` tier
 * (privacy gate); dedups by provider+model; preserves order.
 */
export function buildChainEntries(
  tier: LlmTier,
  openrouterIds: string[],
  hasKey: (provider: string) => boolean,
): { provider: string; model: string }[] {
  const out: { provider: string; model: string }[] = [];
  const seen = new Set<string>();
  const push = (provider: string, model: string) => {
    if (!model || !hasKey(provider)) return;
    if (tier === "chat" && PROVIDERS[provider]?.pii === "avoid") return; // privacy gate
    const k = `${provider}:${model}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ provider, model });
  };
  for (const provider of TIER_PROVIDER_ORDER[tier]) {
    if (provider === "openrouter") openrouterIds.forEach((id) => push("openrouter", id));
    else { const m = PROVIDER_TIER_MODEL[provider]?.[tier]; if (m) push(provider, m); }
  }
  return out;
}

/**
 * Resolve the live failover chain for a tier: provider order → model entries,
 * each carrying its base URL + key. OpenRouter entries use the configured
 * (DB/env/default) free chain, free-guarded to `:free` only. Providers whose key
 * is unset are skipped → inert until configured.
 */
export async function resolveTierChain(tier: LlmTier): Promise<ResolvedModel[]> {
  const orIds = tierChain(tier, await getTierModels()).filter(isFreeModel); // OpenRouter paid-guard
  const keyOf = (p: string) => (process.env[PROVIDERS[p]?.keyEnv || ""] || "").trim();
  return buildChainEntries(tier, orIds, (p) => !!keyOf(p)).map((e) => ({
    provider: e.provider,
    model: e.model,
    url: PROVIDERS[e.provider].baseUrl,
    key: keyOf(e.provider),
    pii: PROVIDERS[e.provider].pii,
  }));
}
