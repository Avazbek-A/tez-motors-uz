import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveTierChain, type LlmTier } from "@/lib/llm-models";

/**
 * AI-models health for the admin dashboard (admin → AI Models). Read-only.
 *
 * The buyer assistant / form auto-reply / parsers fail over ACROSS providers
 * (OpenRouter / Groq / NVIDIA / Gemini / SiliconFlow), each with its own per-key
 * rate limit. This aggregates the per-call telemetry written to `llm_call_log`
 * (migrations 083/084) into:
 *   - headline 24h totals (calls, switch rate, full-chain failures → template),
 *   - per-tier stats (chat / reason / vision),
 *   - per-(provider, model) success + failure-by-reason counts,
 *   - the LIVE failover chain per tier (resolveTierChain — only providers whose
 *     key is set appear, so it doubles as "which providers are wired in"),
 *   - the latest free-catalog scan + upgrade suggestions (site_settings
 *     'llm_catalog', written by the weekly llm-refresh job).
 */
const TIERS: LlmTier[] = ["chat", "reason", "vision"];

interface LogRow {
  tier: string;
  provider: string | null;
  answered_model: string | null;
  attempts: number;
  switched: boolean;
  failures: { model: string; provider?: string; reason: string; status?: number }[] | null;
  latency_ms: number | null;
  created_at: string;
}

interface ModelStat {
  provider: string;
  model: string;
  answered: number;
  non_ok: number;
  empty: number;
  timeout: number;
  error: number;
  lastUsed: string | null;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("llm_call_log")
      .select("tier, provider, answered_model, attempts, switched, failures, latency_ms, created_at")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(5000);

    // Always return the LIVE failover chain + catalog even when there's no log
    // yet (migration not applied / no traffic) so the page still shows the picks
    // and which providers are wired in.
    const picks = await Promise.all(
      TIERS.map(async (tier) => ({ tier, chain: (await resolveTierChain(tier)).map((r) => ({ provider: r.provider, model: r.model })) })),
    );

    const { data: cat } = await supabase
      .from("site_settings")
      .select("values")
      .eq("id", "llm_catalog")
      .maybeSingle();
    const catalog = (cat?.values as Record<string, unknown> | undefined) ?? null;

    if (error) {
      return NextResponse.json({ ok: true, hasLog: false, picks, catalog, tierStats: [], models: [], totals: null, recent: [] });
    }

    const rows = (data || []) as LogRow[];
    const within = (r: LogRow, since: string) => r.created_at >= since;

    const tierStats = TIERS.map((tier) => {
      const tr = rows.filter((r) => r.tier === tier);
      const tr24 = tr.filter((r) => within(r, dayAgo));
      const lat = tr24.filter((r) => r.answered_model && typeof r.latency_ms === "number").map((r) => r.latency_ms as number);
      const avgLatencyMs = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null;
      return {
        tier,
        calls24: tr24.length,
        switched24: tr24.filter((r) => r.switched).length,
        failed24: tr24.filter((r) => !r.answered_model).length,
        calls7: tr.length,
        switched7: tr.filter((r) => r.switched).length,
        failed7: tr.filter((r) => !r.answered_model).length,
        avgLatencyMs,
      };
    });

    // Per-(provider, model): who answered, and who failed (by reason). 7d window.
    const modelMap = new Map<string, ModelStat>();
    const stat = (provider: string, model: string): ModelStat => {
      const key = `${provider}/${model}`;
      let s = modelMap.get(key);
      if (!s) {
        s = { provider, model, answered: 0, non_ok: 0, empty: 0, timeout: 0, error: 0, lastUsed: null };
        modelMap.set(key, s);
      }
      return s;
    };
    for (const r of rows) {
      if (r.answered_model) {
        const s = stat(r.provider || "?", r.answered_model);
        s.answered += 1;
        if (!s.lastUsed || r.created_at > s.lastUsed) s.lastUsed = r.created_at;
      }
      for (const f of r.failures || []) {
        if (!f || typeof f.model !== "string") continue;
        const s = stat(f.provider || "?", f.model);
        if (f.reason === "non_ok") s.non_ok += 1;
        else if (f.reason === "empty") s.empty += 1;
        else if (f.reason === "timeout") s.timeout += 1;
        else s.error += 1;
      }
    }
    const models = Array.from(modelMap.values()).sort(
      (a, b) => b.answered - a.answered || (b.non_ok + b.empty + b.timeout + b.error) - (a.non_ok + a.empty + a.timeout + a.error),
    );

    const rows24 = rows.filter((r) => within(r, dayAgo));
    const totals = {
      calls24: rows24.length,
      switched24: rows24.filter((r) => r.switched).length,
      failed24: rows24.filter((r) => !r.answered_model).length,
      calls7: rows.length,
    };

    const recent = rows
      .filter((r) => r.switched || !r.answered_model)
      .slice(0, 50)
      .map((r) => ({
        tier: r.tier,
        provider: r.provider,
        answered_model: r.answered_model,
        attempts: r.attempts,
        failures: (r.failures || []).map((f) => ({ model: f.model, provider: f.provider, reason: f.reason, status: f.status })),
        created_at: r.created_at,
      }));

    return NextResponse.json({ ok: true, hasLog: true, generatedAt: new Date().toISOString(), picks, catalog, tierStats, models, totals, recent });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read LLM health" }, { status: 500 });
  }
}
