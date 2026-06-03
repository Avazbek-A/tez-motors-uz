import { describe, it, expect } from "vitest";
import {
  buildMarketingSuggestions,
  AGED_LOT_DAYS,
  NEW_ARRIVAL_DAYS,
  HOT_DEMAND_MIN,
  type MarketingSignals,
} from "../marketing-autopilot";

const empty: MarketingSignals = { agedStock: [], newArrivals: [], hotDemand: [], activePromos: [] };

describe("buildMarketingSuggestions", () => {
  it("always proposes something — evergreen fallback when there are no signals", () => {
    const s = buildMarketingSuggestions(empty);
    expect(s.length).toBeGreaterThanOrEqual(1);
    expect(s[0].key).toBe("evergreen:import-guide");
    expect(s[0].kind).toBe("blog");
  });

  it("prioritizes aged stock first, capped at 3", () => {
    const agedStock = Array.from({ length: 5 }, (_, i) => ({
      carId: `c${i}`,
      name: `Car ${i}`,
      daysOnLot: AGED_LOT_DAYS + 10 + i,
      priceUsd: 30000,
    }));
    const s = buildMarketingSuggestions({ ...empty, agedStock });
    const aged = s.filter((x) => x.key.startsWith("aged:"));
    expect(aged).toHaveLength(3);
    expect(s[0].priority).toBe(1);
    expect(s[0].kind).toBe("promo");
  });

  it("ignores stock that is not actually aged", () => {
    const agedStock = [{ carId: "c1", name: "Fresh", daysOnLot: AGED_LOT_DAYS - 1, priceUsd: 20000 }];
    const s = buildMarketingSuggestions({ ...empty, agedStock });
    expect(s.some((x) => x.key.startsWith("aged:"))).toBe(false);
  });

  it("makes a roundup when 3+ new arrivals, individual posts otherwise", () => {
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ carId: `n${i}`, name: `New ${i}`, daysOnLot: 1, priceUsd: 25000 }));

    const roundup = buildMarketingSuggestions({ ...empty, newArrivals: mk(3) });
    expect(roundup.some((x) => x.key === "arrivals:roundup")).toBe(true);
    expect(roundup.find((x) => x.key === "arrivals:roundup")?.carId).toBeNull();

    const individual = buildMarketingSuggestions({ ...empty, newArrivals: mk(2) });
    expect(individual.filter((x) => x.key.startsWith("arrival:"))).toHaveLength(2);
    expect(individual.some((x) => x.key === "arrivals:roundup")).toBe(false);
  });

  it("excludes arrivals that are too old to be 'new'", () => {
    const newArrivals = [{ carId: "old", name: "Old arrival", daysOnLot: NEW_ARRIVAL_DAYS + 5, priceUsd: 25000 }];
    const s = buildMarketingSuggestions({ ...empty, newArrivals });
    expect(s.some((x) => x.key.startsWith("arrival"))).toBe(false);
  });

  it("amplifies active promos and respects the hot-demand threshold", () => {
    const s = buildMarketingSuggestions({
      ...empty,
      activePromos: [{ carId: "p1", name: "Deal Car", label: "Spring sale", salePriceUsd: 19999 }],
      hotDemand: [
        { carId: "h1", name: "Wanted", inquiries: HOT_DEMAND_MIN },
        { carId: "h2", name: "Quiet", inquiries: HOT_DEMAND_MIN - 1 },
      ],
    });
    expect(s.some((x) => x.key === "promo:p1")).toBe(true);
    expect(s.some((x) => x.key === "demand:h1")).toBe(true);
    expect(s.some((x) => x.key === "demand:h2")).toBe(false);
    // Promo (priority 3) ranks above demand (priority 4).
    const promoIdx = s.findIndex((x) => x.key === "promo:p1");
    const demandIdx = s.findIndex((x) => x.key === "demand:h1");
    expect(promoIdx).toBeLessThan(demandIdx);
  });

  it("does not add the evergreen fallback when there is enough timely content", () => {
    const s = buildMarketingSuggestions({
      ...empty,
      agedStock: [
        { carId: "a", name: "A", daysOnLot: AGED_LOT_DAYS + 1, priceUsd: 20000 },
        { carId: "b", name: "B", daysOnLot: AGED_LOT_DAYS + 2, priceUsd: 20000 },
      ],
    });
    expect(s.some((x) => x.key === "evergreen:import-guide")).toBe(false);
  });
});
