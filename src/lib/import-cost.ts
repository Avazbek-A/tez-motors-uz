/**
 * Import-economics engine — the importer's edge.
 *
 * Turns a supplier vehicle price into the TRUE all-in landed cost in Tashkent,
 * then a suggested list price at a target margin. Pure functions, no I/O, so the
 * admin calculator and the money cockpit share one source of truth (mirrors
 * finance.ts).
 *
 * IMPORTANT — these defaults are editable ASSUMPTIONS, not legal advice.
 * Uzbekistan's auto-import duties/excise/fees change often and depend on the
 * importer type, the car's age, engine volume and fuel. The dealer (or their
 * customs broker) must confirm the live rates; every rate here is overridable
 * per-calculation and persisted in site_settings('import_config').
 *
 * Cost stack modelled (per unit):
 *   CIF        = vehicle price + international freight & insurance
 *   customs duty = CIF × customsDutyPct
 *   excise       = CIF × excisePct           (ICE engines; EVs usually 0)
 *   VAT (QQS)    = (CIF + duty + excise) × vatPct
 *   + flat fees  = recycling/utilisation, certification, clearance/broker,
 *                  inland logistics, other
 *   landed cost  = sum of the above
 */

export type FuelKind = "petrol" | "diesel" | "hybrid" | "phev" | "electric";

export const FUEL_KINDS: FuelKind[] = ["petrol", "diesel", "hybrid", "phev", "electric"];

/** Percent-based tax rates that vary by fuel type. */
export interface ImportRates {
  /** Customs duty, % of CIF value. */
  customsDutyPct: number;
  /** Excise tax, % of CIF value (ICE; EVs typically 0). */
  excisePct: number;
  /** VAT (QQS), % of (CIF + duty + excise). */
  vatPct: number;
  /** Recycling / utilisation fee, flat USD. */
  recyclingFeeUsd: number;
  /** Certification / homologation, flat USD. */
  certificationUsd: number;
}

/** Flat, fuel-independent line items. */
export interface ImportFees {
  /** International freight + insurance (China → Tashkent), USD. */
  freightUsd: number;
  /** Customs broker / clearance, USD. */
  clearanceUsd: number;
  /** Inland delivery within Uzbekistan, USD. */
  inlandLogisticsUsd: number;
  /** Anything else (storage, plates, misc), USD. */
  otherUsd: number;
}

export interface ImportCostInput extends ImportFees {
  /** Supplier vehicle price, already converted to USD. */
  vehiclePriceUsd: number;
  rates: ImportRates;
}

export interface ImportCostBreakdown {
  vehiclePriceUsd: number;
  freightUsd: number;
  cifUsd: number;
  customsDutyUsd: number;
  exciseUsd: number;
  vatUsd: number;
  recyclingFeeUsd: number;
  certificationUsd: number;
  clearanceUsd: number;
  inlandLogisticsUsd: number;
  otherUsd: number;
  /** All taxes + flat fees (everything on top of the vehicle price). */
  dutiesAndFeesUsd: number;
  landedCostUsd: number;
}

/** Editable per-fuel default rates. STARTING POINT — confirm against live law. */
export const DEFAULT_RATES: Record<FuelKind, ImportRates> = {
  petrol: { customsDutyPct: 30, excisePct: 10, vatPct: 12, recyclingFeeUsd: 600, certificationUsd: 150 },
  diesel: { customsDutyPct: 30, excisePct: 15, vatPct: 12, recyclingFeeUsd: 600, certificationUsd: 150 },
  hybrid: { customsDutyPct: 15, excisePct: 5, vatPct: 12, recyclingFeeUsd: 400, certificationUsd: 150 },
  phev: { customsDutyPct: 10, excisePct: 3, vatPct: 12, recyclingFeeUsd: 400, certificationUsd: 150 },
  electric: { customsDutyPct: 0, excisePct: 0, vatPct: 12, recyclingFeeUsd: 200, certificationUsd: 150 },
};

/** Editable default flat fees (per unit, USD). */
export const DEFAULT_FEES: ImportFees = {
  freightUsd: 2500,
  clearanceUsd: 400,
  inlandLogisticsUsd: 300,
  otherUsd: 0,
};

/** Default markup on landed cost, %. */
export const DEFAULT_TARGET_MARGIN_PCT = 18;

/** The full editable config persisted in site_settings('import_config'). */
export interface ImportConfig {
  rates: Record<FuelKind, ImportRates>;
  fees: ImportFees;
  targetMarginPct: number;
}

export const DEFAULT_IMPORT_CONFIG: ImportConfig = {
  rates: DEFAULT_RATES,
  fees: DEFAULT_FEES,
  targetMarginPct: DEFAULT_TARGET_MARGIN_PCT,
};

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const nn = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0); // clamp to non-negative

/** Compute the full landed-cost breakdown for one unit. */
export function computeLandedCost(input: ImportCostInput): ImportCostBreakdown {
  const vehicle = nn(input.vehiclePriceUsd);
  const freight = nn(input.freightUsd);
  const cif = round2(vehicle + freight);

  const dutyPct = nn(input.rates.customsDutyPct) / 100;
  const excisePct = nn(input.rates.excisePct) / 100;
  const vatPct = nn(input.rates.vatPct) / 100;

  const duty = round2(cif * dutyPct);
  const excise = round2(cif * excisePct);
  const vat = round2((cif + duty + excise) * vatPct);

  const recycling = nn(input.rates.recyclingFeeUsd);
  const certification = nn(input.rates.certificationUsd);
  const clearance = nn(input.clearanceUsd);
  const inland = nn(input.inlandLogisticsUsd);
  const other = nn(input.otherUsd);

  const dutiesAndFees = round2(
    freight + duty + excise + vat + recycling + certification + clearance + inland + other,
  );
  const landed = round2(vehicle + dutiesAndFees);

  return {
    vehiclePriceUsd: round2(vehicle),
    freightUsd: round2(freight),
    cifUsd: cif,
    customsDutyUsd: duty,
    exciseUsd: excise,
    vatUsd: vat,
    recyclingFeeUsd: round2(recycling),
    certificationUsd: round2(certification),
    clearanceUsd: round2(clearance),
    inlandLogisticsUsd: round2(inland),
    otherUsd: round2(other),
    dutiesAndFeesUsd: dutiesAndFees,
    landedCostUsd: landed,
  };
}

/** Suggested list price = landed cost marked up by targetMarginPct, rounded to $100. */
export function suggestedListPrice(landedCostUsd: number, targetMarginPct: number): number {
  const landed = nn(landedCostUsd);
  const markup = 1 + nn(targetMarginPct) / 100;
  return Math.round((landed * markup) / 100) * 100;
}

/** Gross margin (price − cost) as a % of landed cost, given an actual list price. */
export function marginPctFromPrice(landedCostUsd: number, listPriceUsd: number): number | null {
  const landed = nn(landedCostUsd);
  if (landed <= 0) return null;
  return Math.round(((nn(listPriceUsd) - landed) / landed) * 1000) / 10;
}

/** Resolve a fuel string (free-form, e.g. car.fuel_type) to a known FuelKind. */
export function resolveFuelKind(raw: string | null | undefined): FuelKind {
  const v = (raw || "").toLowerCase();
  // PHEV first: "插电混动" contains "电", which the electric test would catch.
  if (/(plug|phev|插)/.test(v)) return "phev";
  if (/(electr|ev|bev|電|电)/.test(v)) return "electric";
  if (/(hybrid|混)/.test(v)) return "hybrid";
  if (/(diesel|柴)/.test(v)) return "diesel";
  return "petrol";
}
