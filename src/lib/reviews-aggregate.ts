/**
 * Per-car review aggregates (Phase AL polish — star ratings on tiles).
 *
 * Reviews link to cars via reviews.car_id (migration 015). The car detail page
 * already shows an AggregateRating; this lets listing TILES show ★ too, which
 * lifts click-through. `summarizeRatings` is a pure reducer (unit-tested);
 * `fetchCarRatings` batches one query for a page of cars.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CarRating {
  avg: number; // rounded to 1 decimal
  count: number;
}

interface RatingRow {
  car_id: string | null;
  rating: number | null;
}

/** Reduce raw published-review rows into per-car {avg, count}. Pure. */
export function summarizeRatings(rows: RatingRow[]): Map<string, CarRating> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    if (!r.car_id || typeof r.rating !== "number") continue;
    const cur = acc.get(r.car_id) || { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    acc.set(r.car_id, cur);
  }
  const out = new Map<string, CarRating>();
  for (const [carId, { sum, n }] of acc) {
    if (n > 0) out.set(carId, { avg: Math.round((sum / n) * 10) / 10, count: n });
  }
  return out;
}

/** Aggregate published-review ratings for a set of cars. Fail-soft to empty. */
export async function fetchCarRatings(
  supabase: SupabaseClient,
  carIds: string[],
): Promise<Map<string, CarRating>> {
  const ids = Array.from(new Set(carIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  try {
    const { data } = await supabase
      .from("reviews")
      .select("car_id, rating")
      .eq("is_published", true)
      .in("car_id", ids)
      .limit(5000);
    return summarizeRatings((data as RatingRow[]) || []);
  } catch {
    return new Map();
  }
}
