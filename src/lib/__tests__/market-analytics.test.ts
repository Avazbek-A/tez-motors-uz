import { describe, it, expect } from "vitest";
import {
  inferSold,
  extractPhone,
  classifySeller,
  motivationScore,
  dedupeListings,
  shrinkEstimate,
  predictionInterval,
  priceElasticity,
  estimateAnnualDepreciation,
  residualValue,
  regionalSpread,
  regimeBreak,
  extractVin,
  vinJourneys,
  holdingCost,
  warrantyMonthsLeft,
  valueAdjustmentFactor,
  negotiationBand,
} from "../market-analytics";

const now = Date.parse("2026-06-14T00:00:00Z");
const day = 86_400_000;
const at = (d: number) => new Date(now - d * day).toISOString();

describe("inferSold", () => {
  it("treats stale listings as sold and estimates a clearing price below asking", () => {
    const listings = [
      // gone (last seen 30d ago, lived 20d): asking 20000
      { price_usd: 20000, observed_at: at(50), last_seen_at: at(30) },
      { price_usd: 22000, observed_at: at(48), last_seen_at: at(31) },
      // still live (seen 2d ago)
      { price_usd: 25000, observed_at: at(10), last_seen_at: at(2) },
    ];
    const s = inferSold(listings, { now, staleDays: 14, haggleGap: 0.05 });
    expect(s.soldCount).toBe(2);
    expect(s.activeCount).toBe(1);
    expect(s.askingMedianUsd).toBe(21000);
    expect(s.clearingMedianUsd).toBe(Math.round(21000 * 0.95));
    expect(s.medianDaysToSell).toBeGreaterThan(0);
  });
});

describe("extractPhone", () => {
  it("normalizes UZ phones to 9-digit national", () => {
    expect(extractPhone("звоните +998 90 123 45 67")).toBe("901234567");
    expect(extractPhone("тел: 998901234567")).toBe("901234567");
    expect(extractPhone("no phone here")).toBeNull();
  });
});

describe("classifySeller", () => {
  it("flags salon/credit text as dealer", () => {
    expect(classifySeller("Автосалон, в наличии, рассрочка")).toBe("dealer");
    expect(classifySeller("продаю свою машину")).toBe("private");
  });
  it("flags bulk phones as dealer", () => {
    expect(classifySeller("обычное объявление", { phoneListingCount: 8 })).toBe("dealer");
  });
});

describe("motivationScore", () => {
  it("scores urgency higher", () => {
    expect(motivationScore("СРОЧНО продаю, уезжаю, торг уместен")).toBeGreaterThan(0.7);
    expect(motivationScore("продаю автомобиль")).toBe(0);
  });
  it("adds for a recorded price drop", () => {
    expect(motivationScore("торг", { priceDropped: true })).toBeGreaterThan(motivationScore("торг"));
  });
});

describe("dedupeListings", () => {
  it("collapses the same car cross-posted under one phone, keeping the freshest", () => {
    const rows = [
      { raw_text: "tel 998901112233", model: "Tiggo 7", year: 2022, price_usd: 20100, observed_at: at(20), last_seen_at: at(20) },
      { raw_text: "звоните 90 111 22 33", model: "Tiggo 7", year: 2022, price_usd: 20000, observed_at: at(10), last_seen_at: at(3) },
      { raw_text: "no phone", model: "Tiggo 7", year: 2022, price_usd: 21000, observed_at: at(5), last_seen_at: at(5) },
    ];
    const out = dedupeListings(rows);
    expect(out.length).toBe(2); // two phone-matched collapse to 1, the no-phone passes through
    expect(out.find((r) => r.raw_text === "no phone")).toBeTruthy();
  });
});

describe("shrinkEstimate", () => {
  it("leans on the group for thin samples, the model for rich ones", () => {
    expect(shrinkEstimate(30000, 0, 20000)).toBe(20000); // n=0 → all group
    expect(shrinkEstimate(30000, 5, 20000)).toBe(25000); // n=k=5 → 50/50
    expect(shrinkEstimate(30000, 95, 20000)).toBe(29500); // n>>k → mostly model
  });
});

describe("predictionInterval", () => {
  it("returns a band around the median", () => {
    const r = predictionInterval(20000, [19000, 20000, 21000, 20500, 19500])!;
    expect(r.low).toBeLessThan(20000);
    expect(r.high).toBeGreaterThan(20000);
  });
  it("null for tiny samples", () => {
    expect(predictionInterval(20000, [20000])).toBeNull();
  });
});

describe("priceElasticity", () => {
  it("positive days-per-$ when pricier cars take longer", () => {
    const listings = [
      { price_usd: 18000, observed_at: at(40), last_seen_at: at(35) }, // 5d
      { price_usd: 20000, observed_at: at(40), last_seen_at: at(30) }, // 10d
      { price_usd: 22000, observed_at: at(40), last_seen_at: at(25) }, // 15d
      { price_usd: 24000, observed_at: at(40), last_seen_at: at(20) }, // 20d
    ];
    const e = priceElasticity(listings, { now, staleDays: 14 });
    expect(e.n).toBe(4);
    expect(e.daysPerUsd!).toBeGreaterThan(0);
  });
});

