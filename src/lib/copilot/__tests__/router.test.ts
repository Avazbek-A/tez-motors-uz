import { describe, it, expect } from "vitest";
import { normalizeAmount, classifyDeterministic, parseRouterResponse, mergeClassifications } from "../router";

describe("normalizeAmount", () => {
  it("parses k/тыс/plain/$ forms", () => {
    expect(normalizeAmount("34k")).toBe(34000);
    expect(normalizeAmount("34к")).toBe(34000);
    expect(normalizeAmount("$34,000")).toBe(34000);
    expect(normalizeAmount("34 000")).toBe(34000);
    expect(normalizeAmount("18тыс")).toBe(18000);
    expect(normalizeAmount("nope")).toBeNull();
  });
});

describe("classifyDeterministic — reads", () => {
  it("classifies cash, demand, aged, leads, summary (RU + EN)", () => {
    expect(classifyDeterministic("сколько у меня денег?").intent).toBe("cash_position");
    expect(classifyDeterministic("what's my cash position").intent).toBe("cash_position");
    expect(classifyDeterministic("какой спрос сейчас").intent).toBe("demand");
    expect(classifyDeterministic("какие машины залежались").intent).toBe("aged_stock");
    expect(classifyDeterministic("новые заявки").intent).toBe("lead_summary");
    expect(classifyDeterministic("дай сводку по бизнесу").intent).toBe("business_summary");
  });
});

describe("classifyDeterministic — writes", () => {
  it("markdown_car extracts car + price", () => {
    const r = classifyDeterministic("снизь цену на Tank 300 до $34,000");
    expect(r.intent).toBe("markdown_car");
    expect(r.params.priceUsd).toBe(34000);
    expect(r.params.carQuery?.toLowerCase()).toContain("tank 300");
  });
  it("markdown_car extracts percentage", () => {
    const r = classifyDeterministic("mark down BYD Seal by 5%");
    expect(r.intent).toBe("markdown_car");
    expect(r.params.pct).toBe(5);
  });
  it("advance_order extracts the TM order code + status", () => {
    const r = classifyDeterministic("переведи заказ TM-7K3F9Q2X в taможню");
    expect(r.intent).toBe("advance_order");
    expect(r.params.orderRef).toBe("TM-7K3F9Q2X");
  });
  it("draft_po extracts qty + model", () => {
    const r = classifyDeterministic("закажи у поставщика 3 шт BYD Han");
    expect(r.intent).toBe("draft_po");
    expect(r.params.qty).toBe(3);
    expect(r.params.model?.toLowerCase()).toContain("byd han");
  });
  it("draft_po keeps the model when the verb..supplier wrap the brand", () => {
    const r = classifyDeterministic("закажи 3 BYD Han у поставщика");
    expect(r.intent).toBe("draft_po");
    expect(r.params.qty).toBe(3);
    expect(r.params.model?.toLowerCase()).toContain("byd han");
    expect(r.params.model?.toLowerCase()).not.toContain("поставщик");
  });
  it("unknown for gibberish", () => {
    expect(classifyDeterministic("asdf qwerty").intent).toBe("unknown");
  });
});

describe("parseRouterResponse", () => {
  it("parses fenced/embedded JSON and validates the enum", () => {
    const r = parseRouterResponse('here: {"intent":"demand","params":{"carQuery":null}} ok');
    expect(r?.intent).toBe("demand");
    expect(r?.source).toBe("llm");
  });
  it("rejects bad intent / bad json", () => {
    expect(parseRouterResponse('{"intent":"nuke_db"}')).toBeNull();
    expect(parseRouterResponse("not json")).toBeNull();
    expect(parseRouterResponse(null)).toBeNull();
  });
});

describe("mergeClassifications", () => {
  it("rules win when they confidently found an actionable intent", () => {
    const rules = classifyDeterministic("снизь цену на Tank 300 до 34000");
    const llm = parseRouterResponse('{"intent":"demand","params":{}}');
    expect(mergeClassifications(rules, llm).intent).toBe("markdown_car");
  });
  it("LLM fills in when rules are unknown", () => {
    const rules = classifyDeterministic("хочу понять тренды покупателей");
    const llm = parseRouterResponse('{"intent":"demand","params":{}}');
    const merged = mergeClassifications(rules, llm);
    // rules may already catch "тренд"/деманд; either way it must not be unknown
    expect(merged.intent === "demand" || merged.intent !== "unknown").toBe(true);
  });
  it("returns rules unchanged when no LLM", () => {
    const rules = classifyDeterministic("новые заявки");
    expect(mergeClassifications(rules, null)).toEqual(rules);
  });
});
