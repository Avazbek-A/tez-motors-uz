import { describe, it, expect } from "vitest";
import {
  DEFAULT_RATES,
  DEFAULT_FEES,
  DEFAULT_IMPORT_CONFIG,
  computeLandedCost,
  suggestedListPrice,
  marginPctFromPrice,
  resolveFuelKind,
  type ImportCostInput,
} from "../import-cost";

const baseInput = (over: Partial<ImportCostInput> = {}): ImportCostInput => ({
  vehiclePriceUsd: 20000,
  freightUsd: 2500,
  clearanceUsd: 400,
  inlandLogisticsUsd: 300,
  otherUsd: 0,
  rates: DEFAULT_RATES.petrol,
  ...over,
});

describe("computeLandedCost", () => {
  it("builds CIF, duty, excise, VAT and sums to landed cost (petrol)", () => {
    const b = computeLandedCost(baseInput());
    // CIF = 20000 + 2500 = 22500
    expect(b.cifUsd).toBe(22500);
    // duty 30% of CIF = 6750
    expect(b.customsDutyUsd).toBe(6750);
    // excise 10% of CIF = 2250
    expect(b.exciseUsd).toBe(2250);
    // VAT 12% of (22500 + 6750 + 2250) = 12% of 31500 = 3780
    expect(b.vatUsd).toBe(3780);
    // landed = vehicle + freight + duty + excise + vat + recycling(600) + cert(150) + clearance(400) + inland(300)
    // = 20000 + 2500 + 6750 + 2250 + 3780 + 600 + 150 + 400 + 300 = 36730
    expect(b.landedCostUsd).toBe(36730);
    // duties+fees = landed - vehicle
    expect(b.dutiesAndFeesUsd).toBe(16730);
  });

  it("EVs skip duty and excise (only VAT + fees on top)", () => {
    const b = computeLandedCost(baseInput({ rates: DEFAULT_RATES.electric }));
    expect(b.customsDutyUsd).toBe(0);
    expect(b.exciseUsd).toBe(0);
    // VAT 12% of CIF (22500) = 2700
    expect(b.vatUsd).toBe(2700);
    // landed = 20000 + 2500 + 0 + 0 + 2700 + 200(recycling) + 150 + 400 + 300 = 26250
    expect(b.landedCostUsd).toBe(26250);
  });

  it("clamps negative inputs to zero", () => {
    const b = computeLandedCost(baseInput({ vehiclePriceUsd: -5, freightUsd: -100 }));
    expect(b.vehiclePriceUsd).toBe(0);
    expect(b.freightUsd).toBe(0);
    expect(b.cifUsd).toBe(0);
  });
});

describe("suggestedListPrice", () => {
  it("marks up landed cost by the target margin, rounded to $100", () => {
    // 36730 * 1.18 = 43341.4 → round to nearest 100 = 43300
    expect(suggestedListPrice(36730, 18)).toBe(43300);
  });
  it("returns 0 for non-positive landed cost", () => {
    expect(suggestedListPrice(0, 18)).toBe(0);
  });
});

describe("marginPctFromPrice", () => {
  it("computes margin as a percent of landed cost", () => {
    // (43300 - 36730) / 36730 = 0.1789 → 17.9%
    expect(marginPctFromPrice(36730, 43300)).toBe(17.9);
  });
  it("returns null when landed cost is unknown/zero", () => {
    expect(marginPctFromPrice(0, 40000)).toBeNull();
  });
  it("can be negative when selling below cost", () => {
    expect(marginPctFromPrice(40000, 36000)).toBe(-10);
  });
});

describe("resolveFuelKind", () => {
  it("maps free-form and Chinese labels to known kinds", () => {
    expect(resolveFuelKind("Electric")).toBe("electric");
    expect(resolveFuelKind("电动")).toBe("electric");
    expect(resolveFuelKind("plug-in hybrid")).toBe("phev");
    expect(resolveFuelKind("插电混动")).toBe("phev");
    expect(resolveFuelKind("Hybrid")).toBe("hybrid");
    expect(resolveFuelKind("diesel")).toBe("diesel");
    expect(resolveFuelKind("gasoline")).toBe("petrol");
    expect(resolveFuelKind(null)).toBe("petrol");
  });
  it("only treats EV/BEV as electric when standalone, not as a substring", () => {
    // Regression: a bare "ev" substring used to misclassify these as electric,
    // zeroing customs duty and quoting a below-cost price.
    expect(resolveFuelKind("revised")).toBe("petrol");
    expect(resolveFuelKind("level")).toBe("petrol");
    expect(resolveFuelKind("seven-seat petrol")).toBe("petrol");
    // …but genuine standalone EV/BEV still classify electric.
    expect(resolveFuelKind("EV")).toBe("electric");
    expect(resolveFuelKind("BEV")).toBe("electric");
    expect(resolveFuelKind("battery ev")).toBe("electric");
  });
});

describe("DEFAULT_IMPORT_CONFIG", () => {
  it("has rates for every fuel kind plus fees and a margin", () => {
    expect(DEFAULT_IMPORT_CONFIG.fees).toEqual(DEFAULT_FEES);
    expect(DEFAULT_IMPORT_CONFIG.targetMarginPct).toBeGreaterThan(0);
    expect(Object.keys(DEFAULT_IMPORT_CONFIG.rates).sort()).toEqual(
      ["diesel", "electric", "hybrid", "petrol", "phev"],
    );
  });
});
