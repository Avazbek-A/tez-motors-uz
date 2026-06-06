import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { requireAdmin } from "@/lib/auth";

/**
 * Revenue + conversion intelligence for the analytics page (Phase Y2).
 *
 * Returns four blocks computed server-side from inquiries + orders + payments:
 *   - funnel: inquiries → reservations (orders) → deposits paid → delivered
 *   - bySource: lead volume grouped by source_page (top surfaces)
 *   - deposits: performed deposits per day for the last N days (count + UZS)
 *   - bySalesperson: per-rep total/closed inquiries → close rate
 *
 * All read-only aggregates; service-role because orders/payments are
 * service-role-only tables (RLS, no policies).
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

    const [inqRes, ordersRes, paymentsRes] = await Promise.all([
      supabase.from("inquiries").select("status, source_page, assigned_to").limit(10000),
      supabase.from("orders").select("status").limit(10000),
      // Paginate so depositsPaid (distinct paid orders) and the chart see all rows.
      fetchAllRows<{ order_id: string; amount_tiyin: number; created_at: string; state: number }>((from, to) =>
        supabase.from("payments").select("order_id, amount_tiyin, created_at, state").eq("state", 2).range(from, to),
      ).then((data) => ({ data })),
    ]);

    const inquiries = inqRes.data || [];
    const orders = ordersRes.data || [];
    const payments = paymentsRes.data || [];

    // ---- Funnel ----
    const inquiriesTotal = inquiries.length;
    const reservations = orders.length;
    const paidOrderIds = new Set(payments.map((p) => p.order_id as string));
    const depositsPaid = paidOrderIds.size;
    const delivered = orders.filter((o) => o.status === "delivered").length;

    // ---- Leads by source_page (top 8) ----
    const sourceMap = new Map<string, number>();
    for (const i of inquiries) {
      const key = (i.source_page as string | null)?.trim() || "(direct)";
      sourceMap.set(key, (sourceMap.get(key) || 0) + 1);
    }
    const bySource = Array.from(sourceMap, ([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ---- Deposits over time (last N days) ----
    const buckets = new Map<string, { count: number; uzs: number }>();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      buckets.set(d.toISOString().slice(0, 10), { count: 0, uzs: 0 });
    }
    // depositsTotalUzs must match the per-day chart (the last-N-days window), so
    // accumulate it INSIDE the window only. Summing every payment here made the
    // headline an all-time figure presented next to (and contradicting) the
    // N-day chart. (The unfiltered `payments` query is still needed for the
    // lifetime depositsPaid funnel count above.)
    let depositsTotalUzs = 0;
    for (const p of payments) {
      const key = new Date(p.created_at as string).toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      const uzs = Math.round(Number(p.amount_tiyin || 0) / 100);
      depositsTotalUzs += uzs;
      b.count += 1;
      b.uzs += uzs;
    }
    const deposits = Array.from(buckets, ([date, v]) => ({ date, count: v.count, uzs: v.uzs }));

    // ---- Per-salesperson close rate ----
    const repMap = new Map<string, { total: number; closed: number }>();
    for (const i of inquiries) {
      const rep = (i.assigned_to as string | null) || "__unassigned__";
      const cur = repMap.get(rep) || { total: 0, closed: 0 };
      cur.total += 1;
      if (i.status === "closed") cur.closed += 1;
      repMap.set(rep, cur);
    }
    // Resolve assigned admin ids → emails.
    const repIds = Array.from(repMap.keys()).filter((k) => k !== "__unassigned__");
    const emailById = new Map<string, string>();
    if (repIds.length > 0) {
      const { data: admins } = await supabase
        .from("admin_users")
        .select("id, email")
        .in("id", repIds);
      for (const a of admins || []) emailById.set(a.id as string, a.email as string);
    }
    const bySalesperson = Array.from(repMap, ([id, v]) => ({
      id,
      label: id === "__unassigned__" ? "Unassigned" : emailById.get(id) || id.slice(0, 8),
      total: v.total,
      closed: v.closed,
      closeRate: v.total > 0 ? Math.round((v.closed / v.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      days,
      funnel: { inquiries: inquiriesTotal, reservations, depositsPaid, delivered },
      bySource,
      deposits,
      depositsTotalUzs,
      bySalesperson,
    });
  } catch (err) {
    console.error("Funnel stats error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
