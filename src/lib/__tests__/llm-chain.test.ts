import { describe, it, expect } from "vitest";
import { buildChainEntries } from "../llm-models";

const all = () => true;
const only = (...ps: string[]) => (p: string) => ps.includes(p);
const OR = ["openai/gpt-oss-20b:free", "nvidia/nemotron-3-nano-30b-a3b:free"];

describe("buildChainEntries (multi-provider failover)", () => {
  it("chat: groq first, then OpenRouter chain, then nvidia — privacy gate drops gemini/siliconflow", () => {
    const chain = buildChainEntries("chat", OR, all);
    const labels = chain.map((e) => `${e.provider}:${e.model}`);
    // Provider order is the contract here — model ids churn as free pools retire them.
    expect(chain[0].provider).toBe("groq");
    expect(labels[0]).toMatch(/^groq:.+/);
    expect(labels).toContain("openrouter:openai/gpt-oss-20b:free");
    expect(labels).toContain("nvidia:meta/llama-3.3-70b-instruct");
    // privacy gate: no data-training providers on the customer chat tier
    expect(chain.some((e) => e.provider === "gemini")).toBe(false);
    expect(chain.some((e) => e.provider === "siliconflow")).toBe(false);
  });

  it("reason: leads with the free no-train routers; gemini still allowed but demoted last", () => {
    const chain = buildChainEntries("reason", OR, all);
    // OpenRouter free models lead (preferred + no-train for PII-bearing call transcripts).
    expect(chain[0]).toEqual({ provider: "openrouter", model: "openai/gpt-oss-20b:free" });
    // gemini is still ALLOWED on the internal reason tier (privacy gate only blocks chat),
    // but ranked AFTER the no-train providers (groq) — last-resort.
    expect(chain.some((e) => e.provider === "gemini")).toBe(true);
    const groqIdx = chain.findIndex((e) => e.provider === "groq");
    const geminiIdx = chain.findIndex((e) => e.provider === "gemini");
    expect(groqIdx).toBeGreaterThanOrEqual(0);
    expect(geminiIdx).toBeGreaterThan(groqIdx);
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
