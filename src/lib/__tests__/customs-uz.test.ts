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

describe("engine (HS 8407) — validated against the bot", () => {
  const E = (over: object) => computeCustomsUz({ priceUsd: 20000, category: "engine", usdUzs: 12012.12, kind: "petrol", ...over } as Parameters<typeof computeCustomsUz>[0]).customsCostUsd;
  it("new motor: 0% duty, no util → $2,486", () => { expect(E({ age: "new" })).toBe(2486); });
  it("used motor: 30% duty → $9,206", () => { expect(E({ age: "used3plus" })).toBe(9206); });
  it("engine has no utilization line", () => {
    expect(computeCustomsUz({ priceUsd: 20000, category: "engine", kind: "petrol", age: "new" }).lines.find((l) => l.key === "util")).toBeUndefined();
  });
});

describe("mini-truck ≤5t (HS 8704) — validated against the bot", () => {
  const TR = (over: object) => computeCustomsUz({ priceUsd: 20000, category: "truck", usdUzs: 12012.12, kind: "petrol", ...over } as Parameters<typeof computeCustomsUz>[0]).customsCostUsd;
  it("petrol certified ≤3y: 30% duty, 210-BRV util → $16,409", () => { expect(TR({ age: "used1to3", origin: "certified" })).toBe(16409); });
  it("petrol certified >3y: 300-BRV util → $19,496", () => { expect(TR({ age: "used3plus", origin: "certified" })).toBe(19496); });
  it("no certificate: 60% duty → $23,129", () => { expect(TR({ age: "used1to3", origin: "uncertified" })).toBe(23129); });
  it("electric: 0% duty, 120-BRV util → $6,602", () => { expect(TR({ age: "used1to3", origin: "certified", kind: "electric" })).toBe(6602); });
});

// The bot floors the sum-total; we round each line — so totals can differ by $1.
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1);

describe("bus (HS 8702) — validated against the bot (±$1 rounding)", () => {
  const B = (over: object) => computeCustomsUz({ priceUsd: 20000, category: "bus", usdUzs: 12012.12, kind: "petrol", capacity: "small", eco: "euro5plus", origin: "certified", ...over } as Parameters<typeof computeCustomsUz>[0]).customsCostUsd;
  it("10-59 ≤3y Euro-5: льгота → $6,601", () => near(B({ age: "new" }), 6601));
  it("10-59 ≤3y Euro-4: 30% → $13,321", () => near(B({ age: "new", eco: "euro4" }), 13321));
  it("10-59 ≤3y Euro-4 no-cert: 60% → $20,041", () => near(B({ age: "new", eco: "euro4", origin: "uncertified" }), 20041));
  it("10-59 >3y: 20%+$2/cc → $16,590", () => near(B({ age: "used3plus", engineCc: 2000 }), 16590));
  it("60+ ≤3y: duty + VAT льгота → $4,201", () => near(B({ age: "new", capacity: "large", eco: "euro4" }), 4201));
  it("electric >3y: 0% duty, 150 BRV util → $7,630", () => near(B({ age: "used3plus", kind: "electric" }), 7630));
});

describe("фура (HS 8701/8716) — validated against the bot (±$1 rounding)", () => {
  const F = (over: object) => computeCustomsUz({ priceUsd: 20000, category: "fura", usdUzs: 12012.12, kind: "diesel", engineCc: 10000, furaPart: "tractor", furaAge: "a1", eco: "euro5plus", ...over } as Parameters<typeof computeCustomsUz>[0]);
  it("tractor ≤3y Euro-5: льгота → $2,485", () => near(F({}).customsCostUsd, 2485));
  it("tractor ≤3y Euro-4: 5% + 670 BRV → $26,585", () => near(F({ eco: "euro4" }).customsCostUsd, 26585));
  it("tractor 3-5y Euro-4: 10% + 1360 BRV → $51,371", () => near(F({ furaAge: "a2", eco: "euro4" }).customsCostUsd, 51371));
  it("tractor 5-7y Euro-4: 15% → $52,491", () => near(F({ furaAge: "a3", eco: "euro4" }).customsCostUsd, 52491));
  it("tractor >7y: 70%+$3/cc + 1360 BRV → $98,411", () => near(F({ furaAge: "a4" }).customsCostUsd, 98411));
  it("semitrailer: льгота → $2,485", () => near(F({ furaPart: "semitrailer" }).customsCostUsd, 2485));
  it("below Euro-4 → banned", () => { expect(F({ eco: "below4" }).banned).toBe(true); });
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
