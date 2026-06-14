import { describe, it, expect } from "vitest";
import {
  parseMoney,
  toUsd,
  priceToUsd,
  fingerprint,
  median,
  summarize,
  profitability,
  cleanCarPrices,
  extractMileageKm,
  extractCondition,
  priceTrend,
  priceConfidence,
  mileageAdjustedValue,
} from "../market-intel";

describe("cleanCarPrices", () => {
  it("drops parts/junk below the car-price floor", () => {
    // OLX 'Jolion' search pulls in $5 mats etc.; real cars cluster ~$21k.
    const cleaned = cleanCarPrices([5, 75, 300, 21000, 22000, 20000, 23000, 26000]);
    expect(cleaned).not.toContain(5);
    expect(cleaned).not.toContain(300);
    expect(median(cleaned)).toBeGreaterThan(15000);
  });
  it("trims extreme outliers around the provisional median", () => {
    expect(cleanCarPrices([20000, 21000, 22000, 23000, 82000])).not.toContain(82000);
  });
  it("keeps a thin cluster as-is when too few to trim", () => {
    expect(cleanCarPrices([19048])).toEqual([19048]);
    expect(cleanCarPrices([5, 75])).toEqual([]); // all junk → empty
  });
});

describe("parseMoney", () => {
  it("parses USD listings", () => {
    expect(parseMoney("$15 000")).toEqual({ amount: 15000, currency: "usd" });
    expect(parseMoney("15 000 у.е.")).toEqual({ amount: 15000, currency: "usd" });
  });
  it("parses soum listings", () => {
    expect(parseMoney("180 000 000 сум")).toEqual({ amount: 180000000, currency: "uzs" });
  });
  it("handles million shorthand as soum", () => {
    expect(parseMoney("180 млн")).toEqual({ amount: 180000000, currency: "uzs" });
  });
  it("guesses currency from magnitude when unmarked", () => {
    expect(parseMoney("18000")).toEqual({ amount: 18000, currency: "usd" });
    expect(parseMoney("230000000")).toEqual({ amount: 230000000, currency: "uzs" });
  });
  it("returns null with no number", () => {
    expect(parseMoney("договорная")).toBeNull();
  });
  it("ignores Uzbek phone numbers and picks the real price", () => {
    // A Telegram post: price $24 000, contact +998 90 123 45 67.
    expect(parseMoney("BYD Song Plus 2024, $24 000, тел +998 90 123 45 67")).toEqual({ amount: 24000, currency: "usd" });
    // Bare 998… phone must not be read as a price.
    expect(parseMoney("Haval Jolion, 998901234567")).toBeNull();
    // Phone with no price → no money.
    expect(parseMoney("звоните 998 99 817 77 73")).toBeNull();
  });
});

describe("toUsd / priceToUsd", () => {
  it("converts soum to USD at the given rate", () => {
    expect(toUsd({ amount: 126_000_000, currency: "uzs" }, 12600)).toBe(10000);
  });
  it("passes USD through", () => {
    expect(toUsd({ amount: 15000, currency: "usd" }, 12600)).toBe(15000);
  });
  it("end-to-end parse + normalize", () => {
    expect(priceToUsd("189 000 000 сум", 12600)).toBe(15000);
    expect(priceToUsd("$22,500", 12600)).toBe(22500);
  });
  it("returns null for unparseable", () => {
    expect(priceToUsd("звоните", 12600)).toBeNull();
  });
});

describe("fingerprint", () => {
  it("prefers an explicit source ref", () => {
    expect(fingerprint({ source: "olx", source_ref: "/d/123" })).toBe("olx:/d/123");
  });
  it("falls back to a normalized field hash", () => {
    expect(fingerprint({ source: "telegram", brand: "BYD", model: "Song Plus", year: 2024, price_usd: 30000, city: "Tashkent" }))
      .toBe("telegram|byd|song plus|2024|30000|tashkent");
  });
});

