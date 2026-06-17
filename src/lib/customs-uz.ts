/**
 * Uzbekistan car-import customs ("растаможка") estimator — CUSTOMER-FACING.
 *
 * Mirrors the real UZ customs fee structure (and Gonzo Motors' published
 * numbers, 2025–26) so the public calculator lands at essentially the same
 * totals. This is DELIBERATELY separate from src/lib/import-cost.ts — that one
 * is the dealer's buy-side procurement economics (different, broker-tuned
 * rates); this one is the customer's "what will clearance cost me" estimate.
 *
 * Every rate is an exported constant so the dealer (or their broker) can update
 * it when the law changes — UZ customs rates move (BRV, EV utilization fee, …).
 * The figures below are the current published values; confirm against live law.
 *
 * Structure (per Gonzo's published calculator + UZ law):
 *   - Electric / series-hybrid (PHEV/REEV): customs-duty EXEMPT. 12% VAT,
 *     utilization 120 BRV, clearance 2.5 BRV, certificate.
 *   - ICE (petrol/diesel) / parallel hybrid: 15% duty + $1/cm³, 12% VAT,
 *     utilization by engine size (120/180/300 BRV), clearance 2.5 BRV, certs.
 */
export type VehicleKind = "electric" | "petrol" | "diesel" | "hybrid" | "phev";

export const VEHICLE_KINDS: VehicleKind[] = ["electric", "petrol", "diesel", "hybrid", "phev"];

// ── Editable rate constants (confirm against live UZ law) ───────────────────
/** БРВ — базовая расчётная величина (base calculation value), in so'm. */
export const BRV_SUM = 412_000;
/** sum→USD display rate; the page overrides this with the live FX rate. */
export const DEFAULT_USD_UZS = 12_600;

/** Customs duty on ICE/hybrid: % of customs value, plus a per-cm³ component. */
export const DUTY_PCT_ICE = 0.15;
export const DUTY_USD_PER_CC = 1;
/** VAT (НДС/QQS) on the customs value. */
export const VAT_PCT = 0.12;
/** Utilization fee (утилизационный сбор), in BRV. */
export const UTIL_BRV_EV = 120; // electric / PHEV, new (<3y), post-May-2025
const UTIL_BRV_ICE = (cc: number): number => (cc < 2000 ? 120 : cc < 3000 ? 180 : 300);
/** Customs clearance fee (таможенный сбор за оформление), in BRV. */
export const CLEARANCE_BRV = 2.5;
/** Certificates + declaration bundle, flat USD. */
export const CERT_USD_EV = 300;
export const CERT_USD_ICE = 690;

const isDutyExempt = (k: VehicleKind) => k === "electric" || k === "phev";
const round0 = (n: number) => Math.round(n);

export interface CustomsInput {
  priceUsd: number;
  kind: VehicleKind;
  engineCc?: number; // required for ICE/hybrid duty + utilization
  deliveryUsd?: number; // optional freight folded into the customs value
  usdUzs?: number; // FX for sum→USD (default DEFAULT_USD_UZS)
  brvSum?: number; // BRV override
}

/** One labeled line of the breakdown. `sumValue` set for so'm-denominated fees. */
export interface CustomsLine {
  key: "duty" | "vat" | "util" | "clearance" | "certificate";
  detail?: string; // e.g. "120 БРВ" or "15% + $1/см³"
  sumValue?: number;
  usdValue: number;
}

export interface CustomsResult {
  kind: VehicleKind;
  customsValueUsd: number; // car price + delivery (VAT/duty base)
  lines: CustomsLine[];
  customsCostUsd: number; // sum of all clearance fees (the "растаможка" cost)
  totalUsd: number; // customs value + customs cost (landed)
  usdUzs: number;
  brvSum: number;
}

/**
 * Compute the customs ("растаможка") breakdown for one car. Pure + deterministic.
 * USD-denominated total; so'm fees (utilization, clearance) are converted at the
 * given FX rate and also surfaced in so'm on their lines.
 */
export function computeCustomsUz(input: CustomsInput): CustomsResult {
  const usdUzs = input.usdUzs && input.usdUzs > 0 ? input.usdUzs : DEFAULT_USD_UZS;
  const brv = input.brvSum && input.brvSum > 0 ? input.brvSum : BRV_SUM;
  const price = Math.max(0, input.priceUsd || 0);
  const delivery = Math.max(0, input.deliveryUsd || 0);
  const cc = Math.max(0, input.engineCc || 0);
  const exempt = isDutyExempt(input.kind);

  const customsValue = price + delivery;
  const sumToUsd = (sum: number) => sum / usdUzs;

  const lines: CustomsLine[] = [];

  // Customs duty (Таможенная пошлина) — ICE/hybrid only.
  const duty = exempt ? 0 : customsValue * DUTY_PCT_ICE + cc * DUTY_USD_PER_CC;
  if (!exempt) lines.push({ key: "duty", detail: `15% + $${DUTY_USD_PER_CC}/см³`, usdValue: round0(duty) });

  // VAT (НДС) — 12% of the customs value.
  const vat = customsValue * VAT_PCT;
  lines.push({ key: "vat", detail: "12%", usdValue: round0(vat) });

  // Utilization fee (Утилизационный сбор) — BRV-denominated.
  const utilBrv = exempt ? UTIL_BRV_EV : UTIL_BRV_ICE(cc);
  const utilSum = utilBrv * brv;
  lines.push({ key: "util", detail: `${utilBrv} БРВ`, sumValue: utilSum, usdValue: round0(sumToUsd(utilSum)) });

  // Customs clearance fee (Таможенный сбор) — 2.5 BRV.
  const clearanceSum = CLEARANCE_BRV * brv;
  lines.push({ key: "clearance", detail: `${CLEARANCE_BRV} БРВ`, sumValue: clearanceSum, usdValue: round0(sumToUsd(clearanceSum)) });

  // Certificates + declaration (flat USD).
  const cert = exempt ? CERT_USD_EV : CERT_USD_ICE;
  lines.push({ key: "certificate", usdValue: cert });

  const customsCostUsd = lines.reduce((s, l) => s + l.usdValue, 0);
  return {
    kind: input.kind,
    customsValueUsd: round0(customsValue),
    lines,
    customsCostUsd: round0(customsCostUsd),
    totalUsd: round0(customsValue + customsCostUsd),
    usdUzs,
    brvSum: brv,
  };
}

/** Map a free-form fuel string (e.g. car.fuel_type) to a VehicleKind. */
export function resolveVehicleKind(raw: string | null | undefined): VehicleKind {
  const v = (raw || "").toLowerCase();
  if (/(phev|plug|послед|series|reev)/.test(v)) return "phev";
  if (/(electr|ev\b|bev|электр|电|電)/.test(v)) return "electric";
  if (/(hybrid|гибрид|混)/.test(v)) return "hybrid";
  if (/(diesel|дизель|дизел)/.test(v)) return "diesel";
  return "petrol";
}
