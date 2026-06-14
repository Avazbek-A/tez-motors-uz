import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Scraper health (pricing-engine Phase 6). Per source, how fresh is the inflow —
 * so a silently-broken collector (OLX changed its markup, avtoelon shifted) gets
 * caught before stale data quietly corrupts every downstream price. Read-only,
 * admin. Each collector is expected to produce listings ~daily; >3 days dry = stale.
 */
const MAX = 5000;
const STALE_DAYS = 3;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data } = await supabase
      .from("market_listings")
      .select("source, observed_at, last_seen_at")
      .gte("observed_at", since)
      .limit(MAX);

    const now = Date.now();
    type Agg = { source: string; count24h: number; count7d: number; count30d: number; lastObservedAt: string | null; lastSeenAt: string | null };
    const bySource = new Map<string, Agg>();
    for (const r of data || []) {
      const src = (r.source as string) || "other";
      const a = bySource.get(src) || { source: src, count24h: 0, count7d: 0, count30d: 0, lastObservedAt: null, lastSeenAt: null };
      const obs = Date.parse((r.observed_at as string) || "");
      const seen = Date.parse((r.last_seen_at as string) || (r.observed_at as string) || "");
      if (Number.isFinite(obs)) {
        const age = now - obs;
        if (age <= 86_400_000) a.count24h += 1;
        if (age <= 7 * 86_400_000) a.count7d += 1;
        a.count30d += 1;
        if (!a.lastObservedAt || obs > Date.parse(a.lastObservedAt)) a.lastObservedAt = new Date(obs).toISOString();
      }
      if (Number.isFinite(seen) && (!a.lastSeenAt || seen > Date.parse(a.lastSeenAt))) a.lastSeenAt = new Date(seen).toISOString();
      bySource.set(src, a);
    }

    const sources = [...bySource.values()].map((a) => {
      const lastSeenMs = a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0;
      const daysSinceSeen = lastSeenMs ? Math.floor((now - lastSeenMs) / 86_400_000) : null;
      const status = daysSinceSeen == null ? "idle" : daysSinceSeen > STALE_DAYS ? "stale" : "ok";
      return { ...a, daysSinceSeen, status };
    });
    sources.sort((x, y) => y.count30d - x.count30d);
    const anyStale = sources.some((s) => s.status === "stale");
    return NextResponse.json({ ok: true, overall: anyStale ? "degraded" : sources.length ? "healthy" : "no_data", sources });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute scraper health" }, { status: 500 });
  }
}
