import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { generateListing, type ListingCar, type ListingChannel } from "@/lib/listing-content";

/**
 * Off-site listing syndication queue (Phase AJ). Admin-gated.
 *  GET   — available cars + their listing rows (grouped) for the distribution board.
 *  POST  — generate a draft listing for { car_id, channel, locale }.
 *  PATCH — mark a listing published (records external_url for attribution) or removed.
 */
const CHANNELS = ["olx", "avtoelon", "telegram", "instagram", "facebook"] as const;

const createSchema = z.object({
  car_id: z.string().uuid(),
  channel: z.enum(CHANNELS),
  locale: z.enum(["ru", "uz", "en"]).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["published", "removed"]),
  external_url: z.string().url().max(2000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const supabase = createServiceClient();
  const [carsRes, listRes] = await Promise.all([
    supabase
      .from("cars")
      .select("id, brand, model, year, price_usd, thumbnail, images, inventory_status")
      .neq("inventory_status", "sold")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("listings")
      .select("id, car_id, channel, status, title, body, external_url, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  return NextResponse.json({ cars: carsRes.data || [], listings: listRes.data || [] });
}

export async function POST(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const supabase = createServiceClient();

  const { data: car } = await supabase
    .from("cars")
    .select("brand, model, year, price_usd, mileage, fuel_type, body_type, color, transmission, description_ru, listing_type")
    .eq("id", parsed.data.car_id)
    .maybeSingle();
  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  const draft = await generateListing(car as ListingCar, parsed.data.channel as ListingChannel, parsed.data.locale ?? "ru");

  const { data: inserted, error } = await supabase
    .from("listings")
    .insert({
      car_id: parsed.data.car_id,
      channel: parsed.data.channel,
      status: "draft",
      title: draft.title,
      body: draft.body,
    })
    .select("id, car_id, channel, status, title, body, external_url, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, {
    action: "create",
    entity: "listing",
    entity_id: inserted.id,
    diff: { channel: parsed.data.channel, ai: draft.ai },
  }).catch(() => {});

  return NextResponse.json({ success: true, listing: inserted }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("listings")
    .update({
      status: parsed.data.status,
      external_url: parsed.data.external_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, {
    action: "update",
    entity: "listing",
    entity_id: parsed.data.id,
    diff: { status: parsed.data.status },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
