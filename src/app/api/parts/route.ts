import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/auth";
import { PART_CATEGORIES } from "@/lib/schemas/part";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const fitsBrand = searchParams.get("fits_brand");
  const fitsModel = searchParams.get("fits_model");
  const year = parseIntSafe(searchParams.get("year"), 1990, 2050);
  const priceMin = parseIntSafe(searchParams.get("price_min"), 0, 10_000_000);
  const priceMax = parseIntSafe(searchParams.get("price_max"), 0, 10_000_000);
  const rawSearch = searchParams.get("search") ?? searchParams.get("q");
  const search = rawSearch ? sanitizeSearch(rawSearch) : null;
  const all = searchParams.get("all") && (await isAdminRequest(request));
  const pageSize = Math.min(parseIntSafe(searchParams.get("page_size"), 1, 48) ?? 12, 48);
  const page = Math.max(parseIntSafe(searchParams.get("page"), 1, 10_000) ?? 1, 1);
  const offset = (page - 1) * pageSize;

  try {
    const supabase = all ? createServiceClient() : await createClient();

    // Trigram-backed search with typo tolerance; falls back to ILIKE
    // if the RPC returns nothing (zero threshold misses).
    let searchIds: string[] | null = null;
    if (search) {
      const { data: rpc } = await supabase.rpc("search_parts_ids", {
        q: search,
        max_results: 200,
      });
      if (Array.isArray(rpc) && rpc.length > 0) {
        searchIds = rpc.map((r: { id: string }) => r.id);
      }
    }

    let query = supabase.from("parts").select("*", { count: "exact" });

    if (!all) query = query.eq("is_published", true);
    if (category && PART_CATEGORIES.includes(category as (typeof PART_CATEGORIES)[number])) {
      query = query.eq("category", category);
    }
    if (fitsBrand) query = query.contains("fits_brands", [fitsBrand]);
    if (fitsModel) query = query.contains("fits_models", [fitsModel]);
    if (year !== null) {
      query = query.or(
        `and(fits_year_from.is.null,fits_year_to.is.null),and(fits_year_from.lte.${year},fits_year_to.gte.${year}),and(fits_year_from.lte.${year},fits_year_to.is.null),and(fits_year_from.is.null,fits_year_to.gte.${year})`,
      );
    }
    if (priceMin !== null) query = query.gte("price_usd", priceMin);
    if (priceMax !== null) query = query.lte("price_usd", priceMax);

    if (search) {
      if (searchIds && searchIds.length > 0) {
        query = query.in("id", searchIds);
      } else {
        const isOem = /^[A-Za-z0-9-]{4,}$/.test(search);
        if (isOem) {
          query = query.or(
            `oem_number.eq.${search},name_ru.ilike.%${search}%,name_en.ilike.%${search}%,brand.ilike.%${search}%`,
          );
        } else {
          query = query.or(
            `name_ru.ilike.%${search}%,name_en.ilike.%${search}%,brand.ilike.%${search}%`,
          );
        }
      }
    }

    query = query
      .order("order_position", { ascending: true })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error("Parts list error:", error);
      return NextResponse.json({ parts: [], total: 0, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { parts: data || [], total: count || 0, page, page_size: pageSize },
      { headers: all ? {} : publicCacheHeaders },
    );
  } catch (err) {
    console.error("Parts list exception:", err);
    return NextResponse.json({ parts: [], total: 0 }, { status: 500 });
  }
}
