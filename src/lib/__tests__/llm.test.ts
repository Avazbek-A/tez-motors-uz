import { describe, it, expect } from "vitest";
import {
  resolveProvider,
  openaiChatUrl,
  llmConfigured,
  buildChatRequest,
  parseChatResponse,
  buildVisionMessages,
  stripReasoningPreamble,
  looksLikeReasoningLeak,
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
    const r = buildChatRequest("anthropic", { ...base, apiKey: "sk-ant", model: "claude-haiku-4-5" });
    expect(r.url).toBe("https://api.anthropic.com/v1/messages");
    expect(r.headers["x-api-key"]).toBe("sk-ant");
    expect(r.headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(r.body);
    expect(body.system).toBe("SYS");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("defaults the Anthropic model to a current hosted Haiku (not a stale one)", () => {
    const r = buildChatRequest("anthropic", { ...base, apiKey: "sk-ant" });
    const body = JSON.parse(r.body);
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.model).not.toMatch(/claude-3/); // never regress to the old gen
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

describe("stripReasoningPreamble", () => {
  it("removes a closed think block and keeps the answer", () => {
    expect(stripReasoningPreamble("<think>the buyer wants a price</think>\nЗдравствуйте! Цена $23,500.")).toBe(
      "Здравствуйте! Цена $23,500.",
    );
  });

  it("removes several stacked blocks", () => {
    expect(stripReasoningPreamble("<think>a</think><thinking>b</thinking>Answer")).toBe("Answer");
  });

  it("drops an unterminated opening tag", () => {
    expect(stripReasoningPreamble("<think>\nstill thinking about it")).toBe("still thinking about it");
  });

  it("keeps the monologue rather than returning nothing when there is no answer after it", () => {
    expect(stripReasoningPreamble("<think>only thoughts</think>")).toBe("<think>only thoughts</think>");
  });

  it("leaves a normal answer untouched, including one that talks about thinking", () => {
    const answer = "I was thinking about the Tank 500 — it lands in 6-8 weeks.";
    expect(stripReasoningPreamble(answer)).toBe(answer);
  });

  it("strips the block before JSON so the payload still parses", () => {
    const out = stripReasoningPreamble('<think>need json</think>{"ok":true}');
    expect(() => JSON.parse(out)).not.toThrow();
  });
});

describe("looksLikeReasoningLeak", () => {
  it("catches the leak that actually reached a customer", () => {
    // Live probe of POST /api/inquiry came back with this as the auto-reply.
    const leak = "Here's a thinking process:\n\n1.  **Analyze User Input:**\n   - **Role:** Customer-service assistant for Tez Motors\n   - **Language:** ONLY Russian";
    expect(looksLikeReasoningLeak(leak)).toBe(true);
  });

  it("catches other openings a reply would never start with", () => {
    for (const s of [
      "Okay, let me think about what the buyer needs here.",
      "We need to respond in Russian with a short message.",
      "The user is asking about the Tank 500 price.",
      "**Analyze the request** before answering",
    ]) {
      expect(looksLikeReasoningLeak(s)).toBe(true);
    }
  });

  it("passes a real customer reply through", () => {
    for (const s of [
      "Здравствуйте! Tank 500 под ключ — от $52 000, срок 6–8 недель. Менеджер свяжется с вами.",
      "Hello! The Tank 500 lands at about $52,000 all-in. We'll call you shortly.",
      "Спасибо за обращение! Мы уточним наличие и вернёмся с ответом сегодня.",
    ]) {
      expect(looksLikeReasoningLeak(s)).toBe(false);
    }
  });

  it("makes parseChatResponse drop a leaking answer so the caller fails over", () => {
    const leaked = { choices: [{ message: { content: "Here's a thinking process:\n1. **Role:** assistant" } }] };
    expect(parseChatResponse("openai", leaked)).toBeNull();
  });
});

describe("looksLikeReasoningLeak — prompt recital", () => {
  it("catches the second live leak: the model reciting our instructions", () => {
    const leak = "We need to answer in Russian, 2-3 warm concrete sentences, no markdown, no bullet lists, no greeting line. Must not invent price, spec, delivery time.";
    expect(looksLikeReasoningLeak(leak)).toBe(true);
  });

  it("does not trip on a buyer reply that happens to mention a language", () => {
    expect(looksLikeReasoningLeak("Отвечаем на русском и английском — как вам удобнее?")).toBe(false);
  });
});

describe("buildChatRequest — Groq reasoning_format", () => {
  it("asks Groq to hide the thinking so content is not empty", () => {
    const req = buildChatRequest("openai", {
      system: "s", messages: [{ role: "user", content: "hi" }], maxTokens: 100,
      apiKey: "k", url: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b",
    });
    expect(JSON.parse(req.body).reasoning_format).toBe("hidden");
  });

  it("does not send the Groq-only field to other providers", () => {
    const req = buildChatRequest("openai", {
      system: "s", messages: [{ role: "user", content: "hi" }], maxTokens: 100,
      apiKey: "k", url: "https://openrouter.ai/api/v1", model: "google/gemma-4-31b-it:free",
    });
    expect(JSON.parse(req.body).reasoning_format).toBeUndefined();
  });
});
