import { describe, it, expect } from "vitest";
import {
  resolveProvider,
  openaiChatUrl,
  llmConfigured,
  buildChatRequest,
  parseChatResponse,
  buildVisionMessages,
} from "../llm";

describe("resolveProvider", () => {
  it("honors an explicit LLM_PROVIDER", () => {
    expect(resolveProvider({ LLM_PROVIDER: "openai" })).toBe("openai");
    expect(resolveProvider({ LLM_PROVIDER: "ollama" })).toBe("openai");
    expect(resolveProvider({ LLM_PROVIDER: "anthropic" })).toBe("anthropic");
  });
  it("auto-detects openai from a chat/completions or ollama URL", () => {
    expect(resolveProvider({ LLM_API_URL: "http://localhost:11434/v1" })).toBe("openai");
    expect(resolveProvider({ LLM_API_URL: "https://api.groq.com/openai/v1/chat/completions" })).toBe("openai");
    expect(resolveProvider({ LLM_API_URL: "https://api.anthropic.com/v1/messages" })).toBe("anthropic");
    expect(resolveProvider({})).toBe("anthropic");
  });
});

describe("openaiChatUrl", () => {
  it("normalizes bases to a full chat/completions endpoint", () => {
    expect(openaiChatUrl("http://localhost:11434/v1")).toBe("http://localhost:11434/v1/chat/completions");
    expect(openaiChatUrl("http://localhost:11434/v1/chat/completions")).toBe("http://localhost:11434/v1/chat/completions");
    expect(openaiChatUrl("http://localhost:11434")).toBe("http://localhost:11434/v1/chat/completions");
    expect(openaiChatUrl("http://localhost:11434/v1/")).toBe("http://localhost:11434/v1/chat/completions");
  });
});

describe("llmConfigured", () => {
  it("openai is enabled by a URL alone (local Ollama needs no key)", () => {
    expect(llmConfigured({ LLM_PROVIDER: "openai", LLM_API_URL: "http://localhost:11434/v1" })).toBe(true);
    expect(llmConfigured({ LLM_PROVIDER: "openai" })).toBe(false);
  });
  it("anthropic requires a key", () => {
    expect(llmConfigured({ LLM_API_KEY: "sk-x" })).toBe(true);
    expect(llmConfigured({})).toBe(false);
  });
});

describe("buildChatRequest", () => {
  const base = { system: "SYS", messages: [{ role: "user" as const, content: "hi" }], maxTokens: 200 };

  it("builds an OpenAI-compatible request (system folded into messages, Bearer when keyed)", () => {
    const noKey = buildChatRequest("openai", { ...base, url: "http://localhost:11434/v1", model: "qwen2.5:7b-instruct" });
    expect(noKey.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(noKey.headers["authorization"]).toBeUndefined();
    const body = JSON.parse(noKey.body);
    expect(body.model).toBe("qwen2.5:7b-instruct");
    expect(body.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    expect(body.stream).toBe(false);

    const keyed = buildChatRequest("openai", { ...base, url: "https://api.groq.com/openai/v1", apiKey: "gsk_x" });
    expect(keyed.headers["authorization"]).toBe("Bearer gsk_x");
  });

  it("builds an Anthropic request (separate system, x-api-key header)", () => {
    const r = buildChatRequest("anthropic", { ...base, apiKey: "sk-ant", model: "claude-3-5-haiku-latest" });
    expect(r.url).toBe("https://api.anthropic.com/v1/messages");
    expect(r.headers["x-api-key"]).toBe("sk-ant");
    expect(r.headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(r.body);
    expect(body.system).toBe("SYS");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });
});

describe("buildVisionMessages", () => {
  it("builds OpenAI multimodal content (text + image parts, capped at 8)", () => {
    const imgs = Array.from({ length: 10 }, (_, i) => `data:image/png;base64,IMG${i}`);
    const msgs = buildVisionMessages("SYS", "read this", imgs);
    expect(msgs[0]).toEqual({ role: "system", content: "SYS" });
    const content = msgs[1].content as { type: string; text?: string; image_url?: { url: string } }[];
    expect(content[0]).toEqual({ type: "text", text: "read this" });
    expect(content.filter((c) => c.type === "image_url")).toHaveLength(8); // capped
    expect(content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,IMG0" } });
  });
  it("drops unsafe URL schemes (file://, javascript:, gopher:) — defense in depth", () => {
    const imgs = [
      "https://ok.example/a.png",
      "data:image/jpeg;base64,xyz",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "gopher://x/",
      "http://ok.example/b.webp",
    ];
    const content = buildVisionMessages("S", "U", imgs)[1].content as { type: string; image_url?: { url: string } }[];
    const urls = content.filter((c) => c.type === "image_url").map((c) => c.image_url!.url);
    expect(urls).toEqual(["https://ok.example/a.png", "data:image/jpeg;base64,xyz", "http://ok.example/b.webp"]);
  });
});

describe("parseChatResponse", () => {
  it("parses OpenAI choices[].message.content", () => {
    expect(parseChatResponse("openai", { choices: [{ message: { content: "  hello  " } }] })).toBe("hello");
    expect(parseChatResponse("openai", { choices: [] })).toBeNull();
    expect(parseChatResponse("openai", {})).toBeNull();
  });
  it("parses Anthropic content[].text blocks", () => {
    expect(parseChatResponse("anthropic", { content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] })).toBe("a\nb");
    expect(parseChatResponse("anthropic", { content: [] })).toBeNull();
    expect(parseChatResponse("anthropic", null)).toBeNull();
  });
});
