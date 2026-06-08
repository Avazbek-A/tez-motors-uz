/**
 * Landed-cost pricing engine for imported cars (China → Uzbekistan).
 *
 * Turns a purchase cost into a recommended retail price by layering the real
 * import costs an importer pays: freight, customs clearance, duty, excise, a
 * recycling fee, VAT, then a dealer margin. Pure + deterministic so it can be
 * unit-tested and reused everywhere (admin pricing tool, bulk CSV import).
 *
 * The rates are PARAMETERS, not hard-coded law: UZ tariffs vary by engine type,
 * volume, and age and change yearly, so the dealer tunes them. The defaults are
 * conservative round numbers, NOT tax advice — the engine's job is consistent,
 * transparent arithmetic, not to be the customs authority.
 */
import type { Locale } from "@/i18n/config";

export interface PricingParams {
  /** Ocean/rail freight + inland delivery, flat USD. */
  freightUsd: number;
  /** Customs broker / clearance handling, flat USD. */
  clearanceUsd: number;
  /** Customs duty, % of (cost + freight + clearance). EVs are often 0 in UZ. */
  dutyPct: number;
  /** Excise tax, flat USD (UZ excise depends on engine cc — pass the figure). */
  exciseUsd: number;
  /** Recycling / utilization fee (утильсбор), flat USD. */
  recyclingUsd: number;
  /** VAT, % applied on the dutiable base (cost+freight+clearance+duty+excise+recycling). */
  vatPct: number;
  /** Dealer margin, % of the landed cost. */
  marginPct: number;
  /** Round the final USD price to the nearest this (0 = no rounding). */
  roundUsdTo: number;
}

export const PRICING_DEFAULTS: PricingParams = {
  freightUsd: 2000,
  clearanceUsd: 500,
  dutyPct: 0,
  exciseUsd: 0,
  recyclingUsd: 0,
  vatPct: 12,
  marginPct: 12,
  roundUsdTo: 100,
};

export interface PricingLine {
  key: string;
  label: string;
  amountUsd: number;
}

