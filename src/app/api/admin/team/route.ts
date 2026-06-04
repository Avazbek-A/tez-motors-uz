import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Team performance (Phase AM). Per-rep pipeline + close rate + commissions, for
 * when the one-person shop hires. Reuses inquiries.assigned_to (the rep link)
 * and the commissions table. Read-only, admin-gated.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const supabase = createServiceClient();

  const [usersRes, inqRes, commRes] = await Promise.all([
    supabase.from("admin_users").select("id, email, role, disabled").limit(200),
    supabase.from("inquiries").select("assigned_to, status").not("assigned_to", "is", null).limit(10000),
    supabase.from("commissions").select("admin_user_id, amount_usd, status").limit(10000),
  ]);

  const users = (usersRes.data || []).filter((u) => !u.disabled);

  const pipeline = new Map<string, { assigned: number; closed: number }>();
  for (const i of inqRes.data || []) {
    const id = i.assigned_to as string;
    const cur = pipeline.get(id) || { assigned: 0, closed: 0 };
    cur.assigned += 1;
    if (i.status === "closed") cur.closed += 1;
    pipeline.set(id, cur);
  }

  const commission = new Map<string, { accrued: number; paid: number }>();
  for (const c of commRes.data || []) {
    const id = c.admin_user_id as string;
    if (!id) continue;
    const cur = commission.get(id) || { accrued: 0, paid: 0 };
    const amt = Number(c.amount_usd) || 0;
    if (c.status === "paid") cur.paid += amt;
    else if (c.status === "accrued") cur.accrued += amt;
    commission.set(id, cur);
  }

  const team = users.map((u) => {
    const p = pipeline.get(u.id as string) || { assigned: 0, closed: 0 };
    const c = commission.get(u.id as string) || { accrued: 0, paid: 0 };
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      assigned: p.assigned,
      closed: p.closed,
      close_rate_pct: p.assigned > 0 ? Math.round((p.closed / p.assigned) * 100) : null,
      commission_accrued_usd: Math.round(c.accrued),
      commission_paid_usd: Math.round(c.paid),
    };
  });

  team.sort((a, b) => b.closed - a.closed);
  return NextResponse.json({ team });
}
