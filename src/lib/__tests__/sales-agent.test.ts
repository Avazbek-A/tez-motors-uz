import { describe, it, expect } from "vitest";
import {
  extractSlots,
  detectPhone,
  detectName,
  detectIntent,
  mergeProfile,
  computeStage,
  scoreLead,
  composeNudge,
  profileSummary,
  type SalesProfile,
} from "../sales-agent";

describe("extractSlots", () => {
  it("pulls budget, body type, fuel and family seats", () => {
    const p = extractSlots("ищу электрический кроссовер до 30000 для семьи");
    expect(p.fuel).toBe("electric");
    expect(p.bodyType).toBe("suv");
    expect(p.budgetUsd).toBe(30000);
    expect(p.seats).toBe(7);
  });
  it("detects financing interest and timeline", () => {
    const p = extractSlots("хочу в рассрочку, нужно срочно");
    expect(p.financing).toBe(true);
    expect(p.timeline).toBe("now");
  });
  it("reads an explicit seat count", () => {
    expect(extractSlots("нужно 5 мест").seats).toBe(5);
  });
  it("sets nothing it isn't sure about", () => {
    expect(extractSlots("привет")).toEqual({});
  });
});

describe("detectPhone", () => {
  it("finds UZ phone numbers in free text", () => {
    expect(detectPhone("мой номер +998 90 123 45 67")).toBe("+998901234567");
    expect(detectPhone("звоните 901234567")).toBe("901234567");
  });
  it("does NOT treat budgets as phone numbers", () => {
    expect(detectPhone("до 25000")).toBeNull();
    expect(detectPhone("$500/mo")).toBeNull();
  });
});

describe("detectName", () => {
  it("extracts a name from common phrasings", () => {
    expect(detectName("меня зовут Алишер")).toBe("Алишер");
    expect(detectName("my name is John")).toBe("John");
    expect(detectName("mening ismim Sardor")).toBe("Sardor");
  });
  it("returns null when no name pattern", () => {
    expect(detectName("хочу машину")).toBeNull();
  });
});

describe("detectIntent", () => {
  it("flags buying intent as hot", () => {
    expect(detectIntent("хочу купить эту машину").hot).toBe(true);
    expect(detectIntent("can I reserve it?").hot).toBe(true);
  });
  it("flags a human request and marks wantsHuman", () => {
    const i = detectIntent("перезвоните мне, нужен менеджер");
    expect(i.hot).toBe(true);
    expect(i.wantsHuman).toBe(true);
  });
  it("is cold for a generic browse", () => {
    expect(detectIntent("какие есть кроссоверы?").hot).toBe(false);
  });
});

describe("mergeProfile", () => {
  it("accumulates slots across turns, new values winning", () => {
    const a: SalesProfile = { budgetUsd: 30000, bodyType: "suv" };
    const b: SalesProfile = { fuel: "electric", budgetUsd: 35000 };
    expect(mergeProfile(a, b)).toEqual({ budgetUsd: 35000, bodyType: "suv", fuel: "electric" });
  });
  it("handles a null previous profile", () => {
    expect(mergeProfile(null, { fuel: "hybrid" })).toEqual({ fuel: "hybrid" });
  });
});

describe("computeStage", () => {
  const cold = { hot: false, wantsHuman: false, reasons: [] };
  it("greets on the first empty-profile turn", () => {
    expect(computeStage({ profile: {}, messageCount: 0, intent: cold, hasPhone: false })).toBe("greeting");
  });
  it("moves to recommending once a slot is known", () => {
    expect(computeStage({ profile: { bodyType: "suv" }, messageCount: 1, intent: cold, hasPhone: false })).toBe("recommending");
  });
  it("closes on hot intent and hands off on phone or human request", () => {
    expect(computeStage({ profile: {}, messageCount: 2, intent: { hot: true, wantsHuman: false, reasons: [] }, hasPhone: false })).toBe("closing");
    expect(computeStage({ profile: {}, messageCount: 2, intent: cold, hasPhone: true })).toBe("handoff");
    expect(computeStage({ profile: {}, messageCount: 2, intent: { hot: true, wantsHuman: true, reasons: [] }, hasPhone: false })).toBe("handoff");
  });
});

describe("scoreLead", () => {
  it("scores a hot, contactable, well-qualified lead high", () => {
    const score = scoreLead({
      profile: { budgetUsd: 30000, bodyType: "suv", financing: true, timeline: "now" },
      intent: { hot: true, wantsHuman: true, reasons: [] },
      hasPhone: true,
      messageCount: 5,
    });
    expect(score).toBeGreaterThanOrEqual(90);
    expect(score).toBeLessThanOrEqual(100);
  });
  it("scores an anonymous one-liner low", () => {
    expect(scoreLead({ profile: {}, intent: { hot: false, wantsHuman: false, reasons: [] }, hasPhone: false, messageCount: 1 })).toBeLessThan(10);
  });
});

describe("composeNudge", () => {
  it("confirms once a phone is captured", () => {
    expect(composeNudge("ru", { stage: "handoff", profile: {}, hasPhone: true })).toMatch(/менеджер/i);
  });
  it("asks for a number while closing without contact", () => {
    expect(composeNudge("en", { stage: "closing", profile: {}, hasPhone: false })).toMatch(/number/i);
  });
  it("offers an installment calc when financing-minded", () => {
    expect(composeNudge("ru", { stage: "closing", profile: { financing: true }, hasPhone: false })).toMatch(/рассрочк|платёж/i);
  });
  it("stays quiet during greeting/qualifying", () => {
    expect(composeNudge("ru", { stage: "greeting", profile: {}, hasPhone: false })).toBeNull();
    expect(composeNudge("ru", { stage: "qualifying", profile: {}, hasPhone: false })).toBeNull();
  });
});

describe("profileSummary", () => {
  it("renders a compact one-liner", () => {
    expect(profileSummary({ budgetUsd: 30000, bodyType: "suv", financing: true })).toBe("≤$30,000 · suv · financing");
    expect(profileSummary({})).toBe("—");
  });
});
