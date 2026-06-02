import { describe, it, expect } from "vitest";
import { scoreLead, leadTier } from "../lead-score";

describe("scoreLead", () => {
  it("ranks a car-linked reservation with email + message as hot", () => {
    const s = scoreLead({ type: "reservation", hasCarId: true, hasEmail: true, messageLength: 120, amountUsd: 2000 });
    expect(s).toBeGreaterThanOrEqual(60);
    expect(leadTier(s)).toBe("hot");
  });

  it("ranks a bare newsletter signup as cold", () => {
    const s = scoreLead({ type: "newsletter" });
    expect(leadTier(s)).toBe("cold");
  });

  it("rewards buying signals incrementally", () => {
    const base = scoreLead({ type: "car_inquiry" });
    const withCar = scoreLead({ type: "car_inquiry", hasCarId: true });
    const withCarEmail = scoreLead({ type: "car_inquiry", hasCarId: true, hasEmail: true });
    expect(withCar).toBeGreaterThan(base);
    expect(withCarEmail).toBeGreaterThan(withCar);
  });

  it("clamps to 0..100", () => {
    const s = scoreLead({ type: "reservation", hasCarId: true, hasEmail: true, messageLength: 999, amountUsd: 9999 });
    expect(s).toBeLessThanOrEqual(100);
    expect(s).toBeGreaterThanOrEqual(0);
  });

  it("defaults unknown types to a low base", () => {
    expect(scoreLead({ type: "totally_unknown" })).toBeLessThan(35);
  });
});
