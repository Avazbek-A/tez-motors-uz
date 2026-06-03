import { describe, it, expect } from "vitest";
import { buildMarketDigest, MIN_SAMPLE, OPPORTUNITY_SAMPLE, type MarketRow } from "../market-digest";

const row = (o: Partial<MarketRow>): MarketRow => ({
  brand: "BYD", model: "Song Plus", medianUsd: 30000, count: 5, ourPriceUsd: null, weSell: false, vsMarketPct: null, ...o,
});

describe("buildMarketDigest", () => {
  it("returns a single 'not enough data' line when nothing qualifies", () => {
    const out = buildMarketDigest([row({ count: MIN_SAMPLE - 1 })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/мало|Not much|kam/);
  });

  it("flags cars priced above market", () => {
    const out = buildMarketDigest([
      row({ brand: "Haval", model: "H6", weSell: true, ourPriceUsd: 34000, vsMarketPct: 13, count: 4 }),
    ]);
    expect(out.join("\n")).toMatch(/Haval H6/);
    expect(out.join("\n")).toMatch(/\+13%/);
  });

  it("flags below-market cars and opportunities separately", () => {
    const out = buildMarketDigest([
      row({ brand: "Chery", model: "Tiggo 8", weSell: true, ourPriceUsd: 26000, medianUsd: 30000, vsMarketPct: -13, count: 3 }),
      row({ brand: "Zeekr", model: "001", weSell: false, medianUsd: 47000, count: OPPORTUNITY_SAMPLE }),
    ]);
    const text = out.join("\n");
    expect(text).toMatch(/Chery Tiggo 8/);
    expect(text).toMatch(/Zeekr 001/);
  });

  it("ignores low-sample models (unreliable median)", () => {
    const out = buildMarketDigest([
      row({ brand: "MG", model: "HS", weSell: true, ourPriceUsd: 40000, vsMarketPct: 30, count: 1 }),
    ]);
    expect(out.join("\n")).not.toMatch(/MG HS/);
  });
});
