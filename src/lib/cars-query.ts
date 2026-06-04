/**
 * Shared catalog query — used by BOTH the /api/cars route and the server-
 * rendered catalog page so they can't drift. Pure DB access; the caller parses
 * params, computes any trigram search ids, and applies cache headers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_CAR_COLUMNS } from "@/lib/car-columns";

interface Sortable {
  price_usd: number;
  year: number;
  brand: string;
  model: string;
}

/** Sort a page of cars in JS (mirrors the catalog's sort options). */
export function applySort<T extends Sortable>(items: T[], sort: string | null): T[] {
  const next = [...items];
  switch (sort) {
    case "price_asc":
      return next.sort((a, b) => a.price_usd - b.price_usd);
    case "price_desc":
      return next.sort((a, b) => b.price_usd - a.price_usd);
    case "year_desc":
      return next.sort((a, b) => b.year - a.year);
    case "name_asc":
      return next.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
    default:
      return next.sort((a, b) => b.year - a.year);
  }
}

export interface CarsPageOpts {
  page: number;
  pageSize: number;
  brand?: string | null;
  bodyType?: string | null;
  fuelType?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  /** 'new' | 'used' — the used-car section filters on this. */
  listingType?: string | null;
  /** Max mileage (km) — used-car filter. */
  mileageMax?: number | null;
  hotOnly?: boolean;
  search?: string | null;
  /** Pre-resolved trigram match ids (caller runs the RPC once). */
  searchIds?: string[] | null;
  /** Explicit id allow-list (already validated). */
  ids?: string[] | null;
  sort?: string | null;
  /** Admin mode: include sold cars. */
  includeAll?: boolean;
}

/** Fetch one page of cars with filters + sort. Returns the page and total count. */
export async function fetchCarsPage(
  supabase: SupabaseClient,
  opts: CarsPageOpts,
): Promise<{ cars: Sortable[]; total: number }> {
  const size = Math.min(opts.pageSize || 12, 50);
  const pageNum = Math.max(opts.page || 1, 1);
  const offset = (pageNum - 1) * size;

  // Explicit column list (PUBLIC_CAR_COLUMNS) — never "*", so any internal
  // column added to `cars` doesn't leak through the catalog list.
  let query = supabase.from("cars").select(PUBLIC_CAR_COLUMNS, { count: "exact" });

  if (!opts.includeAll) query = query.neq("inventory_status", "sold");
  if (opts.brand) query = query.eq("brand", opts.brand);
  if (opts.bodyType) query = query.eq("body_type", opts.bodyType);
  if (opts.fuelType) query = query.eq("fuel_type", opts.fuelType);
  if (opts.priceMin != null) query = query.gte("price_usd", opts.priceMin);
  if (opts.priceMax != null) query = query.lte("price_usd", opts.priceMax);
  if (opts.listingType === "new" || opts.listingType === "used") query = query.eq("listing_type", opts.listingType);
  if (opts.mileageMax != null) query = query.lte("mileage", opts.mileageMax);
  if (opts.hotOnly) query = query.eq("is_hot_offer", true);
  if (opts.search) {
    if (opts.searchIds && opts.searchIds.length > 0) {
      query = query.in("id", opts.searchIds);
    } else {
      query = query.or(
        `brand.ilike.%${opts.search}%,model.ilike.%${opts.search}%,description_ru.ilike.%${opts.search}%`,
      );
    }
  }
  if (opts.ids && opts.ids.length > 0) query = query.in("id", opts.ids);

  query = query
    .order("order_position", { ascending: true })
    .order("created_at", { ascending: false })
    .range(offset, offset + size - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { cars: applySort((data || []) as unknown as Sortable[], opts.sort ?? null), total: count || 0 };
}
