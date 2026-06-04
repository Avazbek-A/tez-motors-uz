/**
 * Instant trade-in valuation (Phase AL).
 *
 * Estimates what the dealer might offer for a customer's current car, from the
 * market resale median for that model (built from `market_listings` via
 * market-intel) minus depreciation for age/mileage minus a dealer margin
 * (resale buffer). Pure + unit-tested; the route supplies the market median.
 *
 * This is an ESTIMATE shown as a range — never a binding quote. The dealer
 * confirms after inspection. Returns null when there's no market data to anchor.
 */
export interface TradeInInput {
  /** Resale-market median price (USD) for this brand/model, or null if unknown. */
  marketMedianUsd: number | null;
  year: number | null;
  mileageKm: number | null;
  /** Self-reported condition. */
  condition?: "excellent" | "good" | "fair" | "poor" | null;
  /** Current year for age calc (injected so the fn stays pure/testable). */
  nowYear: number;
}

export interface TradeInEstimate {
  /** Midpoint estimate (USD). */
  estimateUsd: number;
  /** Range shown to the customer. */
  lowUsd: number;
  highUsd: number;
}

const CONDITION_FACTOR: Record<NonNullable<TradeInInput["condition"]>, number> = {
  excellent: 1.0,
  good: 0.92,
  fair: 0.82,
  poor: 0.68,
};

// Dealer needs resale margin + reconditioning headroom; offer sits below market.
const DEALER_BUFFER = 0.85;
// Per-year and per-10k-km depreciation applied to the market anchor.
const PER_YEAR_DEPRECIATION = 0.04;
const PER_10K_KM_DEPRECIATION = 0.02;
const MIN_FACTOR = 0.35; // never depreciate below this fraction of the anchor

export function estimateTradeIn(input: TradeInInput): TradeInEstimate | null {
  if (!input.marketMedianUsd || input.marketMedianUsd <= 0) return null;

  const ageYears = input.year ? Math.max(0, input.nowYear - input.year) : 0;
  const ageFactor = 1 - ageYears * PER_YEAR_DEPRECIATION;

  const km = input.mileageKm && input.mileageKm > 0 ? input.mileageKm : 0;
  const kmFactor = 1 - (km / 10_000) * PER_10K_KM_DEPRECIATION;

  const condFactor = input.condition ? CONDITION_FACTOR[input.condition] : 0.9;

  const combined = Math.max(MIN_FACTOR, ageFactor * kmFactor * condFactor);
  const mid = Math.round(input.marketMedianUsd * combined * DEALER_BUFFER);

  // ±8% range, rounded to the nearest $100.
  const round100 = (n: number) => Math.max(0, Math.round(n / 100) * 100);
  return {
    estimateUsd: round100(mid),
    lowUsd: round100(mid * 0.92),
    highUsd: round100(mid * 1.08),
  };
}