export interface PricingResult {
  costUsd: number;
  freightUsd: number;
  clearanceUsd: number;
  dutyUsd: number;
  exciseUsd: number;
  recyclingUsd: number;
  dutiableBaseUsd: number;
  vatUsd: number;
  landedUsd: number;
  marginUsd: number;
  priceUsd: number;
  /** Ordered breakdown for display. */
  lines: PricingLine[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampPct(p: number): number {
  if (!Number.isFinite(p) || p < 0) return 0;
  return Math.min(p, 100000); // guard against absurd inputs
}

/**
 * Compute the recommended retail price (USD) from a purchase cost.
 * Missing params fall back to PRICING_DEFAULTS. Negative/NaN cost → 0.
 */
export function computeLandedPrice(
  purchaseCostUsd: number,
  params: Partial<PricingParams> = {},
): PricingResult {
  const p: PricingParams = { ...PRICING_DEFAULTS, ...params };
  const cost = Number.isFinite(purchaseCostUsd) && purchaseCostUsd > 0 ? purchaseCostUsd : 0;

  const freight = Math.max(0, p.freightUsd || 0);
  const clearance = Math.max(0, p.clearanceUsd || 0);
  const excise = Math.max(0, p.exciseUsd || 0);
  const recycling = Math.max(0, p.recyclingUsd || 0);

  const dutyBase = cost + freight + clearance;
  const duty = round2(dutyBase * (clampPct(p.dutyPct) / 100));

  const dutiableBase = round2(dutyBase + duty + excise + recycling);
  const vat = round2(dutiableBase * (clampPct(p.vatPct) / 100));

  const landed = round2(dutiableBase + vat);
  const margin = round2(landed * (clampPct(p.marginPct) / 100));

  let price = landed + margin;
  if (p.roundUsdTo && p.roundUsdTo > 0) {
    price = Math.ceil(price / p.roundUsdTo) * p.roundUsdTo;
  } else {
    price = Math.round(price);
  }

  return {
    costUsd: cost,
    freightUsd: freight,
    clearanceUsd: clearance,
    dutyUsd: duty,
    exciseUsd: excise,
    recyclingUsd: recycling,
    dutiableBaseUsd: dutiableBase,
    vatUsd: vat,
    landedUsd: landed,
    marginUsd: margin,
    priceUsd: price,
    lines: [
      { key: "cost", label: "Purchase cost", amountUsd: cost },
      { key: "freight", label: "Freight", amountUsd: freight },
      { key: "clearance", label: "Clearance", amountUsd: clearance },
      { key: "duty", label: `Customs duty (${p.dutyPct}%)`, amountUsd: duty },
      { key: "excise", label: "Excise", amountUsd: excise },
      { key: "recycling", label: "Recycling fee", amountUsd: recycling },
      { key: "vat", label: `VAT (${p.vatPct}%)`, amountUsd: vat },
      { key: "margin", label: `Margin (${p.marginPct}%)`, amountUsd: margin },
    ],
  };
}

/**
 * Localized labels for the breakdown rows, keyed by the stable PricingLine.key.
 * Display-only — the English `label` returned by computeLandedPrice() stays the
 * canonical value for server-side callers. `duty`/`vat`/`margin` carry a `%`
 * placeholder that landedLabel() fills in, mirroring the English labels.
 * Also covers the final `landed`/`price` keys in case those rows surface.
 */
export const LANDED_LABELS: Record<Locale, Record<string, string>> = {
  ru: {
    cost: "Закупочная стоимость",
    freight: "Фрахт",
    clearance: "Растаможка",
    duty: "Таможенная пошлина",
    excise: "Акциз",
    recycling: "Утилизационный сбор",
    vat: "НДС",
    margin: "Маржа",
    landed: "Полная себестоимость",
    price: "Рекомендованная розничная цена",
  },
  uz: {
    cost: "Xarid qiymati",
    freight: "Fraxt",
    clearance: "Bojxona rasmiylashtiruvi",
    duty: "Bojxona boji",
    excise: "Aksiz",
    recycling: "Utilizatsiya yig'imi",
    vat: "QQS",
    margin: "Marja",
    landed: "To'liq tannarx",
    price: "Tavsiya etilgan chakana narx",
  },
  en: {
    cost: "Purchase cost",
    freight: "Freight",
    clearance: "Clearance",
    duty: "Customs duty",
    excise: "Excise",
    recycling: "Recycling fee",
    vat: "VAT",
    margin: "Margin",
    landed: "Landed cost",
    price: "Suggested list price",
  },
};

/** Keys whose English label embeds a percentage, e.g. "Customs duty (10%)". */
const PCT_KEYS = new Set(["duty", "vat", "margin"]);

/**
 * Localized label for a breakdown row, by its stable key. For the percentage
 * rows (duty/vat/margin) the `pct` is appended as " (X%)" exactly where the
 * English label had it. Falls back to the key itself for unknown keys.
 */
export function landedLabel(key: string, locale: Locale, pct?: number): string {
  const base = LANDED_LABELS[locale]?.[key] ?? key;
  if (PCT_KEYS.has(key) && pct != null && Number.isFinite(pct)) {
    return `${base} (${pct}%)`;
  }
  return base;
}

/** Convert a USD price to UZS at the given rate, rounded to the nearest `roundTo` sum. */
export function priceUsdToUzs(priceUsd: number, usdUzsRate: number, roundTo = 100_000): number {
  if (!Number.isFinite(priceUsd) || !Number.isFinite(usdUzsRate) || priceUsd <= 0 || usdUzsRate <= 0) {
    return 0;
  }
  const raw = priceUsd * usdUzsRate;
  if (roundTo > 0) return Math.round(raw / roundTo) * roundTo;
  return Math.round(raw);
}
