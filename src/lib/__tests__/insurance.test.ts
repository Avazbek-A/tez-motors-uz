import { describe, it, expect } from "vitest";
import { estimateOsago, estimateKasko } from "../insurance";

describe("estimateOsago", () => {
  it("scales by region and engine power", () => {
    const base = estimateOsago({ region: "other", enginePowerHp: 90 });
    const tashkent = estimateOsago({ region: "tashkent_city", enginePowerHp: 90 });
    const powerful = estimateOsago({ region: "other", enginePowerHp: 250 });
    expect(tashkent).toBeGreaterThan(base);
    expect(powerful).toBeGreaterThan(base);
  });
  it("adds a premium for unlimited drivers", () => {
    const limited = estimateOsago({ region: "tashkent_city", enginePowerHp: 120, unlimitedDrivers: false });
    const unlimited = estimateOsago({ region: "tashkent_city", enginePowerHp: 120, unlimitedDrivers: true });
    expect(unlimited).toBeGreaterThan(limited);
  });
  it("returns a positive integer", () => {
    const v = estimateOsago({ region: "tashkent_city", enginePowerHp: 150 });
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThan(0);
  });
});

describe("estimateKasko", () => {
  it("is a percentage of car value, lower for new cars", () => {
    const usedV = estimateKasko({ carValueUsd: 30000, isNew: false });
    const newV = estimateKasko({ carValueUsd: 30000, isNew: true });
    expect(usedV).toBe(1500); // 5%
    expect(newV).toBe(1050); // 3.5%
    expect(newV).toBeLessThan(usedV);
  });
  it("is 0 for a non-positive value", () => {
    expect(estimateKasko({ carValueUsd: 0 })).toBe(0);
    expect(estimateKasko({ carValueUsd: -5 })).toBe(0);
  });
});
