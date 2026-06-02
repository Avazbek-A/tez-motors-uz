import { describe, it, expect } from "vitest";
import {
  parseMoney,
  toUsd,
  priceToUsd,
  fingerprint,
  median,
  summarize,
  profitability,
} from "../market-intel";

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
