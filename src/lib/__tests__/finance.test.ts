import { describe, it, expect } from "vitest";
import {
  FINANCE_DEFAULTS,
  monthlyPayment,
  estimatedMonthlyFrom,
  priceFromMonthly,
} from "../finance";

describe("finance", () => {
  it("returns 0 for non-positive prices", () => {
    expect(monthlyPayment(0)).toBe(0);
    expect(monthlyPayment(-5000)).toBe(0);
    expect(estimatedMonthlyFrom(0)).toBe(0);
  });

  it("uses sane defaults (30% down / 18% APR / 24 mo)", () => {
    expect(FINANCE_DEFAULTS.downPaymentPct).toBe(30);
    expect(FINANCE_DEFAULTS.annualRatePct).toBe(18);
    expect(FINANCE_DEFAULTS.termMonths).toBe(24);
  });

  it("computes a positive, rounded monthly for a real price", () => {
    const m = estimatedMonthlyFrom(30000);
    expect(m).toBeGreaterThan(0);
    expect(Number.isInteger(m)).toBe(true);
  });

  it("handles the zero-interest edge as straight division", () => {
    // principal = 12000 * 0.7 = 8400; 8400 / 24 = 350
    const m = monthlyPayment(12000, { annualRatePct: 0, termMonths: 24 });
    expect(m).toBeCloseTo(350, 5);
  });

  it("priceFromMonthly inverts monthlyPayment (round-trip)", () => {
    for (const price of [8000, 19999, 30000, 55000]) {
      const m = monthlyPayment(price);
      const back = priceFromMonthly(m);
      expect(back).toBeCloseTo(price, 2);
    }
  });

  it("priceFromMonthly returns 0 for non-positive monthly", () => {
    expect(priceFromMonthly(0)).toBe(0);
    expect(priceFromMonthly(-100)).toBe(0);
  });
});
