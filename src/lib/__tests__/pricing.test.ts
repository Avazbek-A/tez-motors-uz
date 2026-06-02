import { describe, it, expect } from "vitest";
import { computeLandedPrice, priceUsdToUzs, PRICING_DEFAULTS } from "../pricing";

describe("computeLandedPrice", () => {
  it("layers freight, clearance, VAT and margin onto cost", () => {
    // cost 20000, default freight 2000 + clearance 500, duty 0, excise 0, recycling 0
    // dutiableBase = 22500; VAT 12% = 2700; landed = 25200; margin 12% = 3024
    // price = 28224 → ceil to nearest 100 = 28300
    const r = computeLandedPrice(20000);
    expect(r.dutiableBaseUsd).toBe(22500);
    expect(r.vatUsd).toBe(2700);
    expect(r.landedUsd).toBe(25200);
    expect(r.marginUsd).toBe(3024);
    expect(r.priceUsd).toBe(28300);
  });

  it("applies customs duty on the cost+freight+clearance base", () => {
    const r = computeLandedPrice(10000, { dutyPct: 10, vatPct: 0, marginPct: 0, roundUsdTo: 0 });
    // base = 10000+2000+500 = 12500; duty = 1250; dutiable = 13750; vat 0; landed 13750
    expect(r.dutyUsd).toBe(1250);
    expect(r.landedUsd).toBe(13750);
    expect(r.priceUsd).toBe(13750);
  });

  it("includes excise and recycling in the dutiable base before VAT", () => {
    const r = computeLandedPrice(10000, {
      freightUsd: 0,
      clearanceUsd: 0,
      dutyPct: 0,
      exciseUsd: 1000,
      recyclingUsd: 500,
      vatPct: 10,
      marginPct: 0,
      roundUsdTo: 0,
    });
    // dutiable = 10000 + 1000 + 500 = 11500; vat 10% = 1150; landed 12650
    expect(r.dutiableBaseUsd).toBe(11500);
    expect(r.vatUsd).toBe(1150);
    expect(r.priceUsd).toBe(12650);
  });

  it("rounds the final price up to roundUsdTo", () => {
    const r = computeLandedPrice(12345, { roundUsdTo: 500 });
    expect(r.priceUsd % 500).toBe(0);
    expect(r.priceUsd).toBeGreaterThanOrEqual(r.landedUsd + r.marginUsd);
  });

  it("handles zero / invalid cost without NaN", () => {
    expect(computeLandedPrice(0).priceUsd).toBeGreaterThanOrEqual(0);
    expect(computeLandedPrice(-5).costUsd).toBe(0);
    expect(Number.isNaN(computeLandedPrice(NaN).priceUsd)).toBe(false);
  });

  it("uses defaults for omitted params", () => {
    const r = computeLandedPrice(15000);
    expect(r.freightUsd).toBe(PRICING_DEFAULTS.freightUsd);
    expect(r.clearanceUsd).toBe(PRICING_DEFAULTS.clearanceUsd);
  });
});

describe("priceUsdToUzs", () => {
  it("converts and rounds to the nearest 100k sum", () => {
    expect(priceUsdToUzs(28300, 12600)).toBe(356_600_000);
  });
  it("returns 0 on invalid inputs", () => {
    expect(priceUsdToUzs(0, 12600)).toBe(0);
    expect(priceUsdToUzs(28300, 0)).toBe(0);
  });
});
