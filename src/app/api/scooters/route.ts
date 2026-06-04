import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/auth";
import { SCOOTER_KINDS } from "@/lib/schemas/scooter";
import { reportServerError } from "@/lib/error-report";
import { sanitizePostgrestSearchTerm as sanitizeSearch } from "@/lib/search-safe";

const publicCacheHeaders = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

function parseIntSafe(raw: string | null, min: number, max: number): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, min), max);
}

/** Public scooters/e-bikes listing. Mirrors /api/parts: published-only for anon,
 *  kind + price filters, ilike search on brand/model, paginated. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
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
    let query = supabase.from("scooters").select("*", { count: "exact" });

    if (!all) query = query.eq("is_published", true);
    if (kind && (SCOOTER_KINDS as readonly string[]).includes(kind)) query = query.eq("kind", kind);
    if (priceMin !== null) query = query.gte("price_usd", priceMin);
    if (priceMax !== null) query = query.lte("price_usd", priceMax);
    if (search) query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%`);

    query = query
      .order("order_position", { ascending: true })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;
    if (error) {
      reportServerError("GET /api/scooters list", error).catch(() => {});
      return NextResponse.json({ scooters: [], total: 0, error: "Query failed" }, { status: 500 });
    }
    return NextResponse.json(
      { scooters: data || [], total: count || 0, page, page_size: pageSize },
      { headers: all ? {} : publicCacheHeaders },
    );
  } catch (err) {
    console.error("Scooters list exception:", err);
    return NextResponse.json({ scooters: [], total: 0 }, { status: 500 });
  }
}
