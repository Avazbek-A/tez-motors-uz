import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { salePrice } from "@/lib/promotions";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("id, car_id, label, sale_price_usd, pre_promo_price_usd, starts_at, ends_at, status, created_at, cars(brand, model, year, price_usd)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promotions: data ?? [] });
}

const createSchema = z
  .object({
    car_id: z.string().uuid(),
    label: z.string().max(160).optional().nullable(),
    pct_off: z.number().min(1).max(90).optional().nullable(),
    fixed_price_usd: z.number().min(1).max(100_000_000).optional().nullable(),
    starts_at: z.string().max(40).optional().nullable(),
    ends_at: z.string().max(40).optional().nullable(),
  })
  .refine((d) => d.pct_off != null || d.fixed_price_usd != null, "Provide pct_off or fixed_price_usd");

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

  const supabase = createServiceClient();
  const { data: car } = await supabase.from("cars").select("price_usd").eq("id", parsed.data.car_id).maybeSingle();
  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  const sale = salePrice(Number(car.price_usd) || 0, { pctOff: parsed.data.pct_off, fixedPrice: parsed.data.fixed_price_usd });
  if (sale <= 0 || sale >= (Number(car.price_usd) || 0)) {
    return NextResponse.json({ error: "Sale price must be below the current price" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("promotions")
    .insert({
      car_id: parsed.data.car_id,
      label: parsed.data.label ?? null,
      sale_price_usd: sale,
      starts_at: parsed.data.starts_at ?? null,
      ends_at: parsed.data.ends_at ?? null,
      status: "scheduled",
    })
    .select("id")
    .single();
  if (error) {
    // Unique index → one live promo per car.
    if (error.code === "23505") return NextResponse.json({ error: "This car already has a live promotion." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAdminAction(request, { action: "create", entity: "promotion", entity_id: data?.id, diff: { car_id: parsed.data.car_id, sale } }).catch(() => {});
  return NextResponse.json({ success: true, id: data?.id, sale_price_usd: sale }, { status: 201 });
}
