/**
 * Shared catalog query — used by BOTH the /api/cars route and the server-
 * rendered catalog page so they can't drift. Pure DB access; the caller parses
 * params, computes any trigram search ids, and applies cache headers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_CAR_LIST_COLUMNS } from "@/lib/car-columns";
import { scopeToTenant } from "@/lib/tenant-context";
import { stripPublicSpecData, type SpecData } from "@/lib/autohome-spec";

/** Provenance keys in the legacy `specs` jsonb — internal only, never for clients.
 *  (Every car's `specs` is { source:"autohome", confidence, autohome_id } — pure
 *  provenance with no display value; the car page used to render it as a grid.) */
const PROVENANCE_SPECS_KEYS = ["source", "confidence", "autohome_id"];

/** Internal-only TOP-LEVEL car columns — never exposed to clients. These are
 *  valuation inputs (provenance, battery health, warranty start) used by the
 *  pricing engine; some are sensitive (a "gray" import_channel must not be shown
 *  to buyers). Stripped here so any public select("*") path is covered. */
const PRIVATE_CAR_COLUMNS = ["import_channel", "battery_soh_pct", "in_service_date"];

/** Strip internal provenance fields from spec_data, the legacy specs jsonb, AND
 *  the private top-level columns on each public row (in place). */
export function scrubCarsForPublic<T>(rows: T[]): T[] {
  for (const row of rows) {
    const r = row as { spec_data?: SpecData | null; specs?: Record<string, unknown> | null } & Record<string, unknown>;
    if (r && r.spec_data) r.spec_data = stripPublicSpecData(r.spec_data);
    if (r && r.specs && typeof r.specs === "object") {
      const s: Record<string, unknown> = { ...r.specs };
      for (const k of PROVENANCE_SPECS_KEYS) delete s[k];
      r.specs = s;
    }
    if (r) for (const k of PRIVATE_CAR_COLUMNS) delete r[k];
  }
  return rows;
}

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
  yearMin?: number | null;
  yearMax?: number | null;
  transmission?: string | null;
  drivetrain?: string | null; // AWD | RWD | FWD
  seatsMin?: number | null;
  rangeMin?: number | null; // min electric range (km)
  powerMin?: number | null; // min horsepower
  hotOnly?: boolean;
  search?: string | null;
  /** Pre-resolved trigram match ids (caller runs the RPC once). */
  searchIds?: string[] | null;
  /** Explicit id allow-list (already validated). */
  ids?: string[] | null;
  sort?: string | null;
  /** Admin mode: include sold cars. */
  includeAll?: boolean;
  /** Tenant to scope to (multi-tenant). No-op while MULTI_TENANT is off. */
  tenantId?: string | null;
}

/** Fetch one page of cars with filters + sort. Returns the page and total count. */
export async function fetchCarsPage(
  supabase: SupabaseClient,
  opts: CarsPageOpts,
): Promise<{ cars: Sortable[]; total: number }> {
  const size = Math.min(opts.pageSize || 12, 50);
  const pageNum = Math.max(opts.page || 1, 1);
  const offset = (pageNum - 1) * size;

  // Explicit column list (PUBLIC_CAR_LIST_COLUMNS) — never "*", so any internal
  // column added to `cars` doesn't leak through the catalog list. Uses the LIST
  // subset (no spec_data/specs/descriptions/video_url) so a 24-card page doesn't
  // serialize ~2MB of detail-only data; the detail page selects the full set.
  let query = supabase.from("cars").select(PUBLIC_CAR_LIST_COLUMNS, { count: "exact" });

  if (opts.tenantId) query = scopeToTenant(query, opts.tenantId);
  if (!opts.includeAll) query = query.neq("inventory_status", "sold");
  if (opts.brand) query = query.eq("brand", opts.brand);
  if (opts.bodyType) query = query.eq("body_type", opts.bodyType);
  if (opts.fuelType) query = query.eq("fuel_type", opts.fuelType);
  if (opts.priceMin != null) query = query.gte("price_usd", opts.priceMin);
  if (opts.priceMax != null) query = query.lte("price_usd", opts.priceMax);
  // Public catalog defaults to NEW cars; the used classifieds live only on /used
  // (which passes listing_type='used' explicitly). Admin (includeAll) sees both so
  // the dealer can manage every listing.
  if (opts.listingType === "new" || opts.listingType === "used") {
    query = query.eq("listing_type", opts.listingType);
  } else if (!opts.includeAll) {
    query = query.eq("listing_type", "new");
  }
  if (opts.mileageMax != null) query = query.lte("mileage", opts.mileageMax);
  if (opts.yearMin != null) query = query.gte("year", opts.yearMin);
  if (opts.yearMax != null) query = query.lte("year", opts.yearMax);
  if (opts.transmission) query = query.eq("transmission", opts.transmission);
  if (opts.drivetrain) query = query.eq("drivetrain", opts.drivetrain);
  if (opts.seatsMin != null) query = query.gte("seats", opts.seatsMin);
  if (opts.rangeMin != null) query = query.gte("range_km", opts.rangeMin);
  if (opts.powerMin != null) query = query.gte("engine_power", opts.powerMin);
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
  // Public reads get internal spec_data fields stripped; admin (includeAll) keeps them
  // so the dealer can still see series_id/source for re-import etc.
  if (!opts.includeAll) scrubCarsForPublic(data || []);
  return { cars: applySort((data || []) as unknown as Sortable[], opts.sort ?? null), total: count || 0 };
}
