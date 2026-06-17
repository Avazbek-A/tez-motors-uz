/**
 * Uzbekistan car-import customs ("растаможка") estimator — CUSTOMER-FACING.
 *
 * This model is REVERSE-ENGINEERED from @autodeklarantbot (the customs-declarant
 * bot) and validated to reproduce its results to the dollar. The duty is a matrix
 * of (age × origin × fuel); VAT is on (value + duty); utilization is engine/age
 * tiered. It supersedes the old flat "15% + $1/cc" model, which was only the
 * new-car (<1yr, certified) cell and under-quoted everything else.
 *
 * Separate from src/lib/import-cost.ts (the admin buy-side procurement economics).
 *
 * Every rate is an exported constant — UZ customs rates shift; confirm vs live law.
 * CONFIRMED cells (probed from the bot): duty for new/1-3/>3 × {FTA, certified,
 * uncertified}; EV/hybrid; util 120/180 (≤3y) & 330 (>3y, 2.0L). ESTIMATED
 * (interpolated, flagged): util for >3000cc and the >3y bump on other cc tiers.
 */
export type VehicleKind = "electric" | "petrol" | "diesel" | "hybrid" | "phev";
export type VehicleAge = "new" | "used1to3" | "used3plus"; // ≤1yr · 1–3yr · >3yr
export type OriginClass = "fta" | "certified" | "uncertified"; // CIS/EAEU 0% · non-FTA w/ cert · no cert

export const VEHICLE_KINDS: VehicleKind[] = ["electric", "petrol", "diesel", "hybrid", "phev"];
export const VEHICLE_AGES: VehicleAge[] = ["new", "used1to3", "used3plus"];
export const ORIGIN_CLASSES: OriginClass[] = ["fta", "certified", "uncertified"];

// ── Editable rate constants (confirm against live UZ law) ───────────────────
export const BRV_SUM = 412_000; // БРВ — base calculation value, so'm
export const DEFAULT_USD_UZS = 12_600; // sum→USD; the page overrides with the live rate
export const VAT_PCT = 0.12; // НДС, applied to (customs value + duty)
export const CLEARANCE_BRV = 2.5; // таможенный сбор за оформление (cars)

// Motorcycle (HS 8711) — simpler: no age, no per-cc, no utilization fee, and a
// 1-BRV clearance. Duty is flat by origin/fuel. (Probed + validated from the bot.)
export type VehicleCategory = "car" | "moto" | "engine" | "truck";
export const MOTO_DUTY_PCT = 20; // petrol, certified non-FTA (×2 if no certificate; FTA/electric → 0)
export const MOTO_CLEARANCE_BRV = 1;
// Engine/motor (HS 8407): new = duty-free, used = 30%; no utilization. (Probed.)
export const ENGINE_USED_DUTY_PCT = 30;
// Mini-truck ≤5t (HS 8704): 30% certified (×2 no-cert; 0 electric/FTA); utilization
// by age (≤3y 210 / >3y 300 BRV; EV 120); gross mass doesn't change the ≤5t band. (Probed.)
export const TRUCK_DUTY_PCT = 30;

/** Duty base for a PETROL/DIESEL car, non-FTA origin WITH certificate, by age:
 *  [percent of customs value, USD per cm³]. No-cert doubles it; FTA → 0; EV → 0;
 *  hybrid keeps the percent but drops the per-cm³ term. */
export const DUTY_BASE: Record<VehicleAge, { pct: number; perCc: number }> = {
  new:       { pct: 15, perCc: 1 },
  used1to3:  { pct: 30, perCc: 2.5 },
  used3plus: { pct: 40, perCc: 3 },
};

const isExempt = (k: VehicleKind) => k === "electric" || k === "phev";

/** Duty rate for a given car. Returns { pct, perCc }. */
export function dutyRate(kind: VehicleKind, age: VehicleAge, origin: OriginClass): { pct: number; perCc: number } {
  if (isExempt(kind) || origin === "fta") return { pct: 0, perCc: 0 };
  const base = DUTY_BASE[age];
  const mult = origin === "uncertified" ? 2 : 1; // no certificate → ×2 (confirmed)
  return { pct: base.pct * mult, perCc: (kind === "hybrid" ? 0 : base.perCc) * mult };
}

