import { describe, it, expect } from "vitest";
import { scrubCarsForPublic } from "../cars-query";

describe("scrubCarsForPublic", () => {
  it("strips private top-level columns (provenance, battery, warranty)", () => {
    const rows = [
      {
        id: "1",
        brand: "Chery",
        model: "Tiggo 7",
        price_usd: 20000,
        import_channel: "gray", // sensitive — must NOT reach clients
        battery_soh_pct: 88,
        in_service_date: "2024-01-01",
      },
    ];
    const [out] = scrubCarsForPublic(rows) as Record<string, unknown>[];
    expect(out.import_channel).toBeUndefined();
    expect(out.battery_soh_pct).toBeUndefined();
    expect(out.in_service_date).toBeUndefined();
    // public fields survive
    expect(out.brand).toBe("Chery");
    expect(out.price_usd).toBe(20000);
  });

  it("strips provenance keys from the legacy specs jsonb", () => {
    const rows = [{ id: "1", specs: { source: "autohome", confidence: 0.95, autohome_id: 5232, doors: 5 } }];
    const [out] = scrubCarsForPublic(rows) as { specs: Record<string, unknown> }[];
    expect(out.specs.source).toBeUndefined();
    expect(out.specs.confidence).toBeUndefined();
    expect(out.specs.autohome_id).toBeUndefined();
    expect(out.specs.doors).toBe(5); // real spec survives
  });

  it("is a no-op on rows without private fields", () => {
    const rows = [{ id: "1", brand: "BYD", price_usd: 30000 }];
    expect(scrubCarsForPublic(rows)).toEqual([{ id: "1", brand: "BYD", price_usd: 30000 }]);
  });
});
