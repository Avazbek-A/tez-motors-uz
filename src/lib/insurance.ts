/**
 * Insurance estimators (Phase AP).
 *
 * Indicative OSAGO (mandatory third-party) and KASKO (optional comprehensive)
 * premiums so the dealer can attach insurance at the point of sale and earn a
 * commission. Pure + unit-tested. These are ESTIMATES for lead capture — the
 * actual policy is bound by the insurer/partner, not here.
 *
 * OSAGO in Uzbekistan is formula-based: a base tariff scaled by region and
 * driver coefficients. KASKO is a percentage of the car's value. The constants
 * below are reasonable defaults the dealer can tune; we never present these as
 * a binding quote.
 */
export type Region = "tashkent_city" | "tashkent_region" | "other";

// Base annual OSAGO tariff (USD-equivalent) before coefficients.
const OSAGO_BASE_USD = 12;
// Region multiplier — Tashkent city is the highest-traffic, highest-risk zone.
const REGION_COEF: Record<Region, number> = {
  tashkent_city: 1.6,
  tashkent_region: 1.3,
  other: 1.0,
};

export interface OsagoInput {
  region: Region;
  /** Engine power in hp — higher power → higher tariff band. */
  enginePowerHp?: number | null;
  /** Limited driver list gets a small discount vs unlimited. */
  unlimitedDrivers?: boolean;
}

/** Indicative annual OSAGO premium (USD). Pure. */
export function estimateOsago(input: OsagoInput): number {
  const region = REGION_COEF[input.region] ?? 1.0;
  const hp = Math.max(0, input.enginePowerHp ?? 0);
  // Power band coefficient: ≤100hp 1.0, ≤150 1.2, ≤200 1.4, >200 1.6.
  const power = hp <= 100 ? 1.0 : hp <= 150 ? 1.2 : hp <= 200 ? 1.4 : 1.6;
  const drivers = input.unlimitedDrivers ? 1.3 : 1.0;
  return Math.round(OSAGO_BASE_USD * region * power * drivers);
}

export interface KaskoInput {
  /** Car value in USD. */
  carValueUsd: number;
  /** New cars get a lower rate than used. */
  isNew?: boolean;
}

// KASKO annual premium as a % of car value.
const KASKO_RATE_NEW = 0.035;
const KASKO_RATE_USED = 0.05;

/** Indicative annual KASKO premium (USD). Pure. */
export function estimateKasko(input: KaskoInput): number {
  const value = Math.max(0, input.carValueUsd || 0);
  if (value <= 0) return 0;
  const rate = input.isNew ? KASKO_RATE_NEW : KASKO_RATE_USED;
  return Math.round(value * rate);
}
