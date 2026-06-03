import { describe, it, expect } from "vitest";
import { buildActions, operatorFallback, pctDelta, trendToken, type OperatorContext } from "../operator";

const base: OperatorContext = {
  actions: { newInquiries: 0, hotLeads: 0, tasksDue: 0, unpaidReservations: 0, overdueShipments: 0, warrantiesExpiring: 0 },
  money: { revenueMtdUsd: 50000, depositsUsd: 4000, committedSupplierUsd: 89400, potentialMarginUsd: 12000 },
  topMarkdowns: [],
  topDemand: [],
};

describe("buildActions", () => {
  it("returns nothing when the queue is empty", () => {
    expect(buildActions(base)).toEqual([]);
  });
  it("prioritizes hot leads and unpaid deposits above generic inquiries", () => {
    const ctx = { ...base, actions: { ...base.actions, newInquiries: 3, hotLeads: 2, unpaidReservations: 1 } };
    const actions = buildActions(ctx);
    expect(actions[0].text).toMatch(/hot AI lead/i);
    expect(actions[1].text).toMatch(/unpaid reservation/i);
    expect(actions[2].text).toMatch(/new inquir/i);
  });
  it("includes markdowns and demand suggestions (capped at 3 each)", () => {
    const ctx: OperatorContext = {
      ...base,
      topMarkdowns: Array.from({ length: 5 }, (_, i) => ({ carId: `car-${i}`, name: `Car ${i}`, daysOnLot: 60 + i, markdownPct: 10, suggestedPriceUsd: 20000, currentPriceUsd: 22000 })),
      topDemand: Array.from({ length: 5 }, (_, i) => ({ name: `Model ${i}`, inquiries: 9 - i })),
    };
    const actions = buildActions(ctx);
    expect(actions.filter((a) => /Mark down/.test(a.text))).toHaveLength(3);
    expect(actions.filter((a) => /High demand/.test(a.text))).toHaveLength(3);
  });
});

describe("operatorFallback", () => {
  it("always produces a briefing with the cash line", () => {
    const t = operatorFallback(base, "en");
    expect(t).toMatch(/Good morning/);
    expect(t).toMatch(/\$50,000 revenue MTD/);
    expect(t).toMatch(/Nothing urgent/);
  });
  it("lists numbered actions when the queue is non-empty (ru)", () => {
    const ctx = { ...base, actions: { ...base.actions, hotLeads: 1, newInquiries: 2 } };
    const t = operatorFallback(ctx, "ru");
    expect(t).toMatch(/Доброе утро/);
    expect(t).toMatch(/1\. /);
    expect(t).toMatch(/2\. /);
  });
  it("renders a week-over-week trend line when trends are present", () => {
    const ctx: OperatorContext = {
      ...base,
      trends: { leadsThisWeek: 5, leadsLastWeek: 4, revenueThisWeekUsd: 12000, revenueLastWeekUsd: 10000, ordersThisWeek: 2, ordersLastWeek: 0 },
    };
    const t = operatorFallback(ctx, "en");
    expect(t).toMatch(/This week/);
    expect(t).toMatch(/5 \(▲25%\) leads/);
    expect(t).toMatch(/2 \(new\) orders/);
  });
});

describe("pctDelta / trendToken", () => {
  it("computes percentage change and handles a zero baseline", () => {
    expect(pctDelta(120, 100)).toBe(20);
    expect(pctDelta(80, 100)).toBe(-20);
    expect(pctDelta(0, 0)).toBe(0);
    expect(pctDelta(5, 0)).toBeNull(); // new, no baseline
  });
  it("formats compact trend tokens with arrows", () => {
    expect(trendToken(5, 4)).toBe("5 (▲25%)");
    expect(trendToken(3, 6)).toBe("3 (▼50%)");
    expect(trendToken(4, 4)).toBe("4 (▬)");
    expect(trendToken(2, 0)).toBe("2 (new)");
  });
});
