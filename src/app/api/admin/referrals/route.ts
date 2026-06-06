import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Referral leaderboard (Phase AW). Top referrers by converted referrals, for
 * the dealer to see (and reward) their best word-of-mouth advocates. Read-only.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const supabase = createServiceClient();

  const { data: refs } = await supabase
    .from("referrals")
    .select("referrer_customer_id, status")
    .not("referrer_customer_id", "is", null)
    .limit(20000);

  const byReferrer = new Map<string, { referred: number; converted: number }>();
  for (const r of refs || []) {
    const id = r.referrer_customer_id as string;
    const c = byReferrer.get(id) || { referred: 0, converted: 0 };
    c.referred += 1;
    if (r.status === "converted" || r.status === "rewarded") c.converted += 1;
    byReferrer.set(id, c);
  }

  // Rank FIRST, then resolve names for only the top 100. Resolving all referrers
  // would pass thousands of ids to .in(), whose GET URL can exceed PostgREST's
  // length limit (HTTP 414) and drop every name. The leaderboard only shows 100.
  const ranked = Array.from(byReferrer.entries())
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => b.converted - a.converted || b.referred - a.referred)
    .slice(0, 100);

  const topIds = ranked.map((r) => r.id);
  const nameById = new Map<string, { name: string | null; phone: string | null }>();
  if (topIds.length) {
    const { data: customers } = await supabase.from("customers").select("id, name, phone").in("id", topIds);
    for (const c of customers || []) nameById.set(c.id as string, { name: (c.name as string) ?? null, phone: (c.phone as string) ?? null });
  }

  const leaderboard = ranked.map((r) => ({
    ...r,
    name: nameById.get(r.id)?.name ?? null,
    phone: nameById.get(r.id)?.phone ?? null,
  }));

  const totals = {
    referrers: byReferrer.size,
    referred: (refs || []).length,
    converted: (refs || []).filter((r) => r.status === "converted" || r.status === "rewarded").length,
  };
  return NextResponse.json({ leaderboard, totals });
}
