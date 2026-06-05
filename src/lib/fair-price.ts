/**
 * Buyer-facing fair-price signal (Phase AU).
 *
 * Reuses the resale-market median (from `market_listings`, the same data that
 * powers the trade-in estimate and the Buying Brain) to tell a shopper whether a
 * car is priced BELOW or AT the market for its model — a concrete trust + value
 * signal for an importer competing on price.
 *
 * Deliberately one-sided: it only ever surfaces "below market" or "fair". It
 * NEVER labels a car "overpriced" — that would sabotage the dealer's own sale,
 * and noisy scrape data shouldn't talk a buyer out of a purchase. Requires a
 * minimum sample so a single stale listing can't drive the badge. Pure +
 * unit-tested.
 */
export interface PriceAssessment {
  /** null = don't show a badge (above market, or not enough data). */
  label: "below_market" | "fair" | null;
  /** How far below the median, as a positive percent (0 when fair/above). */
  belowPct: number;
  /** Estimated saving vs the market median (USD, 0 when fair/above). */
  savingsUsd: number;
  /** Market sample size the assessment is based on. */
  sample: number;
}

/** Minimum comparable listings before we'll show anything. */
export const MIN_SAMPLE = 3;
/** Below the median by at least this % → "below market"; within this band → "fair". */
const BELOW_THRESHOLD_PCT = 3;
/** Above the median by more than this % → show nothing (never "overpriced"). */
const FAIR_CEILING_PCT = 5;

export function assessPrice(
  priceUsd: number | null | undefined,
  marketMedianUsd: number | null | undefined,
  sample: number,
): PriceAssessment {
  const none: PriceAssessment = { label: null, belowPct: 0, savingsUsd: 0, sample };
  if (!priceUsd || priceUsd <= 0 || !marketMedianUsd || marketMedianUsd <= 0) return none;
  if (sample < MIN_SAMPLE) return none;

  const deltaPct = ((priceUsd - marketMedianUsd) / marketMedianUsd) * 100;

  if (deltaPct <= -BELOW_THRESHOLD_PCT) {
    return {
      label: "below_market",
      belowPct: Math.round(-deltaPct),
      savingsUsd: Math.round(marketMedianUsd - priceUsd),
      sample,
    };
  }
  if (deltaPct <= FAIR_CEILING_PCT) {
    return { label: "fair", belowPct: 0, savingsUsd: 0, sample };
  }
  // Above market by more than the ceiling → show nothing.
  return none;
}
