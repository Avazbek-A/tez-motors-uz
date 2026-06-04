import { describe, it, expect } from "vitest";
import { summarizeRatings } from "../reviews-aggregate";

describe("summarizeRatings", () => {
  it("averages per car and counts, rounding to 1 decimal", () => {
    const m = summarizeRatings([
      { car_id: "a", rating: 5 },
      { car_id: "a", rating: 4 },
      { car_id: "b", rating: 3 },
    ]);
    expect(m.get("a")).toEqual({ avg: 4.5, count: 2 });
    expect(m.get("b")).toEqual({ avg: 3, count: 1 });
  });

  it("ignores null car_id and non-numeric ratings", () => {
    const m = summarizeRatings([
      { car_id: null, rating: 5 },
      { car_id: "a", rating: null },
      { car_id: "a", rating: 4 },
    ]);
    expect(m.get("a")).toEqual({ avg: 4, count: 1 });
    expect(m.size).toBe(1);
  });

  it("rounds to one decimal", () => {
    const m = summarizeRatings([
      { car_id: "a", rating: 5 },
      { car_id: "a", rating: 4 },
      { car_id: "a", rating: 4 },
    ]); // 13/3 = 4.333
    expect(m.get("a")?.avg).toBe(4.3);
  });

  it("is empty for no rows", () => {
    expect(summarizeRatings([]).size).toBe(0);
  });
});
