import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

// GET - list orders (admin). Joins the car for display; events are fetched
// on demand by the detail PATCH route, so the list stays light.
export async function GET(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const supabase = createServiceClient();
    let query = supabase
      .from("orders")
      .select(
        "id, reference_code, status, customer_name, customer_phone, customer_email, locale, amount_usd, notes, created_at, updated_at, car_id, cars(brand, model, year, slug)",
      )
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("Orders fetch error:", error);
      return NextResponse.json({ orders: [], total: 0 }, { status: 500 });
    }

    return NextResponse.json({ orders: orders || [], total: orders?.length || 0 });
  } catch {
    return NextResponse.json({ orders: [], total: 0, error: "Internal server error" }, { status: 500 });
  }
}
