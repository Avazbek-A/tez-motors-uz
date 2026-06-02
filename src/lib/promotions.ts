/**
 * Promotions math — pure, unit-tested. A promotion lowers a car's price for a
 * window; the storefront already renders a strikethrough when
 * original_price_usd > price_usd, so activating a promo = snapshot the old
 * price into original_price_usd and set price_usd to the sale price; ending it
 * reverts. This module computes sale prices, discounts and status.
 */

export type PromoStatus = "scheduled" | "active" | "ended" | "cancelled";

export interface SaleInput {
  /** % off the current price (1–90). */
  pctOff?: number | null;
  /** An explicit sale price in USD (wins over pctOff). */
  fixedPrice?: number | null;
}

/** Compute the sale price from the current price + a discount spec. Rounds % off
 *  to the nearest $100; always returns a value in [0, price). */
export function salePrice(price: number, input: SaleInput): number {
  const p = Math.max(0, Math.round(price) || 0);
  if (p <= 0) return 0;
  let sale: number;
  if (input.fixedPrice != null && input.fixedPrice > 0) {
    sale = Math.round(input.fixedPrice);
  } else if (input.pctOff != null && input.pctOff > 0) {
    const pct = Math.min(90, input.pctOff);
    sale = Math.round((p * (1 - pct / 100)) / 100) * 100;
  } else {
    return p; // no discount
  }
  return Math.max(0, Math.min(sale, p - 1));
}

/** Discount percent of an original vs sale price (0 if not a discount). */
export function discountPct(originalUsd: number, saleUsd: number): number {
  if (!(originalUsd > 0) || !(saleUsd >= 0) || saleUsd >= originalUsd) return 0;
  return Math.round((1 - saleUsd / originalUsd) * 100);
}

/** Resolve the status a promo should be in at `nowMs`, given its window. */
export function promoStatusAt(
  starts: string | null,
  ends: string | null,
  nowMs: number,
  current: PromoStatus,
): PromoStatus {
  if (current === "cancelled" || current === "ended") return current;
  const startMs = starts ? new Date(starts).getTime() : null;
  const endMs = ends ? new Date(ends).getTime() : null;
  if (endMs != null && nowMs >= endMs) return "ended";
  if (startMs == null || nowMs >= startMs) return "active";
  return "scheduled";
}
