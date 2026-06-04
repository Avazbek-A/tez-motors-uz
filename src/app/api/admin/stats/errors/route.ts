import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Recent server errors for the in-house error feed (admin → Errors). Read-only,
 * admin-gated. Source is the error_events table written by logEvent on any
 * error-level event.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("error_events")
      .select("id, event, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = data || [];
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Aggregate by event tag with 24h / 7d counts so spikes are visible at a
    // glance ("5 payment.* failures in the last hour") instead of scanning a
    // raw list. Sorted by 24h volume, then total.
    const agg = new Map<string, { event: string; last24h: number; last7d: number; total: number; lastSeen: string }>();
    for (const r of rows) {
      const ev = (r.event as string) || "unknown";
      const ts = r.created_at as string;
      const a = agg.get(ev) || { event: ev, last24h: 0, last7d: 0, total: 0, lastSeen: ts };
      a.total += 1;
      if (ts >= weekAgo) a.last7d += 1;
      if (ts >= dayAgo) a.last24h += 1;
      if (ts > a.lastSeen) a.lastSeen = ts;
      agg.set(ev, a);
    }
    const byEvent = Array.from(agg.values()).sort((a, b) => b.last24h - a.last24h || b.total - a.total);

    return NextResponse.json({
      ok: true,
      total: rows.length,
      last24h: rows.filter((r) => (r.created_at as string) >= dayAgo).length,
      last7d: rows.filter((r) => (r.created_at as string) >= weekAgo).length,
      byEvent,
      events: rows,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read errors" }, { status: 500 });
  }
}
