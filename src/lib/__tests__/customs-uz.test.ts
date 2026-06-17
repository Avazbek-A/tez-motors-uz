import { describe, it, expect } from "vitest";
import { computeCustomsUz, dutyRate, utilizationBrv, resolveVehicleKind, resolveVehicleAge } from "../customs-uz";

// All cells below were probed directly from @autodeklarantbot at $20,000,
// 2000 cc, USD/UZS = 12012.12 — `customsCostUsd` must match its "Растаможка $".
const BOT = (over: Partial<Parameters<typeof computeCustomsUz>[0]>) =>
  computeCustomsUz({ priceUsd: 20000, engineCc: 2000, usdUzs: 12012.12, ...over } as Parameters<typeof computeCustomsUz>[0]).customsCostUsd;

describe("computeCustomsUz — validated against @autodeklarantbot", () => {
  it("petrol, certified China, new (≤1yr): 15% + $1/cc → $14,260", () => {
    expect(BOT({ kind: "petrol", age: "new", origin: "certified" })).toBe(14260);
  });
  it("petrol, certified, 1–3yr: 30% + $2.5/cc → $20,980", () => {
    expect(BOT({ kind: "petrol", age: "used1to3", origin: "certified" })).toBe(20980);
  });
  it("petrol, certified, >3yr: 40% + $3/cc, util 330 BRV → $29,485", () => {
    expect(BOT({ kind: "petrol", age: "used3plus", origin: "certified" })).toBe(29485);
  });
  it("petrol, FTA origin (Russia), 1–3yr: 0% duty → $8,660", () => {
    expect(BOT({ kind: "petrol", age: "used1to3", origin: "fta" })).toBe(8660);
  });
  it("electric, 1–3yr: 0% duty, 120 BRV util → $6,602", () => {
    expect(BOT({ kind: "electric", age: "used1to3", origin: "certified" })).toBe(6602);
  });
  it("hybrid, certified, 1–3yr: 30% + $0/cc → $15,380", () => {
    expect(BOT({ kind: "hybrid", age: "used1to3", origin: "certified" })).toBe(15380);
  });
});

describe("motorcycle (HS 8711) — validated against @autodeklarantbot", () => {
  const M = (over: Partial<Parameters<typeof computeCustomsUz>[0]>) =>
    computeCustomsUz({ priceUsd: 5000, category: "moto", usdUzs: 12012.12, ...over } as Parameters<typeof computeCustomsUz>[0]);
  it("petrol certified: 20% duty, no util, 1-BRV fee → ~$1,754", () => {
    const r = M({ kind: "petrol", origin: "certified" });
    expect(r.lines.find((l) => l.key === "duty")!.detail).toBe("20%");
    expect(r.lines.find((l) => l.key === "util")).toBeUndefined(); // no utilization for motos
    expect(r.customsCostUsd).toBe(1754);
  });
  it("petrol no certificate: duty ×2 (40%) → ~$2,874", () => {
    expect(M({ kind: "petrol", origin: "uncertified" }).customsCostUsd).toBe(2874);
  });
  it("electric: 0% duty → ~$634", () => {
    expect(M({ kind: "electric", origin: "certified" }).customsCostUsd).toBe(634);
  });
});

describe("rate structure", () => {
  it("no certificate doubles the certified duty rate", () => {
    expect(dutyRate("petrol", "new", "uncertified")).toEqual({ pct: 30, perCc: 2 });
    expect(dutyRate("petrol", "used1to3", "uncertified")).toEqual({ pct: 60, perCc: 5 });
  });
  it("FTA origin and electric are duty-exempt", () => {
    expect(dutyRate("petrol", "used3plus", "fta")).toEqual({ pct: 0, perCc: 0 });
    expect(dutyRate("electric", "used1to3", "uncertified")).toEqual({ pct: 0, perCc: 0 });
  });
  it("hybrid keeps the percent but drops the per-cc term", () => {
    expect(dutyRate("hybrid", "used1to3", "certified")).toEqual({ pct: 30, perCc: 0 });
  });
  it("utilization is cc-tiered with a >3yr surcharge; EV flat", () => {
    expect(utilizationBrv("petrol", "new", 1999)).toBe(120);
    expect(utilizationBrv("petrol", "new", 2000)).toBe(180);
    expect(utilizationBrv("petrol", "used3plus", 2000)).toBe(330);
    expect(utilizationBrv("electric", "new", 0)).toBe(120);
  });
  it("resolveVehicleAge buckets by years", () => {
    expect(resolveVehicleAge(2026, 2026)).toBe("new");
    expect(resolveVehicleAge(2024, 2026)).toBe("used1to3");
    expect(resolveVehicleAge(2020, 2026)).toBe("used3plus");
  });
  it("resolveVehicleKind maps fuel strings", () => {
    expect(resolveVehicleKind("электро")).toBe("electric");
    expect(resolveVehicleKind("гибрид")).toBe("hybrid");
    expect(resolveVehicleKind("Бензин")).toBe("petrol");
  });
});
