import { describe, it, expect } from "vitest";
import { assessPrice, MIN_SAMPLE } from "../fair-price";

describe("assessPrice", () => {
  it("shows nothing without enough market data", () => {
    expect(assessPrice(20000, 22000, MIN_SAMPLE - 1).label).toBeNull();
    expect(assessPrice(20000, null, 10).label).toBeNull();
    expect(assessPrice(null, 22000, 10).label).toBeNull();
  });

  it("flags below-market with savings + percent", () => {
    const a = assessPrice(20000, 23000, 8); // ~13% below
    expect(a.label).toBe("below_market");
    expect(a.belowPct).toBe(13);
    expect(a.savingsUsd).toBe(3000);
  });

  it("calls a near-median price fair (no savings claim)", () => {
    const a = assessPrice(20000, 20200, 8); // ~1% below → within fair band
    expect(a.label).toBe("fair");
    expect(a.savingsUsd).toBe(0);
    const b = assessPrice(20400, 20000, 8); // 2% above → still fair
    expect(b.label).toBe("fair");
  });

  it("NEVER labels a clearly above-market car (shows nothing)", () => {
    const a = assessPrice(25000, 20000, 8); // 25% above
    expect(a.label).toBeNull();
    expect(a.savingsUsd).toBe(0);
  });

  it("carries the sample size through", () => {
    expect(assessPrice(20000, 23000, 8).sample).toBe(8);
  });
});
