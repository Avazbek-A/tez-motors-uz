import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Real-user Core Web Vitals summary (Phase AT): p75 per metric over the last 7
 * days (p75 is the Web Vitals standard), with a good/poor rating against the
 * official thresholds. Read-only, admin-gated.
 */
const MAX = 20000;

// Official "good" / "poor" thresholds (ms, except CLS which is unitless).
const THRESHOLDS: Record<string, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  CLS: { good: 0.1, poor: 0.25 },
};

function p75(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75));
  return sorted[idx];
}

function rate(metric: string, v: number): "good" | "needs-improvement" | "poor" {
  const t = THRESHOLDS[metric];
  if (!t) return "needs-improvement";
  if (v <= t.good) return "good";
  if (v <= t.poor) return "needs-improvement";
  return "poor";
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("web_vitals")
      .select("metric, value")
      .gte("created_at", since)
      .limit(MAX);

    const byMetric = new Map<string, number[]>();
    for (const r of data || []) {
      const arr = byMetric.get(r.metric as string) || [];
      arr.push(Number(r.value));
      byMetric.set(r.metric as string, arr);
    }

    const metrics = Object.keys(THRESHOLDS).map((m) => {
      const vals = byMetric.get(m) || [];
      const value = vals.length ? Math.round(p75(vals) * 1000) / 1000 : null;
      return { metric: m, p75: value, samples: vals.length, rating: value != null ? rate(m, value) : null };
    });

    return NextResponse.json({ ok: true, sampleTotal: (data || []).length, metrics });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read vitals" }, { status: 500 });
  }
}
