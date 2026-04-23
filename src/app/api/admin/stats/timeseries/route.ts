import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

/**
 * Daily inquiry volume for the last N days (default 30).
 * Returns parallel arrays: { date, total, closed }[] — easy to consume
 * from a small inline chart.
 */
export async function GET(request: Request) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  const { searchParams } = new URL(request.url);
  const daysRaw = parseInt(searchParams.get("days") || "30", 10);
  const days = Math.max(7, Math.min(Number.isFinite(daysRaw) ? daysRaw : 30, 90));

  try {
    const supabase = createServiceClient();
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const { data, error } = await supabase
      .from("inquiries")
      .select("created_at, status")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build date bucket map in UTC to avoid TZ drift.
    const buckets = new Map<string, { total: number; closed: number }>();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      buckets.set(d.toISOString().slice(0, 10), { total: 0, closed: 0 });
    }

    for (const row of data || []) {
      const key = new Date(row.created_at).toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      b.total += 1;
      if (row.status === "closed") b.closed += 1;
    }

    const points = Array.from(buckets, ([date, v]) => ({
      date,
      total: v.total,
      closed: v.closed,
    }));

    return NextResponse.json({ days, points });
  } catch (err) {
    console.error("Timeseries error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
