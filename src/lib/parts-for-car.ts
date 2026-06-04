/**
 * Parts-for-your-car matching (Phase AL).
 *
 * Connects the parts catalog to the cars a customer actually owns (from their
 * orders), so the dealer can surface "parts that fit your BYD Song Plus" in the
 * account portal and the post-sale service reminder — turning the installed base
 * into recurring parts revenue.
 *
 * `partFitsCar` is a pure predicate (unit-tested); `partsForCar` runs the query.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface OwnedCar {
  brand: string;
  model: string;
  year: number | null;
}

export interface PartLite {
  id: string;
  slug: string;
  name_ru: string | null;
  category: string | null;
  price_usd: number | null;
  images: string[] | null;
  fits_brands: string[] | null;
  fits_models: string[] | null;
  fits_year_from: number | null;
  fits_year_to: number | null;
}

const norm = (s: string) => s.toLowerCase().trim();

/** True iff `part` fits `car` by brand (+ optional model / year-range). */
export function partFitsCar(part: PartLite, car: OwnedCar): boolean {
  const brands = (part.fits_brands || []).map(norm);
  if (brands.length > 0 && !brands.includes(norm(car.brand))) return false;

  const models = (part.fits_models || []).map(norm);
  // Model match is "contains either way" so "Song" matches "Song Plus".
  if (models.length > 0) {
    const cm = norm(car.model);
    const ok = models.some((m) => m === cm || cm.includes(m) || m.includes(cm));
    if (!ok) return false;
  }

  if (car.year != null) {
    if (part.fits_year_from != null && car.year < part.fits_year_from) return false;
    if (part.fits_year_to != null && car.year > part.fits_year_to) return false;
  }
  return true;
}

/**
 * Parts that fit any of the customer's owned cars. Brand-filtered in the DB
 * (GIN index on fits_brands), then refined in-memory by model/year via
 * partFitsCar. Published parts only. Fail-soft to [].
 */
export async function partsForCars(
  supabase: SupabaseClient,
  cars: OwnedCar[],
  limit = 12,
): Promise<PartLite[]> {
  try {
    const brands = Array.from(new Set(cars.map((c) => c.brand).filter(Boolean)));
    if (brands.length === 0) return [];
    const { data } = await supabase
      .from("parts")
      .select("id, slug, name_ru, category, price_usd, images, fits_brands, fits_models, fits_year_from, fits_year_to")
      .eq("is_published", true)
      .overlaps("fits_brands", brands)
      .limit(200);
    const parts = (data as PartLite[]) || [];
    const matched = parts.filter((p) => cars.some((c) => partFitsCar(p, c)));
    return matched.slice(0, limit);
  } catch {
    return [];
  }
}
