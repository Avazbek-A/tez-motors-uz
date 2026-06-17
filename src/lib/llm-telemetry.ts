/**
 * Fire-and-forget telemetry for LLM calls — records ONE summary row per call to
 * `llm_call_log` so the admin "AI models" dashboard can show free-model health:
 * how often a call had to switch off its primary model (the free NVIDIA models
 * rotate 404/429), which model actually answered, and per-model failure counts.
 *
 * Mirrors error-report.ts: dynamic-imports the service client (so this module
 * stays free of next/headers and safe to import from the Workers-safe llm.ts),
 * fail-open everywhere — observability must never break a reply.
 */
import type { LlmTier } from "@/lib/llm-models";

export type LlmFailureReason = "non_ok" | "empty" | "timeout" | "error";

export interface LlmFailure {
  model: string;
  reason: LlmFailureReason;
  status?: number; // HTTP status for non_ok
}

export interface LlmCallRecord {
  tier: LlmTier;
  answeredModel: string | null; // null = whole chain failed → template fallback
  attempts: number; // how many models were tried
  failures: LlmFailure[]; // each model that didn't answer
  latencyMs: number;
}

export async function recordLlmCall(rec: LlmCallRecord): Promise<void> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();
    await supabase.from("llm_call_log").insert({
      tier: rec.tier,
      answered_model: rec.answeredModel,
      attempts: rec.attempts,
      switched: rec.attempts > 1,
      failures: rec.failures,
      latency_ms: Math.round(rec.latencyMs),
    });
  } catch {
    // telemetry must never break a request
  }
}
