/**
 * Minimal, Workers-safe LLM wrapper (single fetch — no node-only deps).
 *
 * Supports TWO provider shapes, selected by env (no code change):
 *   - "anthropic" (default): Anthropic Messages API. Needs LLM_API_KEY.
 *   - "openai": any OpenAI-compatible /v1/chat/completions endpoint — including
 *     a FREE, LOCAL Ollama (`ollama serve` → http://localhost:11434/v1). No API
 *     key required for a local server; a key (Authorization: Bearer) is sent if
 *     one is set (for hosted OpenAI-compatible providers like Together/Groq).
 *
 * Choose with LLM_PROVIDER=openai|anthropic, or it's auto-detected from
 * LLM_API_URL (a chat/completions or :11434 URL ⇒ openai). Local Ollama is the
 * intended "free fast cheap" setup; it only works where the app runs on Node and
 * can reach the Ollama host (the self-hosted / local deployment — NOT a
 * Cloudflare Workers edge isolate, which can't reach localhost).
 *
 * Fail-open by design (mirrors telegram.ts / email.ts): if no provider is
 * configured, or the call fails for any reason, this returns `null` and the
 * caller degrades to a templated, retrieval-only reply. It must never 500.
 *
 * Anti-hallucination contract is unchanged: this helper NEVER selects cars or
 * invents prices — retrieval happens server-side; the model only writes prose
 * about a fixed inventory list it is handed.
 *
 *   LLM_PROVIDER  openai | anthropic  (optional; auto-detected from URL)
 *   LLM_API_KEY   required for anthropic / hosted openai; omit for local Ollama
 *   LLM_API_URL   default per provider (anthropic messages / ollama chat)
 *   LLM_MODEL     default per provider (claude-3-5-haiku-latest / qwen2.5:7b-instruct)
 */

export interface AssistantCarLite {
  brand: string;
  model: string;
  year: number;
  price_usd: number;
  monthly_usd: number;
  body_type: string;
  fuel_type: string;
}

export type LlmProvider = "anthropic" | "openai";
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OLLAMA_URL = "http://localhost:11434/v1/chat/completions";

const LOCALE_NAME: Record<string, string> = {
  ru: "Russian",
  uz: "Uzbek (Latin script)",
  en: "English",
};

function systemPrompt(locale: string): string {
  const lang = LOCALE_NAME[locale] || "Russian";
  return [
    "You are the sales assistant for Tez Motors, a company that imports Chinese cars into Uzbekistan.",
    `Reply in ${lang}. Keep it to 2-4 short sentences, warm and concrete, no markdown, no bullet lists.`,
    "You are given an INVENTORY as JSON: the ONLY cars that exist. Recommend ONLY from this list.",
    "NEVER invent a car, trim, spec, or price. NEVER quote a price or monthly figure that is not in the JSON.",
    "Reference at most 2-3 cars by 'brand model year'. If the inventory is empty, say nothing is in stock that matches and invite them to leave a phone number for help.",
    "Do not promise financing terms; if asked about installments, mention the shown 'from $X/mo' estimate and suggest contacting a manager.",
    "End by inviting the customer to leave their name and phone for a callback.",
  ].join(" ");
}

function userPrompt(userMessage: string, cars: AssistantCarLite[]): string {
  const inventory = JSON.stringify(cars);
  return [`Customer request: "${userMessage}"`, "", `INVENTORY (the only cars that exist): ${inventory}`].join("\n");
}

/** Resolve the provider from env (explicit LLM_PROVIDER, else auto-detect from URL). */
export function resolveProvider(env: Record<string, string | undefined> = process.env): LlmProvider {
  const p = (env.LLM_PROVIDER || "").trim().toLowerCase();
  if (p === "openai" || p === "ollama" || p === "openai-compatible") return "openai";
  if (p === "anthropic") return "anthropic";
  const url = env.LLM_API_URL || "";
  if (/chat\/completions|:11434|\/v1\/?$/.test(url)) return "openai";
  return "anthropic";
}

