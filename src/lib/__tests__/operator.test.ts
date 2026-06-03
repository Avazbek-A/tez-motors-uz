import { describe, it, expect } from "vitest";
import { buildActions, operatorFallback, type OperatorContext } from "../operator";

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
});
