import { createServiceClient } from "@/lib/supabase/service";
import { CAR_BRANDS } from "@/lib/constants";

/**
 * URL-safe brand slug: lowercase, runs of non-alphanumerics → a single hyphen,
 * trimmed. Handles brands with spaces / punctuation:
 *   "Lynk&Co" → "lynk-co", "Li Auto" → "li-auto", "Mercedes-Benz" → "mercedes-benz".
 * Used by the brand landing pages for canonical URLs + slug↔brand resolution.
 */
export function brandSlug(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

let cache: string[] | null = null;
let cachedAt = 0;
const TTL_MS = 10 * 60 * 1000;

/**
 * Distinct brands in live (non-sold) inventory, sorted. So every in-stock brand
 * gets a /catalog/brand/<slug> landing page (auto-covers new brands on rebuild),
 * not just a hardcoded list. Cached 10 min; falls back to CAR_BRANDS if the DB is
 * unreachable (e.g. a build with no DB env).
 */
export async function getInventoryBrands(): Promise<string[]> {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("cars").select("brand").neq("inventory_status", "sold");
    const brands = [...new Set((data || []).map((r: { brand: string | null }) => r.brand).filter((b): b is string => !!b))]
      .sort((a, b) => a.localeCompare(b));
    if (brands.length) { cache = brands; cachedAt = Date.now(); return brands; }
  } catch {
    // fall through to the static list
  }
  return [...CAR_BRANDS];
}

/** Resolve a brand slug back to its exact inventory brand string (for the eq filter). */
export async function brandFromSlug(slug: string): Promise<string | null> {
  const brands = await getInventoryBrands();
  return brands.find((b) => brandSlug(b) === slug) ?? null;
}
