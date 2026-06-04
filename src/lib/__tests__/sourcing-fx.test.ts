import { describe, it, expect } from "vitest";
import { freightPerUnit, DEFAULT_FREIGHT } from "../freight";
import { computeFxExposure, hedgeSignal } from "../fx-exposure";

describe("freightPerUnit", () => {
  it("falls back to the flat rate for non-positive qty", () => {
    expect(freightPerUnit(0).perUnitUsd).toBe(DEFAULT_FREIGHT.flatPerUnitUsd);
    expect(freightPerUnit(-3).perUnitUsd).toBe(DEFAULT_FREIGHT.flatPerUnitUsd);
  });
  it("drops per-unit freight as a container fills up", () => {
    const one = freightPerUnit(1).perUnitUsd;
    const four = freightPerUnit(4).perUnitUsd;
    expect(four).toBeLessThan(one);
    // 1 car: 6000 + 300 = 6300; 4 cars: (6000 + 4*300)/4 = 1800
    expect(one).toBe(6300);
    expect(four).toBe(1800);
  });
  it("counts containers correctly across the boundary", () => {
    expect(freightPerUnit(4).containers).toBe(1);
    expect(freightPerUnit(5).containers).toBe(2);
  });
});

describe("computeFxExposure", () => {
  it("values open CNY payable at current vs order rate", () => {
    // 72000 CNY at order rate 7.2 = $10,000; now at 7.0 = $10,285...
    const e = computeFxExposure([{ amountCny: 72000, cnyPerUsdAtOrder: 7.2 }], 7.0);
    expect(e.totalCny).toBe(72000);
    expect(e.usdAtOrder).toBe(10000);
    expect(e.usdAtCurrent).toBe(10286);
    expect(e.driftUsd).toBe(286); // CNY strengthened → costs more now
    expect(e.driftPct).toBeGreaterThan(0);
  });
  it("uses the current rate when no order snapshot", () => {
    const e = computeFxExposure([{ amountCny: 70000, cnyPerUsdAtOrder: null }], 7.0);
    expect(e.driftUsd).toBe(0);
  });
});

describe("hedgeSignal", () => {
  it("says lock when CNY strengthens (rate falls past threshold)", () => {
    expect(hedgeSignal([7.3, 7.2, 7.1])).toBe("lock");
  });
  it("says wait when CNY weakens (rate rises past threshold)", () => {
    expect(hedgeSignal([7.0, 7.1, 7.25])).toBe("wait");
  });
  it("is neutral within the noise threshold or with too little data", () => {
    expect(hedgeSignal([7.20, 7.21])).toBe("neutral");
    expect(hedgeSignal([7.2])).toBe("neutral");
  });
});
