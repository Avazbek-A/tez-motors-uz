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
import { createServiceClient } from "@/lib/supabase/server";

export type LlmTier = "chat" | "reason" | "vision";

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
  chat: "nvidia/nemotron-3-nano-30b-a3b:free",
  chatFallback: "nvidia/nemotron-nano-9b-v2:free",
  reason: "nvidia/nemotron-3-ultra-550b-a55b:free",
  reasonFallback: "nvidia/nemotron-3-super-120b-a12b:free",
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

/** Force the next getTierModels() to re-read the DB (called by the refresh cron after a write). */
export function invalidateTierModelsCache(): void {
  cache = null;
  cachedAt = 0;
}
