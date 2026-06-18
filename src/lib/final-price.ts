/**
 * Final landed-price engine (Leap 3) — the one number a customer asks for and the
 * one the dealer prices against, from a SINGLE source of truth.
 *
 *   landed cost = car cost (what you pay) + freight + customs + certification + inland
 *   final price = landed cost × (1 + target margin)        ← the customer sticker
 *
 * Customs comes from the AUTHORITATIVE, law-cited engine (customs-uz.ts) — the same
 * matrix the public calculator and the bot use — NOT import-cost.ts's older flat
 * rates. So the dealer's pricing and the customer's quote can never disagree.
 *
 * Pure + deterministic. Freight/cert/margin default to the dealer's import config
 * (override per-quote). FX flows through for the so'm-denominated customs fees.
 */
import {
  computeCustomsUz, resolveVehicleKind, resolveVehicleAge,
  type OriginClass, type VehicleCategory, type CustomsResult,
} from "./customs-uz";
import { DEFAULT_TARGET_MARGIN_PCT, DEFAULT_FEES } from "./import-cost";

export interface FinalPriceInput {
  carUsd: number; // purchase/supplier cost — what YOU pay for the car
  fuelType?: string | null;
  year?: number | null;
  engineCc?: number;
  category?: VehicleCategory;
  origin?: OriginClass; // default "certified"
  freightUsd?: number; // China→Tashkent; default from import config
  certUsd?: number; // certification / conformity, USD
  inlandUsd?: number; // local delivery + clearance, USD
  marginPct?: number; // dealer target margin → final sale price
  usdUzs?: number;
}

export interface FinalPriceResult {
  carUsd: number;
  freightUsd: number;
  customsUsd: number;
  certUsd: number;
  inlandUsd: number;
  landedUsd: number; // all-in cost on the lot (no margin)
  marginPct: number;
  marginUsd: number;
  finalUsd: number; // customer sale price = landed × (1 + margin)
  customs: CustomsResult; // the full customs breakdown (authoritative)
}

const r0 = (n: number) => Math.round(n);

/** Compute landed cost + final customer price for one car. */
export function finalCarPrice(input: FinalPriceInput): FinalPriceResult {
  const carUsd = Math.max(0, input.carUsd || 0);
  const freightUsd = input.freightUsd ?? DEFAULT_FEES.freightUsd;
  const certUsd = input.certUsd ?? 300; // typical conformity + declaration
  const inlandUsd = input.inlandUsd ?? 0;
  const marginPct = input.marginPct ?? DEFAULT_TARGET_MARGIN_PCT;

  // Customs on (car + freight) via the authoritative law-cited engine. Freight is
  // folded into the customs value (matches the statute: "цена + доставка").
  const customs = computeCustomsUz({
    priceUsd: carUsd,
    category: input.category || "car",
    kind: resolveVehicleKind(input.fuelType),
    age: resolveVehicleAge(input.year ?? undefined),
    origin: input.origin || "certified",
    engineCc: input.engineCc || 0,
    deliveryUsd: freightUsd,
    usdUzs: input.usdUzs,
  });
  const customsUsd = customs.customsCostUsd;

  const landedUsd = r0(carUsd + freightUsd + customsUsd + certUsd + inlandUsd);
  const finalUsd = r0(landedUsd * (1 + marginPct / 100));
  return {
    carUsd: r0(carUsd), freightUsd: r0(freightUsd), customsUsd, certUsd: r0(certUsd), inlandUsd: r0(inlandUsd),
    landedUsd, marginPct, marginUsd: finalUsd - landedUsd, finalUsd, customs,
  };
}
