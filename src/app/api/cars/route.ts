import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { carWriteSchema } from "@/lib/schemas/car";
import { requireAdmin, isAdminRequest } from "@/lib/auth";

const publicCacheHeaders = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()\\%*]/g, "").slice(0, 64);
}

function parseIntSafe(raw: string | null, min: number, max: number): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, min), max);
}

// GET all cars with optional filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand")?.slice(0, 64) || null;
  const bodyType = searchParams.get("body_type")?.slice(0, 32) || null;
  const fuelType = searchParams.get("fuel_type")?.slice(0, 32) || null;
  const priceMin = parseIntSafe(searchParams.get("price_min"), 0, 100_000_000);
  const priceMax = parseIntSafe(searchParams.get("price_max"), 0, 100_000_000);
  const hotOnly = searchParams.get("hot_only");
  const rawSearch = searchParams.get("search");
  const search = rawSearch ? sanitizeSearch(rawSearch) : null;
  const all = searchParams.get("all") && (await isAdminRequest(request));
  const limit = parseIntSafe(searchParams.get("limit"), 1, 100);
  const ids = searchParams.get("ids"); // comma-separated IDs
  const page = searchParams.get("page");
  const pageSize = searchParams.get("page_size");

  try {
    const supabase = all ? createServiceClient() : await createClient();

    // Pagination mode: use count + range
    if (page !== null) {
      const size = Math.min(parseInt(pageSize || "12") || 12, 50);
      const pageNum = Math.max(parseInt(page) || 1, 1);
      const offset = (pageNum - 1) * size;

      let query = supabase
        .from("cars")
        .select("*", { count: "exact" });

      if (!all) query = query.eq("is_available", true);
      if (brand) query = query.eq("brand", brand);
      if (bodyType) query = query.eq("body_type", bodyType);
      if (fuelType) query = query.eq("fuel_type", fuelType);
      if (priceMin !== null) query = query.gte("price_usd", priceMin);
      if (priceMax !== null) query = query.lte("price_usd", priceMax);
      if (hotOnly === "true") query = query.eq("is_hot_offer", true);
      if (search) query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%`);
      if (ids) {
        const idList = ids.split(",").map((s) => s.trim()).filter((s) => /^[a-f0-9-]{1,64}$/i.test(s)).slice(0, 100);
        if (idList.length > 0) query = query.in("id", idList);
      }

      query = query
        .order("order_position", { ascending: true })
        .order("created_at", { ascending: false })
        .range(offset, offset + size - 1);

      const { data: cars, error, count } = await query;

      if (error) {
        console.error("Supabase error:", error);
        return NextResponse.json({ cars: [], total: 0, error: error.message }, { status: 500 });
      }

      return NextResponse.json(
        { cars: cars || [], total: count || 0, page: pageNum, page_size: size },
        { headers: all ? {} : publicCacheHeaders },
      );
    }

    // Legacy mode (no pagination)
    let query = supabase.from("cars").select("*");

    if (!all) {
      query = query.eq("is_available", true);
    }
    if (brand) query = query.eq("brand", brand);
    if (bodyType) query = query.eq("body_type", bodyType);
    if (fuelType) query = query.eq("fuel_type", fuelType);
    if (priceMin !== null) query = query.gte("price_usd", priceMin);
    if (priceMax !== null) query = query.lte("price_usd", priceMax);
    if (hotOnly === "true") query = query.eq("is_hot_offer", true);
    if (search) {
      query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%`);
    }
    if (ids) {
      const idList = ids.split(",").map((s) => s.trim()).filter((s) => /^[a-f0-9-]{1,64}$/i.test(s)).slice(0, 100);
      if (idList.length > 0) query = query.in("id", idList);
    }

    query = query.order("order_position", { ascending: true }).order("created_at", { ascending: false });

    if (limit !== null) query = query.limit(limit);

    const { data: cars, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ cars: [], total: 0, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        cars: cars || [],
        total: cars?.length || 0,
        filters: { brand, bodyType, fuelType, priceMin, priceMax },
      },
      { headers: all ? {} : publicCacheHeaders },
    );
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ cars: [], total: 0, error: "Internal server error" }, { status: 500 });
  }
}

// POST - add a new car (admin)
export async function POST(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  try {
    const body = await request.json();
    const result = carWriteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.issues },
        { status: 400 }
      );
    }

    const data = result.data;
    const supabase = createServiceClient();

    const slug = `${data.brand}-${data.model}-${data.year}`
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const { data: car, error } = await supabase
      .from("cars")
      .insert({ ...data, slug })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, car }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to create car" }, { status: 500 });
  }
}
