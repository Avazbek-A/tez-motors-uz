import { describe, it, expect } from "vitest";
import { callLeadScore } from "../call-intel";

describe("callLeadScore", () => {
  it("is 0 for an empty transcript", () => {
    expect(callLeadScore("", 120)).toBe(0);
    expect(callLeadScore("   ", 120)).toBe(0);
  });

  it("scores high-intent phrases (RU/UZ/EN)", () => {
    expect(callLeadScore("Хочу купить, когда могу забрать? цена ок", 0)).toBeGreaterThan(20);
    expect(callLeadScore("men sotib olaman, to'lov qachon", 0)).toBeGreaterThan(0);
    expect(callLeadScore("I want to buy, what's the price and can I test drive", 0)).toBeGreaterThan(20);
  });

  it("adds a duration bonus for longer calls", () => {
    const short = callLeadScore("куплю", 0);
    const long = callLeadScore("куплю", 600);
    expect(long).toBeGreaterThan(short);
  });

  it("damps on negative phrases", () => {
    const positive = callLeadScore("куплю, цена", 0);
    const damped = callLeadScore("куплю, цена, но дорого и подумаю", 0);
    expect(damped).toBeLessThan(positive);
  });

  it("clamps to 0–100", () => {
    const huge = callLeadScore("куплю покупаю беру оплата депозит рассрочка кредит цена скидка бронирую тест-драйв наличие приеду", 3600);
    expect(huge).toBeLessThanOrEqual(100);
    expect(huge).toBeGreaterThanOrEqual(0);
    const veryNegative = callLeadScore("не интересно дорого подумаю", 0);
    expect(veryNegative).toBe(0);
  });
});
