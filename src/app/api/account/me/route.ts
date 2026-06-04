import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCustomerContext } from "@/lib/customer-auth";

// Aggregated portal payload: who am I, my garage (favorite cars), saved
// searches, and my import orders (matched by phone, since orders predate
// accounts and key on reference_code + phone).
export async function GET(request: NextRequest) {
  const ctx = await getCustomerContext(request);
  if (!ctx) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const supabase = createServiceClient();
  const customerId = ctx.customer.id;
  // Orders / warranties are matched by customer_phone (pre-account inventory).
  // CRITICAL: never match on empty — a Telegram-Mini-App customer signs in by
  // telegram_id with no phone, so `.eq("customer_phone", "")` would otherwise
  // leak every order whose phone field is blank/null to that customer. Skip
  // the queries entirely when the session has no phone.
  const phone = ctx.customer.phone && ctx.customer.phone.trim().length > 0 ? ctx.customer.phone : null;

  const [favRes, searchRes, orderRes, warrantyRes] = await Promise.all([
    supabase.from("favorites").select("car_id").eq("customer_id", customerId),
    supabase
      .from("saved_searches")
      .select("id, label, filters, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    phone
      ? supabase
          .from("orders")
          .select("id, reference_code, status, created_at, updated_at, cars(brand, model, year, slug)")
          .eq("customer_phone", phone)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
    phone
      ? supabase
          .from("warranties")
          .select("car_label, warranty_until, warranty_months, services")
          .eq("customer_phone", phone)
          .order("warranty_until", { ascending: false })
          .then((r) => r, () => ({ data: [] as unknown[] }))
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const favoriteIds = (favRes.data || []).map((r) => r.car_id);

  return NextResponse.json({
    authenticated: true,
    customer: ctx.customer,
    favorite_ids: favoriteIds,
    saved_searches: searchRes.data || [],
    orders: orderRes.data || [],
    warranties: warrantyRes.data || [],
  });
}
