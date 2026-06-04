import { describe, it, expect } from "vitest";
import { buildProfile, scoreCarForProfile, recommendFromProfile, profileIsEmpty, type ScorableCar } from "../recommend";

const car = (id: string, brand: string, body: string, fuel: string, price: number): ScorableCar => ({
  id, brand, body_type: body, fuel_type: fuel, price_usd: price,
});

describe("buildProfile", () => {
  it("collects brands/body/fuel and averages price", () => {
    const p = buildProfile([car("1", "BYD", "suv", "hybrid", 30000), car("2", "BYD", "sedan", "electric", 40000)]);
    expect(p.brands.has("byd")).toBe(true);
    expect(p.bodyTypes.has("suv")).toBe(true);
    expect(p.priceCenter).toBe(35000);
  });
  it("is empty for no seed", () => {
    expect(profileIsEmpty(buildProfile([]))).toBe(true);
  });
});

describe("scoreCarForProfile", () => {
  const p = buildProfile([car("1", "BYD", "suv", "hybrid", 30000)]);
  it("rewards brand > body/fuel > price proximity", () => {
    expect(scoreCarForProfile(car("x", "BYD", "suv", "hybrid", 31000), p)).toBe(3 + 2 + 2 + 1);
    expect(scoreCarForProfile(car("x", "Chery", "sedan", "petrol", 90000), p)).toBe(0);
  });
});

describe("recommendFromProfile", () => {
  const seed = [car("1", "BYD", "suv", "hybrid", 30000)];
  const profile = buildProfile(seed);
  const candidates = [
    car("1", "BYD", "suv", "hybrid", 30000), // excluded (seed)
    car("2", "BYD", "suv", "hybrid", 32000), // strong
    car("3", "BYD", "sedan", "petrol", 33000), // brand only
    car("4", "Chery", "sedan", "petrol", 90000), // zero
  ];
  it("excludes seed + zero-score, ranks by affinity", () => {
    const ids = recommendFromProfile(candidates, profile, new Set(["1"])).map((c) => c.id);
    expect(ids).toEqual(["2", "3"]);
  });
  it("returns empty for an empty profile (cold start)", () => {
    expect(recommendFromProfile(candidates, buildProfile([]), new Set())).toEqual([]);
  });
  it("respects max", () => {
    expect(recommendFromProfile(candidates, profile, new Set(["1"]), 1)).toHaveLength(1);
  });
});