describe("estimateAnnualDepreciation + residualValue", () => {
  it("fits a positive annual depreciation from year medians", () => {
    const pts = [
      { year: 2024, medianUsd: 25000 },
      { year: 2022, medianUsd: 21000 },
      { year: 2020, medianUsd: 17000 },
      { year: 2018, medianUsd: 14000 },
    ];
    const rate = estimateAnnualDepreciation(pts, 2026)!;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(40);
  });
  it("projects value forward", () => {
    expect(residualValue(20000, 12, 10)).toBe(18000); // -10% over a year
    expect(residualValue(20000, 0, 10)).toBe(20000);
  });
});

describe("regionalSpread", () => {
  it("ranks cities cheapest-first with deltas vs overall", () => {
    const listings = [
      { city: "Tashkent", price_usd: 22000 },
      { city: "Tashkent", price_usd: 23000 },
      { city: "Tashkent", price_usd: 24000 },
      { city: "Fergana", price_usd: 19000 },
      { city: "Fergana", price_usd: 20000 },
      { city: "Fergana", price_usd: 21000 },
    ];
    const r = regionalSpread(listings, { minSample: 3 });
    expect(r[0].city).toBe("Fergana"); // cheapest first
    expect(r[0].deltaPct!).toBeLessThan(0);
  });
});

describe("regimeBreak", () => {
  it("detects a structural price jump", () => {
    const recent = Array.from({ length: 6 }, (_, i) => ({ price_usd: 30000 + i * 100, last_seen_at: at(5) }));
    const prior = Array.from({ length: 6 }, (_, i) => ({ price_usd: 20000 + i * 100, last_seen_at: at(45) }));
    const r = regimeBreak([...recent, ...prior], { now, windowDays: 30, shiftThresholdPct: 15 });
    expect(r.broke).toBe(true);
    expect(r.shiftPct!).toBeGreaterThan(15);
  });
  it("no break for a stable market", () => {
    const all = Array.from({ length: 12 }, (_, i) => ({ price_usd: 20000 + (i % 3) * 100, last_seen_at: at(i < 6 ? 5 : 45) }));
    expect(regimeBreak(all, { now }).broke).toBe(false);
  });
});

describe("extractVin + vinJourneys", () => {
  it("extracts a 17-char VIN", () => {
    expect(extractVin("VIN: LGXC76CF4N0123456 проверен")).toBe("LGXC76CF4N0123456");
    expect(extractVin("no vin")).toBeNull();
  });
  it("flags an odometer rollback across sightings", () => {
    const listings = [
      { raw_text: "LGXC76CF4N0123456", mileage_km: 80000, price_usd: 20000, observed_at: at(60) },
      { raw_text: "vin LGXC76CF4N0123456", mileage_km: 60000, price_usd: 19000, observed_at: at(10) }, // km dropped → rollback
    ];
    const j = vinJourneys(listings);
    expect(j.length).toBe(1);
    expect(j[0].rollback).toBe(true);
    expect(j[0].priceDropUsd).toBe(1000);
  });
});

describe("holdingCost", () => {
  it("charges capital cost per day held", () => {
    // $20000 at 24%/yr for ~183d ≈ $2400
    expect(holdingCost(20000, 365, { annualCapitalCostPct: 24 })).toBe(4800);
    expect(holdingCost(20000, 0)).toBe(0);
  });
});

describe("warrantyMonthsLeft", () => {
  it("counts down a 36-month warranty", () => {
    const oneYearAgo = new Date(now - 365 * day).toISOString().slice(0, 10);
    expect(warrantyMonthsLeft(oneYearAgo, { now })).toBe(24);
    expect(warrantyMonthsLeft(null)).toBeNull();
  });
});

describe("valueAdjustmentFactor", () => {
  it("discounts a degraded battery", () => {
    expect(valueAdjustmentFactor({ batterySohPct: 80 })).toBeCloseTo(0.92, 2); // -20pts × 0.4%
  });
  it("rewards warranty + official import, penalizes gray", () => {
    expect(valueAdjustmentFactor({ warrantyMonthsLeft: 36, importChannel: "official" })).toBeGreaterThan(1);
    expect(valueAdjustmentFactor({ importChannel: "gray" })).toBeLessThan(1);
  });
  it("is neutral with no inputs", () => {
    expect(valueAdjustmentFactor({})).toBe(1);
  });
});

describe("negotiationBand", () => {
  it("walk-away = cost + min margin, target = fair, opening above target", () => {
    const b = negotiationBand(20000, 24000, { minMarginPct: 5, openingBufferPct: 5 });
    expect(b.walkAwayUsd).toBe(21000); // 20000 × 1.05
    expect(b.targetUsd).toBe(24000);
    expect(b.openingUsd).toBe(25200); // 24000 × 1.05
  });
  it("handles missing cost", () => {
    expect(negotiationBand(null, 24000).walkAwayUsd).toBeNull();
  });
});