/** Normalize an OpenAI-compatible base URL to a full chat/completions endpoint. */
export function openaiChatUrl(base: string): string {
  const u = (base || OLLAMA_URL).replace(/\/$/, "");
  if (/chat\/completions$/.test(u)) return u;
  if (/\/v1$/.test(u)) return `${u}/chat/completions`;
  return `${u}/v1/chat/completions`;
}

/** Is any provider configured? Anthropic needs a key; openai needs a URL (key optional). */
export function llmConfigured(env: Record<string, string | undefined> = process.env): boolean {
  if (resolveProvider(env) === "openai") return !!(env.LLM_API_URL || env.LLM_API_KEY);
  return !!env.LLM_API_KEY;
}

/** Pure: build the HTTP request (url/headers/body) for a provider. Unit-tested. */
export function buildChatRequest(
  provider: LlmProvider,
  args: { system: string; messages: ChatMessage[]; maxTokens: number; apiKey?: string; url?: string; model?: string },
): { url: string; headers: Record<string, string>; body: string } {
  if (provider === "openai") {
    const model = args.model || "qwen2.5:7b-instruct";
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (args.apiKey) headers["authorization"] = `Bearer ${args.apiKey}`;
    return {
      url: openaiChatUrl(args.url || OLLAMA_URL),
      headers,
      body: JSON.stringify({
        model,
        max_tokens: args.maxTokens,
        temperature: 0.4,
        stream: false,
        messages: [{ role: "system", content: args.system }, ...args.messages],
      }),
    };
  }
  // anthropic
  return {
    url: args.url || ANTHROPIC_URL,
    headers: { "x-api-key": args.apiKey || "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: args.model || "claude-3-5-haiku-latest",
      max_tokens: args.maxTokens,
      system: args.system,
      messages: args.messages,
    }),
  };
}

/** Pure: extract the reply text from a provider's response JSON. Unit-tested. */
export function parseChatResponse(provider: LlmProvider, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  if (provider === "openai") {
    const choices = (data as { choices?: { message?: { content?: unknown } }[] }).choices;
    const content = choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.trim() : "";
    return text.length > 0 ? text : null;
  }
  const blocks = (data as { content?: { type?: string; text?: string }[] }).content || [];
  const text = blocks
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();
  return text.length > 0 ? text : null;
}

/** Internal: one fetch for either provider. Fail-open to null. */
async function callChat(args: { system: string; messages: ChatMessage[]; maxTokens: number }): Promise<string | null> {
  if (!llmConfigured()) return null;
  const provider = resolveProvider();
  const apiKey = process.env.LLM_API_KEY || "";
  const url = process.env.LLM_API_URL || (provider === "openai" ? OLLAMA_URL : ANTHROPIC_URL);
  const model = process.env.LLM_MODEL || undefined;

  const req = buildChatRequest(provider, { system: args.system, messages: args.messages, maxTokens: args.maxTokens, apiKey, url, model });
  try {
    const res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("LLM non-OK", provider, res.status, body.slice(0, 500));
      return null;
    }
    const data = await res.json();
    return parseChatResponse(provider, data);
  } catch (err) {
    console.error("LLM call failed", err);
    return null;
  }
}

/**
 * Generate a grounded natural-language recommendation. Returns the model's text,
 * or `null` when the LLM is unconfigured or the call fails (caller falls back to
 * a templated reply). Never throws.
 */
export async function generateAssistantReply(args: {
  locale: string;
  userMessage: string;
  cars: AssistantCarLite[];
  history?: ChatMessage[];
}): Promise<string | null> {
  return callChat({
    system: systemPrompt(args.locale),
    messages: [...(args.history ?? []), { role: "user", content: userPrompt(args.userMessage, args.cars) }],
    maxTokens: 400,
  });
}

/**
 * Generic single-shot completion (system + user → text). Returns null when the
 * LLM is unconfigured or the call fails, so callers fail open to a template.
 */
export async function llmText(args: { system: string; user: string; maxTokens?: number }): Promise<string | null> {
  return callChat({ system: args.system, messages: [{ role: "user", content: args.user }], maxTokens: args.maxTokens ?? 400 });
}
