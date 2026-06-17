import { describe, it, expect } from "vitest";
import { buildChainEntries } from "../llm-models";

const all = () => true;
const only = (...ps: string[]) => (p: string) => ps.includes(p);
const OR = ["openai/gpt-oss-20b:free", "nvidia/nemotron-3-nano-30b-a3b:free"];

describe("buildChainEntries (multi-provider failover)", () => {
  it("chat: groq first, then OpenRouter chain, then nvidia — privacy gate drops gemini/siliconflow", () => {
    const chain = buildChainEntries("chat", OR, all);
    const labels = chain.map((e) => `${e.provider}:${e.model}`);
    expect(labels[0]).toBe("groq:llama-3.3-70b-versatile");
    expect(labels).toContain("openrouter:openai/gpt-oss-20b:free");
    expect(labels).toContain("nvidia:meta/llama-3.3-70b-instruct");
    // privacy gate: no data-training providers on the customer chat tier
    expect(chain.some((e) => e.provider === "gemini")).toBe(false);
    expect(chain.some((e) => e.provider === "siliconflow")).toBe(false);
  });

  it("reason: gemini allowed (internal, non-PII) and ranked first", () => {
    const chain = buildChainEntries("reason", OR, all);
    expect(chain[0]).toEqual({ provider: "gemini", model: "gemini-2.5-flash" });
    expect(chain.some((e) => e.provider === "siliconflow")).toBe(true);
  });

  it("vision: only image-capable providers (gemini, openrouter, nvidia)", () => {
    const chain = buildChainEntries("vision", OR, all);
    const providers = new Set(chain.map((e) => e.provider));
    expect(providers.has("gemini")).toBe(true);
    expect(providers.has("groq")).toBe(false); // groq has no vision model mapped
  });

  it("is inert for providers without a key (only OpenRouter present → OpenRouter-only)", () => {
    const chain = buildChainEntries("chat", OR, only("openrouter"));
    expect(chain.every((e) => e.provider === "openrouter")).toBe(true);
    expect(chain).toHaveLength(OR.length);
  });

  it("dedups repeated OpenRouter ids", () => {
    const chain = buildChainEntries("chat", ["x:free", "x:free"], only("openrouter"));
    expect(chain).toHaveLength(1);
  });
});
