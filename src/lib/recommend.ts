/**
 * Behavioral car recommender (Phase AO).
 *
 * Generalizes the content-based `related-cars` scoring from a single car to a
 * *visitor affinity profile* built from the cars they've engaged with (recently
 * viewed + favorites + saved-search filters). Pure + unit-tested; the route
 * supplies the seed cars and candidates, this ranks them. No ML/training — a
 * transparent affinity score that degrades gracefully (empty profile → no
 * boost, caller falls back to hot-offers).
 */
export interface ScorableCar {
  id: string;
  brand: string;
  body_type: string | null;
  fuel_type: string | null;
  price_usd: number;
}

export interface AffinityProfile {
  brands: Set<string>;
  bodyTypes: Set<string>;
  fuelTypes: Set<string>;
  /** Center of the price band the visitor engaged with (USD), or null. */
  priceCenter: number | null;
}

const norm = (s: string | null | undefined) => (s || "").toLowerCase().trim();

/** Build an affinity profile from the cars a visitor engaged with. */
export function buildProfile(seed: ScorableCar[]): AffinityProfile {
  const brands = new Set<string>();
  const bodyTypes = new Set<string>();
  const fuelTypes = new Set<string>();
  const prices: number[] = [];
  for (const c of seed) {
    if (c.brand) brands.add(norm(c.brand));
    if (c.body_type) bodyTypes.add(norm(c.body_type));
    if (c.fuel_type) fuelTypes.add(norm(c.fuel_type));
    if (c.price_usd > 0) prices.push(c.price_usd);
  }
  const priceCenter = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  return { brands, bodyTypes, fuelTypes, priceCenter };
}

export function profileIsEmpty(p: AffinityProfile): boolean {
  return p.brands.size === 0 && p.bodyTypes.size === 0 && p.fuelTypes.size === 0 && p.priceCenter == null;
}

/** Affinity score of a candidate car against the profile (higher = better fit). */
export function scoreCarForProfile(car: ScorableCar, p: AffinityProfile): number {
  let score = 0;
  if (p.brands.has(norm(car.brand))) score += 3;
  if (car.body_type && p.bodyTypes.has(norm(car.body_type))) score += 2;
  if (car.fuel_type && p.fuelTypes.has(norm(car.fuel_type))) score += 2;
  if (p.priceCenter != null && car.price_usd > 0 && Math.abs(car.price_usd - p.priceCenter) < 10000) score += 1;
  return score;
}

/**
 * Rank candidates by affinity, excluding the seed/engaged ids and zero-score
 * cars (no point recommending something with no affinity at all). Returns up to
 * `max` ids. Empty when the profile yields no positive matches.
 */
export function recommendFromProfile(
  candidates: ScorableCar[],
  profile: AffinityProfile,
  excludeIds: Set<string>,
  max = 8,
): ScorableCar[] {
  if (profileIsEmpty(profile)) return [];
  return candidates
    .filter((c) => !excludeIds.has(c.id))
    .map((c) => ({ car: c, score: scoreCarForProfile(c, profile) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.car.price_usd - a.car.price_usd)
    .slice(0, max)
    .map((x) => x.car);
}