describe("median", () => {
  it("computes odd and even medians", () => {
    expect(median([10, 30, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
  });
  it("returns null on empty", () => {
    expect(median([])).toBeNull();
  });
});

describe("summarize", () => {
  it("groups by brand/model/year with median + range + count", () => {
    const groups = summarize([
      { brand: "BYD", model: "Song Plus", year: 2024, price_usd: 30000, observed_at: "2026-05-01" },
      { brand: "BYD", model: "Song Plus", year: 2024, price_usd: 32000, observed_at: "2026-05-10" },
      { brand: "BYD", model: "Song Plus", year: 2024, price_usd: 34000, observed_at: "2026-05-05" },
      { brand: "Chery", model: "Tiggo 8", year: 2024, price_usd: 28000, observed_at: "2026-05-02" },
    ]);
    const byd = groups.find((g) => g.model === "Song Plus")!;
    expect(byd.count).toBe(3);
    expect(byd.medianUsd).toBe(32000);
    expect(byd.minUsd).toBe(30000);
    expect(byd.maxUsd).toBe(34000);
    expect(byd.latestObservedAt).toBe("2026-05-10");
    // most-sampled first
    expect(groups[0].model).toBe("Song Plus");
  });
});

describe("profitability", () => {
  it("computes margin and pct of landed cost", () => {
    expect(profitability(36000, 30000)).toEqual({ marginUsd: 6000, marginPct: 20 });
  });
  it("returns nulls when inputs are missing", () => {
    expect(profitability(null, 30000)).toEqual({ marginUsd: null, marginPct: null });
    expect(profitability(36000, 0)).toEqual({ marginUsd: null, marginPct: null });
  });
});

describe("extractMileageKm", () => {
  it("parses spaced + plain km", () => {
    expect(extractMileageKm("Tiggo 7, 120 000 км, 2022")).toBe(120000);
    expect(extractMileageKm("пробег 85000 km")).toBe(85000);
  });
  it("handles 'тыс км' as thousands", () => {
    expect(extractMileageKm("150 тыс км")).toBe(150000);
    expect(extractMileageKm("150 тыс. км")).toBe(150000);
  });
  it("doesn't grab engine displacement or absent km", () => {
    expect(extractMileageKm("2.0 turbo, отличное состояние")).toBeNull();
    expect(extractMileageKm("$18 500, торг")).toBeNull();
    expect(extractMileageKm(null)).toBeNull();
  });
});

describe("extractCondition", () => {
  it("detects used", () => {
    expect(extractCondition("Cobalt, с пробегом 90000 км")).toBe("used");
    expect(extractCondition("б/у, торг")).toBe("used");
  });
  it("detects new", () => {
    expect(extractCondition("Новый автомобиль, 0 км")).toBe("new");
    expect(extractCondition("без пробега")).toBe("new");
  });
  it("returns null with no signal", () => {
    expect(extractCondition("Chevrolet Cobalt 2023")).toBeNull();
  });
});

describe("priceTrend", () => {
  const now = Date.parse("2026-06-14T00:00:00Z");
  const day = 86_400_000;
  it("computes window-over-window change", () => {
    const listings = [
      // recent (≤30d): median 22000
      { price_usd: 21000, last_seen_at: new Date(now - 5 * day).toISOString() },
      { price_usd: 22000, last_seen_at: new Date(now - 6 * day).toISOString() },
      { price_usd: 23000, last_seen_at: new Date(now - 7 * day).toISOString() },
      // prior (31–60d): median 20000
      { price_usd: 19000, last_seen_at: new Date(now - 40 * day).toISOString() },
      { price_usd: 20000, last_seen_at: new Date(now - 45 * day).toISOString() },
      { price_usd: 21000, last_seen_at: new Date(now - 50 * day).toISOString() },
    ];
    const t = priceTrend(listings, { now });
    expect(t.recentMedian).toBe(22000);
    expect(t.priorMedian).toBe(20000);
    expect(t.changePct).toBe(10); // +10%
    expect(t.recentCount).toBe(3);
  });
  it("null change when a window is empty", () => {
    const t = priceTrend([{ price_usd: 20000, last_seen_at: new Date(now - 3 * day).toISOString() }], { now });
    expect(t.changePct).toBeNull();
  });
});

describe("priceConfidence", () => {
  it("high for big fresh tight multi-source samples", () => {
    const c = priceConfidence({ sampleSize: 15, freshnessDays: 2, spreadPct: 10, sourceCount: 3 });
    expect(c.label).toBe("high");
    expect(c.score).toBeGreaterThan(0.66);
  });
  it("low for a single stale wide comp", () => {
    const c = priceConfidence({ sampleSize: 1, freshnessDays: 90, spreadPct: 90, sourceCount: 1 });
    expect(c.label).toBe("low");
  });
});

describe("mileageAdjustedValue", () => {
  it("regresses price down with mileage", () => {
    // perfectly linear: $25000 at 0km, −$0.1/km
    const comps = [
      { price_usd: 25000, mileage_km: 0 },
      { price_usd: 24000, mileage_km: 10000 },
      { price_usd: 23000, mileage_km: 20000 },
      { price_usd: 22000, mileage_km: 30000 },
      { price_usd: 21000, mileage_km: 40000 },
    ];
    const r = mileageAdjustedValue(comps, 50000);
    expect(r.basis).toBe("regression");
    expect(r.value).toBe(20000); // extrapolated
    expect(r.perKm).toBeCloseTo(-0.1, 2);
  });
  it("falls back to median when comps are thin", () => {
    const r = mileageAdjustedValue([{ price_usd: 20000, mileage_km: 50000 }], 30000);
    expect(r.basis).toBe("median");
  });
});
