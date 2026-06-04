import { describe, it, expect } from "vitest";
import { bucketByAge, arAging, depositsHeldAsLiability, cashRunway, dealPnl, fxExposureScenarios } from "../finance-forecast";

const NOW = new Date("2026-06-01T00:00:00Z").getTime();
const daysAgo = (d: number) => NOW - d * 86_400_000;

describe("bucketByAge", () => {
  it("buckets by overdue age and totals", () => {
    const b = bucketByAge([
      { amountUsd: 100, refMs: daysAgo(5) },
      { amountUsd: 200, refMs: daysAgo(45) },
      { amountUsd: 300, refMs: daysAgo(75) },
      { amountUsd: 400, refMs: daysAgo(120) },
    ], NOW);
    expect(b).toEqual({ d0_30: 100, d30_60: 200, d60_90: 300, d90_plus: 400, total: 1000 });
  });
  it("ignores non-positive amounts", () => {
    expect(bucketByAge([{ amountUsd: 0, refMs: NOW }, { amountUsd: -5, refMs: NOW }], NOW).total).toBe(0);
  });
});

describe("arAging", () => {
  it("only ages unpaid (sent) invoices by due date", () => {
    const b = arAging([
      { total_usd: 1000, status: "sent", due_at: new Date(daysAgo(40)).toISOString(), issued_at: null },
      { total_usd: 5000, status: "paid", due_at: new Date(daysAgo(100)).toISOString(), issued_at: null },
    ], NOW);
    expect(b.d30_60).toBe(1000);
    expect(b.total).toBe(1000); // paid excluded
  });
});

describe("depositsHeldAsLiability", () => {
  it("sums deposits for undelivered paid orders only", () => {
    const deps = new Map([["a", 2000], ["b", 3000], ["c", 1000]]);
    const sum = depositsHeldAsLiability(
      [{ id: "a", status: "deposit_paid" }, { id: "b", status: "in_transit" }, { id: "c", status: "delivered" }],
      deps,
    );
    expect(sum).toBe(5000); // c (delivered) excluded
  });
});

describe("cashRunway", () => {
  it("computes months when burning, null when net-positive", () => {
    expect(cashRunway(30000, 5000, 15000).runwayMonths).toBe(3); // 30000 / 10000
    expect(cashRunway(30000, 20000, 15000).runwayMonths).toBeNull();
    expect(cashRunway(30000, 5000, 15000).netMonthlyUsd).toBe(-10000);
  });
});

describe("dealPnl", () => {
  it("computes margin and realized flag", () => {
    const d = dealPnl({ id: "1", reference_code: "TM-X", status: "delivered", amount_usd: 40000, car: "BYD Seal" }, 32000, 2000);
    expect(d.marginUsd).toBe(8000);
    expect(d.realized).toBe(true);
  });
  it("margin null when cost unknown", () => {
    expect(dealPnl({ id: "1", reference_code: "TM-X", status: "sourcing", amount_usd: 40000, car: "X" }, null, 0).marginUsd).toBeNull();
  });
});

describe("fxExposureScenarios", () => {
  it("values USD-at-risk at shifted rates", () => {
    const s = fxExposureScenarios(10000, 12600, [0, 5]);
    expect(s[0]).toEqual({ pct: 0, usdUzsAt: 12600, uzsValue: 126_000_000 });
    expect(s[1].usdUzsAt).toBe(13230);
  });
});