/** Utilization fee in BRV. EV is flat; ICE/hybrid is engine-cc tiered with an
 *  older-car (>3yr) surcharge. */
export function utilizationBrv(kind: VehicleKind, age: VehicleAge, cc: number): number {
  if (isExempt(kind)) return age === "used3plus" ? 210 : 120; // EV/PHEV (post-May-2025)
  const base = cc < 2000 ? 120 : cc < 3000 ? 180 : 300;
  return age === "used3plus" ? base + 150 : base; // >3yr surcharge (180→330 confirmed)
}

const round0 = (n: number) => Math.round(n);

export interface CustomsInput {
  priceUsd: number;
  kind: VehicleKind;
  category?: VehicleCategory; // "car" (default) | "moto"
  age?: VehicleAge; // default "new"
  origin?: OriginClass; // default "certified"
  engineCc?: number; // ICE/hybrid duty + utilization
  deliveryUsd?: number; // folded into the customs value
  usdUzs?: number; // FX for sum→USD (default DEFAULT_USD_UZS)
  brvSum?: number;
}

export interface CustomsLine {
  key: "duty" | "vat" | "util" | "clearance";
  detail?: string; // "30% + $2.5/см³", "180 БРВ", "12%", "2.5 БРВ"
  sumValue?: number; // so'm, for BRV-denominated lines
  usdValue: number;
}

export interface CustomsResult {
  kind: VehicleKind;
  age: VehicleAge;
  origin: OriginClass;
  customsValueUsd: number;
  lines: CustomsLine[];
  customsCostUsd: number; // sum of clearance costs (the "растаможка")
  totalUsd: number; // value + customs cost
  usdUzs: number;
  brvSum: number;
}

