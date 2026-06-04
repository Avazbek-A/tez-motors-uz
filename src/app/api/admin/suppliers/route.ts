import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

/**
 * Supplier master + scorecard (Phase AK). Replaces the free-text PO `supplier`
 * field with a managed master. GET returns each supplier enriched with a
 * scorecard computed from their POs + shipments: order volume, avg unit cost,
 * and on-time rate (shipments delivered on/before eta_date). Admin-gated.
 */
const createSchema = z.object({
  name: z.string().min(1).max(120),
  contact: z.string().max(200).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  country: z.string().max(40).optional().nullable(),
  lead_time_days: z.number().int().min(0).max(365).optional().nullable(),
  moq: z.number().int().min(0).max(10000).optional().nullable(),
  payment_terms: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const supabase = createServiceClient();

  const [supRes, poRes, shipRes] = await Promise.all([
    supabase.from("suppliers").select("*").order("name", { ascending: true }).limit(1000),
    supabase.from("purchase_orders").select("supplier_id, supplier, unit_cost_usd, qty").limit(5000),
    supabase.from("shipments").select("supplier, status, eta_date, updated_at").limit(5000),
  ]);

  const suppliers = supRes.data || [];
  const pos = poRes.data || [];
  const ships = shipRes.data || [];

  // PO stats by supplier_id (and legacy name fallback).
  const byId = new Map<string, { orders: number; costSum: number; costN: number }>();
  const byName = new Map<string, { orders: number; costSum: number; costN: number }>();
  for (const p of pos) {
    const bucket = p.supplier_id ? byId : byName;
    const key = (p.supplier_id as string) || ((p.supplier as string) || "").toLowerCase().trim();
    if (!key) continue;
    const cur = bucket.get(key) || { orders: 0, costSum: 0, costN: 0 };
    cur.orders += 1;
    if (p.unit_cost_usd != null) {
      cur.costSum += Number(p.unit_cost_usd);
      cur.costN += 1;
    }
    bucket.set(key, cur);
  }

  // On-time rate by supplier name (shipments key on free-text supplier).
  const ontimeByName = new Map<string, { onTime: number; total: number }>();
  for (const s of ships) {
    const name = ((s.supplier as string) || "").toLowerCase().trim();
    if (!name || !s.eta_date) continue;
    const arrived = s.status === "arrived" || s.status === "delivered" || s.status === "cleared";
    if (!arrived) continue;
    const cur = ontimeByName.get(name) || { onTime: 0, total: 0 };
    cur.total += 1;
    if (new Date(s.updated_at as string) <= new Date(`${s.eta_date}T23:59:59Z`)) cur.onTime += 1;
    ontimeByName.set(name, cur);
  }

  const enriched = suppliers.map((s) => {
    const nameKey = (s.name as string).toLowerCase().trim();
    const stats = byId.get(s.id as string) || byName.get(nameKey) || { orders: 0, costSum: 0, costN: 0 };
    const ot = ontimeByName.get(nameKey);
    return {
      ...s,
      orders: stats.orders,
      avg_unit_cost_usd: stats.costN > 0 ? Math.round(stats.costSum / stats.costN) : null,
      on_time_pct: ot && ot.total > 0 ? Math.round((ot.onTime / ot.total) * 100) : null,
      shipments_tracked: ot?.total ?? 0,
    };
  });

  return NextResponse.json({ suppliers: enriched });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...parsed.data, country: parsed.data.country ?? "CN" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "create", entity: "supplier", entity_id: data.id, diff: { name: parsed.data.name } }).catch(() => {});
  return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}
