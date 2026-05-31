import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCustomer } from "@/lib/customer-auth";

const carIdSchema = z.object({ car_id: z.string().regex(/^[a-f0-9-]{1,64}$/i) });
// For the one-time localStorage -> account migration on login.
const bulkSchema = z.object({ car_ids: z.array(z.string().regex(/^[a-f0-9-]{1,64}$/i)).max(200) });

// GET — the logged-in customer's favorite car IDs.
export async function GET(request: NextRequest) {
  const auth = await requireCustomer(request);
  if ("response" in auth) return auth.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("car_id")
    .eq("customer_id", auth.context.customer.id);

  if (error) return NextResponse.json({ car_ids: [] }, { status: 500 });
  return NextResponse.json({ car_ids: (data || []).map((r) => r.car_id) });
}

// POST — add a favorite, or bulk-merge localStorage favorites on first login.
export async function POST(request: NextRequest) {
  const auth = await requireCustomer(request);
  if ("response" in auth) return auth.response;
  const customerId = auth.context.customer.id;
  const supabase = createServiceClient();

  const body = await request.json().catch(() => null);

  const bulk = bulkSchema.safeParse(body);
  if (bulk.success) {
    const rows = bulk.data.car_ids.map((car_id) => ({ customer_id: customerId, car_id }));
    if (rows.length > 0) {
      await supabase.from("favorites").upsert(rows, { onConflict: "customer_id,car_id" });
    }
    return NextResponse.json({ success: true });
  }

  const single = carIdSchema.safeParse(body);
  if (!single.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
  const { error } = await supabase
    .from("favorites")
    .upsert({ customer_id: customerId, car_id: single.data.car_id }, { onConflict: "customer_id,car_id" });
  if (error) return NextResponse.json({ success: false }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — remove a favorite (?car_id=...).
export async function DELETE(request: NextRequest) {
  const auth = await requireCustomer(request);
  if ("response" in auth) return auth.response;

  const carId = new URL(request.url).searchParams.get("car_id");
  const parsed = carIdSchema.safeParse({ car_id: carId });
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid car_id" }, { status: 400 });
  }
  const supabase = createServiceClient();
  await supabase
    .from("favorites")
    .delete()
    .eq("customer_id", auth.context.customer.id)
    .eq("car_id", parsed.data.car_id);
  return NextResponse.json({ success: true });
}
