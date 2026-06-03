import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { carWriteSchema } from "@/lib/schemas/car";
import { requireAdmin, isAdminRequest } from "@/lib/auth";
import { priceFromMonthly } from "@/lib/finance";
import { logAdminAction } from "@/lib/audit";
import { postCarToChannel } from "@/lib/telegram";
import { applySort, fetchCarsPage } from "@/lib/cars-query";

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
  const priceMaxRaw = parseIntSafe(searchParams.get("price_max"), 0, 100_000_000);
  // Monthly-budget filter: translate "I can pay $X/mo" into a price ceiling via
  // the shared PMT inversion (default down %, APR, term). Combined with any
  // explicit price_max by taking the tighter of the two.
  const monthlyMax = parseIntSafe(searchParams.get("monthly_max"), 1, 1_000_000);
  const priceCeilingFromMonthly = monthlyMax !== null ? Math.floor(priceFromMonthly(monthlyMax)) : null;
  const priceMax =
    priceMaxRaw !== null && priceCeilingFromMonthly !== null
      ? Math.min(priceMaxRaw, priceCeilingFromMonthly)
      : priceMaxRaw ?? priceCeilingFromMonthly;
  const hotOnly = searchParams.get("hot_only");
  const rawSearch = searchParams.get("search") ?? searchParams.get("q");
  const search = rawSearch ? sanitizeSearch(rawSearch) : null;
  const sort = searchParams.get("sort");
  const all = searchParams.get("all") && (await isAdminRequest(request));
  const limit = parseIntSafe(searchParams.get("limit"), 1, 100);
  const ids = searchParams.get("ids"); // comma-separated IDs
  const page = searchParams.get("page");
  const pageSize = searchParams.get("page_size");

  try {
    const supabase = all ? createServiceClient() : await createClient();

    // If a search query is present, resolve matching IDs via the trigram
    // RPC and fall back to ILIKE on miss. This gives typo tolerance
    // ("biyd" → "BYD") without losing literal substring matches.
    let searchIds: string[] | null = null;
    if (search) {
      const { data: rpc } = await supabase.rpc("search_cars_ids", {
        q: search,
        max_results: 200,
      });
      if (Array.isArray(rpc) && rpc.length > 0) {
        searchIds = rpc.map((r: { id: string }) => r.id);
      }
    }

    // Pagination mode: use count + range (shared with the server-rendered catalog).
    if (page !== null) {
      const size = Math.min(parseInt(pageSize || "12") || 12, 50);
      const pageNum = Math.max(parseInt(page) || 1, 1);
      const idList = ids
        ? ids.split(",").map((s) => s.trim()).filter((s) => /^[a-f0-9-]{1,64}$/i.test(s)).slice(0, 100)
        : null;

      try {
        const { cars, total } = await fetchCarsPage(supabase, {
          page: pageNum,
          pageSize: size,
          brand,
          bodyType,
          fuelType,
          priceMin,
          priceMax,
          hotOnly: hotOnly === "true",
          search,
          searchIds,
          ids: idList,
          sort,
          includeAll: !!all,
        });
        return NextResponse.json(
          { cars, total, page: pageNum, page_size: size },
          { headers: all ? {} : publicCacheHeaders },
        );
      } catch (err) {
        console.error("Supabase error:", err);
        return NextResponse.json({ cars: [], total: 0, error: "query failed" }, { status: 500 });
      }
    }

    // Legacy mode (no pagination)
    let query = supabase.from("cars").select("*");

    if (!all) {
      query = query.neq("inventory_status", "sold");
    }
    if (brand) query = query.eq("brand", brand);
    if (bodyType) query = query.eq("body_type", bodyType);
    if (fuelType) query = query.eq("fuel_type", fuelType);
    if (priceMin !== null) query = query.gte("price_usd", priceMin);
    if (priceMax !== null) query = query.lte("price_usd", priceMax);
    if (hotOnly === "true") query = query.eq("is_hot_offer", true);
    if (search) {
      if (searchIds && searchIds.length > 0) {
        query = query.in("id", searchIds);
      } else {
        query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%,description_ru.ilike.%${search}%`);
      }
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
        cars: applySort(cars || [], sort),
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

    logAdminAction(request, {
      action: "create",
      entity: "car",
      entity_id: car?.id,
      diff: { brand: data.brand, model: data.model, year: data.year, price_usd: data.price_usd, slug },
    }).catch(() => {});

    // New arrival → auto-announce to the Telegram channel (free reach, fail-open).
    if (data.inventory_status === "available") {
      postCarToChannel({
        brand: data.brand,
        model: data.model,
        year: data.year,
        price_usd: data.price_usd,
        slug,
        images: data.images,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, car }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to create car" }, { status: 500 });
  }
}
