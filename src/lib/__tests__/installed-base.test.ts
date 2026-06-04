import { describe, it, expect } from "vitest";
import { estimateTradeIn } from "../tradein-estimate";
import { partFitsCar, type PartLite } from "../parts-for-car";

describe("estimateTradeIn", () => {
  it("returns null without a market anchor", () => {
    expect(estimateTradeIn({ marketMedianUsd: null, year: 2022, mileageKm: 30000, nowYear: 2026 })).toBeNull();
    expect(estimateTradeIn({ marketMedianUsd: 0, year: 2022, mileageKm: 30000, nowYear: 2026 })).toBeNull();
  });

  it("offers below market (dealer buffer) and within a low/high range", () => {
    const e = estimateTradeIn({ marketMedianUsd: 20000, year: 2026, mileageKm: 0, condition: "excellent", nowYear: 2026 })!;
    // new + excellent → only the dealer buffer applies (0.85)
    expect(e.estimateUsd).toBe(17000);
    expect(e.lowUsd).toBeLessThan(e.estimateUsd);
    expect(e.highUsd).toBeGreaterThan(e.estimateUsd);
  });

  it("depreciates for age, mileage, and condition", () => {
    const fresh = estimateTradeIn({ marketMedianUsd: 20000, year: 2026, mileageKm: 0, condition: "excellent", nowYear: 2026 })!;
    const worn = estimateTradeIn({ marketMedianUsd: 20000, year: 2018, mileageKm: 120000, condition: "fair", nowYear: 2026 })!;
    expect(worn.estimateUsd).toBeLessThan(fresh.estimateUsd);
  });

  it("never depreciates below the floor", () => {
    const e = estimateTradeIn({ marketMedianUsd: 20000, year: 1995, mileageKm: 500000, condition: "poor", nowYear: 2026 })!;
    expect(e.estimateUsd).toBeGreaterThan(0);
  });
});

describe("partFitsCar", () => {
  const base: PartLite = {
    id: "1", slug: "p", name_ru: "Фильтр", category: "engine", price_usd: 30, images: [],
    fits_brands: ["BYD"], fits_models: ["Song Plus"], fits_year_from: 2022, fits_year_to: 2025,
  };
  it("matches on brand + model + year range", () => {
    expect(partFitsCar(base, { brand: "BYD", model: "Song Plus", year: 2024 })).toBe(true);
  });
  it("rejects a different brand", () => {
    expect(partFitsCar(base, { brand: "Chery", model: "Song Plus", year: 2024 })).toBe(false);
  });
  it("does fuzzy model match (Song ⊂ Song Plus)", () => {
    expect(partFitsCar({ ...base, fits_models: ["Song"] }, { brand: "BYD", model: "Song Plus", year: 2024 })).toBe(true);
  });
  it("rejects out-of-range year", () => {
    expect(partFitsCar(base, { brand: "BYD", model: "Song Plus", year: 2019 })).toBe(false);
  });
  it("brand-only part fits any model of that brand", () => {
    expect(partFitsCar({ ...base, fits_models: [], fits_year_from: null, fits_year_to: null }, { brand: "BYD", model: "Han", year: 2023 })).toBe(true);
  });
});
