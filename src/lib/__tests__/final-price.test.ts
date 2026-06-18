import { describe, it, expect } from "vitest";
import { finalCarPrice } from "../final-price";

describe("finalCarPrice — landed cost + final sale price", () => {
  it("landed = car + freight + customs + cert + inland; final = landed × (1+margin)", () => {
    const r = finalCarPrice({ carUsd: 20000, fuelType: "бензин", year: 2026, engineCc: 2000, freightUsd: 2500, certUsd: 300, inlandUsd: 200, marginPct: 18, usdUzs: 12600 });
    expect(r.landedUsd).toBe(r.carUsd + r.freightUsd + r.customsUsd + r.certUsd + r.inlandUsd);
    expect(r.finalUsd).toBe(Math.round(r.landedUsd * 1.18));
    expect(r.marginUsd).toBe(r.finalUsd - r.landedUsd);
    expect(r.customsUsd).toBe(r.customs.customsCostUsd);
  });

  it("uses the authoritative customs engine (electric → 0% duty line)", () => {
    const r = finalCarPrice({ carUsd: 30000, fuelType: "электро", year: 2025 });
    expect(r.customs.lines.find((l) => l.key === "duty")).toBeUndefined();
    expect(r.finalUsd).toBeGreaterThan(r.landedUsd); // margin applied
  });

  it("respects a custom margin", () => {
    const a = finalCarPrice({ carUsd: 20000, fuelType: "бензин", year: 2026, engineCc: 2000, marginPct: 10, usdUzs: 12600 });
    const b = finalCarPrice({ carUsd: 20000, fuelType: "бензин", year: 2026, engineCc: 2000, marginPct: 25, usdUzs: 12600 });
    expect(b.finalUsd).toBeGreaterThan(a.finalUsd);
    expect(a.landedUsd).toBe(b.landedUsd); // margin doesn't change cost
  });

  it("older + uncertified raises customs (and the final price)", () => {
    const newCert = finalCarPrice({ carUsd: 20000, fuelType: "бензин", year: 2026, engineCc: 2000, origin: "certified", usdUzs: 12600 });
    const oldNoCert = finalCarPrice({ carUsd: 20000, fuelType: "бензин", year: 2020, engineCc: 2000, origin: "uncertified", usdUzs: 12600 });
    expect(oldNoCert.customsUsd).toBeGreaterThan(newCert.customsUsd);
    expect(oldNoCert.finalUsd).toBeGreaterThan(newCert.finalUsd);
  });
});
