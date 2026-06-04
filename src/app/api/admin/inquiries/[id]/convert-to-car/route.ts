import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { carWriteSchema } from "@/lib/schemas/car";
import { logAdminAction } from "@/lib/audit";

/**
 * Convert a trade-in inquiry into a USED car listing (acquisition → inventory).
 * Closes the loop: cars the dealer takes in via /sell-your-car flow straight into
 * the /used catalog, prefilled from the trade-in's make/model/year/mileage/photos.
 * Admin-gated, idempotent (won't double-convert), audited.
 *   POST { price_usd }   // the resale list price the dealer sets
 */
const schema = z.object({ price_usd: z.number().int().positive().max(100_000_000) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A positive price_usd is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: inq, error } = await supabase
    .from("inquiries")
    .select("id, type, metadata")
    .eq("id", id)
    .maybeSingle();
  if (error || !inq) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  if (inq.type !== "trade_in") return NextResponse.json({ error: "Not a trade-in inquiry" }, { status: 400 });

  const meta = (inq.metadata || {}) as Record<string, unknown>;
  if (meta.converted_car_id) {
    return NextResponse.json({ error: "Already converted", car_id: meta.converted_car_id }, { status: 409 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const brand = str(meta.make);
  const model = str(meta.model);
  const yearNum = parseInt(str(meta.year), 10);
  const mileageNum = parseInt(String(meta.mileage ?? "").replace(/\D/g, ""), 10);
  const photos = Array.isArray(meta.photos) ? (meta.photos as unknown[]).filter((u): u is string => typeof u === "string") : [];
  const condition = str(meta.condition);

  if (!brand || !model) return NextResponse.json({ error: "Trade-in is missing make/model" }, { status: 422 });
  const year = Number.isFinite(yearNum) ? Math.min(Math.max(yearNum, 2000), 2030) : new Date().getFullYear();

  // Build a used-car payload from the trade-in. condition text → description (the
  // admin can refine + set condition_grade in the car form afterward).
  const payload = {
    brand,
    model,
    year,
    price_usd: parsed.data.price_usd,
    listing_type: "used" as const,
    mileage: Number.isFinite(mileageNum) ? mileageNum : 0,
    inventory_status: "available" as const,
    description_ru: condition ? `Состояние (со слов владельца): ${condition}` : null,
    images: photos,
  };
  const valid = carWriteSchema.safeParse(payload);
  if (!valid.success) return NextResponse.json({ error: "Could not build a valid car", issues: valid.error.issues }, { status: 422 });

  // Used units repeat brand/model/year → always give a unique slug.
  const slug = `${brand}-${model}-${year}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + `-${Math.random().toString(36).slice(2, 6)}`;

  const { data: car, error: insErr } = await supabase
    .from("cars")
    .insert({ ...valid.data, slug })
    .select("id, slug")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Link the inquiry → car, mark it handled so it can't be double-converted.
  await supabase
    .from("inquiries")
    .update({ metadata: { ...meta, converted_car_id: car.id }, status: "closed" })
    .eq("id", id);

  logAdminAction(request, { action: "create", entity: "car", entity_id: car.id, diff: { from_trade_in: id, listing_type: "used", price_usd: parsed.data.price_usd } }).catch(() => {});

  return NextResponse.json({ ok: true, car_id: car.id, slug: car.slug });
}