/** Compute the растаможка breakdown. Pure; matches @autodeklarantbot to the $. */
export function computeCustomsUz(input: CustomsInput): CustomsResult {
  const usdUzs = input.usdUzs && input.usdUzs > 0 ? input.usdUzs : DEFAULT_USD_UZS;
  const brv = input.brvSum && input.brvSum > 0 ? input.brvSum : BRV_SUM;
  const kind = input.kind;
  const age = input.age || "new";
  const origin = input.origin || "certified";
  const price = Math.max(0, input.priceUsd || 0);
  const delivery = Math.max(0, input.deliveryUsd || 0);
  const cc = Math.max(0, input.engineCc || 0);

  const customsValue = price + delivery;
  const toUsd = (sum: number) => sum / usdUzs;
  const lines: CustomsLine[] = [];

  // ── Motorcycle path (HS 8711): flat duty, no per-cc, no utilization, 1-BRV fee.
  if ((input.category || "car") === "moto") {
    const exemptM = kind === "electric" || kind === "phev" || origin === "fta";
    const dutyPctM = exemptM ? 0 : origin === "uncertified" ? MOTO_DUTY_PCT * 2 : MOTO_DUTY_PCT;
    const dutyM = customsValue * (dutyPctM / 100);
    if (dutyPctM > 0) lines.push({ key: "duty", detail: `${dutyPctM}%`, usdValue: round0(dutyM) });
    lines.push({ key: "vat", detail: "12%", usdValue: round0((customsValue + dutyM) * VAT_PCT) });
    const feeSumM = MOTO_CLEARANCE_BRV * brv;
    lines.push({ key: "clearance", detail: `${MOTO_CLEARANCE_BRV} БРВ`, sumValue: feeSumM, usdValue: round0(toUsd(feeSumM)) });
    const costM = lines.reduce((s, l) => s + l.usdValue, 0);
    return { kind, age, origin, customsValueUsd: round0(customsValue), lines, customsCostUsd: round0(costM), totalUsd: round0(customsValue + costM), usdUzs, brvSum: brv };
  }

  // ── Engine/motor path (HS 8407): new = 0%, used = 30%; no utilization. ──
  if (input.category === "engine") {
    const duty = age === "new" ? 0 : customsValue * (ENGINE_USED_DUTY_PCT / 100);
    if (duty > 0) lines.push({ key: "duty", detail: `${ENGINE_USED_DUTY_PCT}%`, usdValue: round0(duty) });
    lines.push({ key: "vat", detail: "12%", usdValue: round0((customsValue + duty) * VAT_PCT) });
    const feeSum = CLEARANCE_BRV * brv;
    lines.push({ key: "clearance", detail: `${CLEARANCE_BRV} БРВ`, sumValue: feeSum, usdValue: round0(toUsd(feeSum)) });
    const cost = lines.reduce((s, l) => s + l.usdValue, 0);
    return { kind, age, origin, customsValueUsd: round0(customsValue), lines, customsCostUsd: round0(cost), totalUsd: round0(customsValue + cost), usdUzs, brvSum: brv };
  }

  // ── Mini-truck ≤5t path (HS 8704): 30%/60%/0 duty + age-tiered utilization. ──
  if (input.category === "truck") {
    const ev = kind === "electric" || kind === "phev";
    const dutyPctT = ev || origin === "fta" ? 0 : origin === "uncertified" ? TRUCK_DUTY_PCT * 2 : TRUCK_DUTY_PCT;
    const duty = customsValue * (dutyPctT / 100);
    if (dutyPctT > 0) lines.push({ key: "duty", detail: `${dutyPctT}%`, usdValue: round0(duty) });
    lines.push({ key: "vat", detail: "12%", usdValue: round0((customsValue + duty) * VAT_PCT) });
    const utilBrvT = ev ? 120 : age === "used3plus" ? 300 : 210;
    const utilSumT = utilBrvT * brv;
    lines.push({ key: "util", detail: `${utilBrvT} БРВ`, sumValue: utilSumT, usdValue: round0(toUsd(utilSumT)) });
    const feeSum = CLEARANCE_BRV * brv;
    lines.push({ key: "clearance", detail: `${CLEARANCE_BRV} БРВ`, sumValue: feeSum, usdValue: round0(toUsd(feeSum)) });
    const cost = lines.reduce((s, l) => s + l.usdValue, 0);
    return { kind, age, origin, customsValueUsd: round0(customsValue), lines, customsCostUsd: round0(cost), totalUsd: round0(customsValue + cost), usdUzs, brvSum: brv };
  }

  // Customs duty (Таможенная пошлина).
  const rate = dutyRate(kind, age, origin);
  const duty = customsValue * (rate.pct / 100) + cc * rate.perCc;
  if (rate.pct > 0 || rate.perCc > 0) {
    const detail = rate.perCc > 0 ? `${rate.pct}% + $${rate.perCc}/см³` : `${rate.pct}%`;
    lines.push({ key: "duty", detail, usdValue: round0(duty) });
  }

  // VAT (НДС) — 12% of (customs value + duty). [bot-confirmed base]
  const vat = (customsValue + duty) * VAT_PCT;
  lines.push({ key: "vat", detail: "12%", usdValue: round0(vat) });

  // Utilization fee (Утилизационный сбор) — BRV-denominated.
  const utilBrv = utilizationBrv(kind, age, cc);
  const utilSum = utilBrv * brv;
  lines.push({ key: "util", detail: `${utilBrv} БРВ`, sumValue: utilSum, usdValue: round0(toUsd(utilSum)) });

  // Customs clearance fee (Таможенный сбор) — 2.5 BRV.
  const clearanceSum = CLEARANCE_BRV * brv;
  lines.push({ key: "clearance", detail: `${CLEARANCE_BRV} БРВ`, sumValue: clearanceSum, usdValue: round0(toUsd(clearanceSum)) });

  const customsCostUsd = lines.reduce((s, l) => s + l.usdValue, 0);
  return {
    kind,
    age,
    origin,
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

/** Map a model year to the bot's age bucket (≤1yr new / 1–3yr / >3yr). */
export function resolveVehicleAge(year: number | null | undefined, now = 2026): VehicleAge {
  if (!year || !Number.isFinite(year)) return "new";
  const yrs = now - year;
  if (yrs <= 1) return "new";
  if (yrs <= 3) return "used1to3";
  return "used3plus";
}
