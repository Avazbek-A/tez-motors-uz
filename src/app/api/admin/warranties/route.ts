import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { warrantyUntil } from "@/lib/warranty";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("warranties").select("*").order("warranty_until", { ascending: true, nullsFirst: false }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ warranties: data ?? [] });
}

const createSchema = z.object({
  order_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().min(1).max(160),
  customer_phone: z.string().max(30).optional().nullable(),
  car_label: z.string().min(1).max(200),
  vin: z.string().max(40).optional().nullable(),
  delivered_at: z.string().max(20).optional().nullable(),
  warranty_months: z.number().int().min(0).max(120).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const months = parsed.data.warranty_months ?? 12;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("warranties")
    .insert({
      order_id: parsed.data.order_id ?? null,
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone ?? null,
      car_label: parsed.data.car_label,
      vin: parsed.data.vin ?? null,
      delivered_at: parsed.data.delivered_at ?? null,
      warranty_months: months,
      warranty_until: warrantyUntil(parsed.data.delivered_at, months),
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "create", entity: "warranty", entity_id: data?.id, diff: { car: parsed.data.car_label } }).catch(() => {});
  return NextResponse.json({ success: true, id: data?.id }, { status: 201 });
}
