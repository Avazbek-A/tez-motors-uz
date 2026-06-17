import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getTierModels, tierChain, type LlmTier } from "@/lib/llm-models";

/**
 * AI-models health for the admin dashboard (admin → AI Models). Read-only.
 *
 * The buyer assistant / form auto-reply / parsers run on rotating OpenRouter
 * FREE models, so a call often falls back off its primary pick. This aggregates
 * the per-call telemetry written to `llm_call_log` (migration 083) into:
 *   - headline 24h totals (calls, switch rate, full-chain failures → template),
 *   - per-tier stats (chat / reason / vision),
 *   - per-model success + failure-by-reason counts (who's carrying the load,
 *     who's flaky),
 *   - the current configured chain per tier (getTierModels → tierChain),
 *   - the latest free-catalog scan + upgrade suggestions (site_settings
 *     'llm_catalog', written by the weekly llm-refresh job).
 */
const TIERS: LlmTier[] = ["chat", "reason", "vision"];

interface LogRow {
  tier: string;
  answered_model: string | null;
  attempts: number;
  switched: boolean;
  failures: { model: string; reason: string; status?: number }[] | null;
  latency_ms: number | null;
  created_at: string;
}

interface ModelStat {
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
      .select("tier, answered_model, attempts, switched, failures, latency_ms, created_at")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(5000);

    // Always return the configured chain + catalog even when there's no log yet
    // (migration not applied / no traffic) so the page still shows the picks.
    const tierModels = await getTierModels();
    const picks = TIERS.map((tier) => ({ tier, chain: tierChain(tier, tierModels) }));

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

    // Per-model: who answered, and who failed (by reason). Over the 7d window.
    const modelMap = new Map<string, ModelStat>();
    const stat = (m: string): ModelStat => {
      let s = modelMap.get(m);
      if (!s) {
        s = { model: m, answered: 0, non_ok: 0, empty: 0, timeout: 0, error: 0, lastUsed: null };
        modelMap.set(m, s);
      }
      return s;
    };
    for (const r of rows) {
      if (r.answered_model) {
        const s = stat(r.answered_model);
        s.answered += 1;
        if (!s.lastUsed || r.created_at > s.lastUsed) s.lastUsed = r.created_at;
      }
      for (const f of r.failures || []) {
        if (!f || typeof f.model !== "string") continue;
        const s = stat(f.model);
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

    // Recent calls that switched or fell through entirely — the "what just went
    // flaky" feed (most recent first, capped).
    const recent = rows
      .filter((r) => r.switched || !r.answered_model)
      .slice(0, 50)
      .map((r) => ({
        tier: r.tier,
        answered_model: r.answered_model,
        attempts: r.attempts,
        failures: (r.failures || []).map((f) => ({ model: f.model, reason: f.reason, status: f.status })),
        created_at: r.created_at,
      }));

    return NextResponse.json({ ok: true, hasLog: true, generatedAt: new Date().toISOString(), picks, catalog, tierStats, models, totals, recent });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read LLM health" }, { status: 500 });
  }
}
