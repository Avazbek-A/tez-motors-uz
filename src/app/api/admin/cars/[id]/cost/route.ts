import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

/**
 * Set / clear a car's purchase cost (USD) for the profit ledger.
 * Cost lives in the service-role-only car_costs table — never on public.cars.
 */
const schema = z.object({ cost_usd: z.number().min(0).nullable() });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "cost_usd must be a non-negative number or null" }, { status: 400 });
  }

  const supabase = createServiceClient();
  if (parsed.data.cost_usd == null) {
    const { error } = await supabase.from("car_costs").delete().eq("car_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("car_costs")
      .upsert({ car_id: id, cost_usd: parsed.data.cost_usd, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAdminAction(request, {
    action: "update",
    entity: "car_cost",
    entity_id: id,
    diff: { cost_usd: parsed.data.cost_usd },
  }).catch(() => {});

  return NextResponse.json({ success: true, cost_usd: parsed.data.cost_usd });
}
