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
 *   LLM_MODEL     default per provider (claude-haiku-4-5 / qwen2.5:7b-instruct)
 *
 * MODELS: per-tier (chat / reason / vision), resolved at runtime from
 * site_settings('llm_models') via llm-models.ts (so the weekly auto-refresh job can
 * swap free models live). Each tier has a primary + fallback — the cloud-only
 * fallback chain runs entirely on OpenRouter's GPUs (nothing on local hardware, so
 * the Vostro never heats up). Local Ollama remains only a dev/offline option.
 */
import { getTierModels, tierChain, isFreeModel, resolveTierChain, PROVIDERS, type LlmTier } from "@/lib/llm-models";
import { alertDealer } from "@/lib/error-report";
import { recordLlmCall, type LlmFailure } from "@/lib/llm-telemetry";

/** Classify a thrown fetch error as a timeout vs a generic error (for telemetry). */
function failReason(err: unknown): "timeout" | "error" {
  const name = err instanceof Error ? err.name : "";
  return name === "TimeoutError" || name === "AbortError" ? "timeout" : "error";
}

export interface AssistantCarLite {
  brand: string;
  model: string;
  year: number;
  price_usd: number;
  monthly_usd: number;
  body_type: string;
  fuel_type: string;
  // Categorization (from categorizeCar) — lets the model match real client needs.
  segment?: string; // budget | mid-range | premium | luxury
  size_class?: string | null; // compact | midsize | large | full-size
  seats?: number | null;
  range_km?: number | null; // electric range (EV/PHEV)
  horsepower?: number | null;
  zero_to_100_s?: number | null;
  drive?: string | null; // AWD | RWD | FWD
  use_cases?: string[]; // family, big-family, city, business, off-road, performance, long-range, long-distance, budget, first-car, eco, cargo, prestige
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
    `Write your ENTIRE reply in ${lang}, and ONLY ${lang}. Even if earlier messages in this conversation were in a different language, do NOT switch languages — answer the latest message in ${lang}. Keep it to 2-4 short sentences, warm and concrete, no markdown, no bullet lists.`,
    "You are given an INVENTORY as JSON: the ONLY cars that exist. Recommend ONLY from this list.",
    "NEVER invent a car, trim, spec, or price. NEVER quote a price or monthly figure that is not in the JSON.",
    // Each car carries categorization fields — USE them to match the client's real need:
    "Each car has: segment (budget/mid-range/premium/luxury), size_class, seats, fuel_type, range_km (electric range), horsepower, zero_to_100_s, drive (AWD/RWD/FWD), and use_cases tags.",
    "Match intent to use_cases/fields: family/kids → seats>=5 & 'family' (7 seats → 'big-family'); city/commute → 'city' or compact; business/status → 'business'/'prestige'; rough roads/winter → 'off-road' or AWD; wants speed/power → 'performance' (low zero_to_100_s, high horsepower); long trips → 'long-range' (big range_km) or 'long-distance'; saving money → 'budget'; eco/electric → 'eco'/fuel_type electric; lots of luggage → 'cargo' / high seats. Pick the BEST FIT, not just the cheapest, and say WHY it fits in one phrase.",
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

/** Is any provider configured? A failover-provider key (OpenRouter/Groq/NVIDIA/
 *  Gemini/SiliconFlow), or the legacy single endpoint (anthropic key / openai URL). */
export function llmConfigured(env: Record<string, string | undefined> = process.env): boolean {
  for (const p of Object.values(PROVIDERS)) if ((env[p.keyEnv] || "").trim()) return true;
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
    const url = openaiChatUrl(args.url || OLLAMA_URL);
    const body: Record<string, unknown> = {
      model,
      max_tokens: args.maxTokens,
      temperature: 0.4,
      stream: false,
      messages: [{ role: "system", content: args.system }, ...args.messages],
    };
    // Groq's gpt-oss models put their whole answer in the separate `reasoning`
    // field and return an EMPTY `content` unless told where to leave the
    // thinking. This client reads `content` only, so without this the model
    // looks like a miss on every call and the chain wastes the hop. Hidden
    // thinking still bills against max_tokens, which truncated replies
    // mid-sentence ("Спасибо за ваш интерес к BYD") — "low" effort leaves the
    // budget to the answer.
    if (/api\.groq\.com/i.test(url)) {
      body.reasoning_format = "hidden";
      body.reasoning_effort = "low";
    }
    return { url, headers, body: JSON.stringify(body) };
  }
  // anthropic
  return {
    url: args.url || ANTHROPIC_URL,
    headers: { "x-api-key": args.apiKey || "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: args.model || "claude-haiku-4-5",
      max_tokens: args.maxTokens,
      system: args.system,
      messages: args.messages,
    }),
  };
}

/** Pure: extract the reply text from a provider's response JSON. Unit-tested. */
/**
 * Strip a model's inner monologue from the answer.
 *
 * The free pools are now mostly reasoning-tuned models, and several of them
 * narrate before answering — "<think>…</think>", "Here's a thinking process:",
 * "We need to respond exactly with JSON …". `content` is what we hand to a
 * customer (or parse as JSON), so the monologue has to come off first: a buyer
 * asking about a car should never be read the model's notes about answering
 * them. Only a leading block is removed, and only when real text follows, so a
 * legitimate answer that merely mentions thinking survives intact.
 */
export function stripReasoningPreamble(text: string): string {
  let out = text.trim();

  // Closed <think>…</think> / <thinking>…</thinking> blocks at the start.
  for (;;) {
    const m = out.match(/^<(think|thinking|reasoning)>[\s\S]*?<\/\1>/i);
    if (!m) break;
    const rest = out.slice(m[0].length).trim();
    if (!rest) break; // monologue was the whole answer — keep it over returning nothing
    out = rest;
  }

  // An unterminated block (model hit the token cap mid-thought): drop the opening
  // tag only. Skipped when a closing tag survives, which means the loop above
  // deliberately kept a monologue-only answer rather than return nothing.
  if (!/<\/(think|thinking|reasoning)>/i.test(out)) {
    out = out.replace(/^<(think|thinking|reasoning)>\s*/i, "").trim();
  }

  return out;
}

/**
 * Does this answer look like the model thinking out loud instead of replying?
 *
 * Tag-stripping is not enough: a probe against the live chain came back with
 * "Here's a thinking process:\n\n1. **Analyze User Input:** - **Role:**
 * Customer-service assistant for Tez Motors …" — the model's notes about the
 * system prompt, no <think> tags anywhere, sent verbatim to a customer as the
 * auto-reply to their inquiry. A leak is treated like an empty response: the
 * caller moves to the next model, and the deterministic template is the floor.
 *
 * Deliberately narrow — these phrases are ones a customer reply would not open
 * with, and only the opening of the message is examined.
 */
export function looksLikeReasoningLeak(text: string): boolean {
  const head = text.trim().slice(0, 400);
  if (!head) return false;
  const tells = [
    /^here'?s (a|my) (thinking|thought) process/i,
    /^(okay|ok|alright|so),? (let me|i (need|should|will)|we need)/i,
    /^(let me|i need to|i should|we need to|i'?ll) (think|analyze|consider|start|break)/i,
    /^\s*\*\*(analyze|analysis|understand|plan|step 1)/i,
    /^the user (is asking|wants|asks)/i,
    // "We need to answer in Russian, 2-3 warm concrete sentences, no markdown…"
    // — a second live leak, this one reciting the prompt instead of narrating.
    /^(we|i) (need to|have to|should|must|will) (respond|answer|reply|write|produce|output)/i,
  ];
  if (tells.some((re) => re.test(head))) return true;

  // A reply that quotes the system prompt back at us (role/language/length
  // instructions) is the model narrating its brief, not answering the buyer.
  const brief = /\*\*(role|language|length|task|instructions?|constraints?)\s*:?\*\*/gi;
  if ((head.match(brief) || []).length >= 2) return true;

  // Same idea without the markdown: the plain-prose recital of our own rules.
  // A real answer to a car buyer does not talk about markdown or invented specs.
  const rules = /\b(must not invent|must say|do not invent|no markdown|no bullet|bullet lists?|\d\s*-\s*\d (warm |short )?sentences|answer in (russian|uzbek|english))\b/gi;
  return (head.match(rules) || []).length >= 2;
}

export function parseChatResponse(provider: LlmProvider, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  if (provider === "openai") {
    const choices = (data as { choices?: { message?: { content?: unknown } }[] }).choices;
    const content = choices?.[0]?.message?.content;
    const text = typeof content === "string" ? stripReasoningPreamble(content) : "";
    if (text.length === 0 || looksLikeReasoningLeak(text)) return null;
    return text;
  }
  const blocks = (data as { content?: { type?: string; text?: string }[] }).content || [];
  const text = stripReasoningPreamble(blocks
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n"));
  if (text.length === 0 || looksLikeReasoningLeak(text)) return null;
  return text;
}

// Per-tier request timeout. The reason tier may run a 550B reasoner (~25s+), so it
// gets a long budget; chat must stay snappy. A timeout drops to the tier fallback.
const TIER_TIMEOUT_MS: Record<LlmTier, number> = { chat: 30000, reason: 90000, vision: 60000 };

/**
 * Internal: run a chat completion for the given tier, failing over ACROSS
 * providers (resolveTierChain → [{provider, model, url, key}]). On a non-OK
 * status, timeout, empty content, or thrown error it tries the next entry, then
 * returns null (caller → template). Every entry is OpenAI-shaped. When no
 * failover-provider key is set (pure local-Ollama / anthropic dev), it delegates
 * to legacyCallChat (the single-endpoint path). Fail-open to null; reads
 * `content` only — a reasoning model's separate `reasoning` field is ignored.
 */
async function callChat(args: { system: string; messages: ChatMessage[]; maxTokens: number; tier: LlmTier }): Promise<string | null> {
  if (!llmConfigured()) return null;
  const chain = await resolveTierChain(args.tier);
  if (chain.length === 0) return legacyCallChat(args); // Ollama / anthropic dev path
  const timeout = TIER_TIMEOUT_MS[args.tier];
  const started = Date.now();
  const failures: LlmFailure[] = [];
  let attempts = 0;

  for (const m of chain) {
    attempts += 1;
    const req = buildChatRequest("openai", { system: args.system, messages: args.messages, maxTokens: args.maxTokens, apiKey: m.key, url: m.url, model: m.model });
    if (m.provider === "openrouter") {
      req.headers["HTTP-Referer"] = "https://tezmotors.uz";
      req.headers["X-Title"] = "Tez Motors";
    }
    try {
      const res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: AbortSignal.timeout(timeout) });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("LLM non-OK", m.provider, m.model, res.status, body.slice(0, 200));
        failures.push({ model: m.model, provider: m.provider, reason: "non_ok", status: res.status });
        continue;
      }
      const text = parseChatResponse("openai", await res.json());
      if (text) {
        void recordLlmCall({ tier: args.tier, provider: m.provider, answeredModel: m.model, attempts, failures, latencyMs: Date.now() - started });
        return text;
      }
      console.error("LLM empty content", m.provider, m.model);
      failures.push({ model: m.model, provider: m.provider, reason: "empty" });
    } catch (err) {
      console.error("LLM call failed", m.provider, m.model, err instanceof Error ? err.message : err);
      failures.push({ model: m.model, provider: m.provider, reason: failReason(err) });
    }
  }
  // Whole cross-provider chain failed → record it (answeredModel=null → the
  // dashboard shows template fallbacks) and alert the owner.
  if (attempts > 0) {
    void recordLlmCall({ tier: args.tier, provider: null, answeredModel: null, attempts, failures, latencyMs: Date.now() - started });
  }
  void alertDealer("FREE LLM models unavailable (all providers)", [`tier=${args.tier}`, `tried: ${chain.map((c) => `${c.provider}:${c.model}`).join(", ")}`, "AI replies are falling back to the deterministic template. Check provider free-tier status / rate limits."], { key: "llm-free-down" });
  return null;
}

/**
 * Legacy single-endpoint path (local Ollama / hosted anthropic) — used only when
 * NO failover-provider key is configured. Walks the OpenRouter-style tier chain
 * against one endpoint. Preserved verbatim for dev/offline use.
 */
async function legacyCallChat(args: { system: string; messages: ChatMessage[]; maxTokens: number; tier: LlmTier }): Promise<string | null> {
  const provider = resolveProvider();
  const apiKey = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || "";
  const url = process.env.LLM_API_URL || (provider === "openai" ? OLLAMA_URL : ANTHROPIC_URL);
  const onOpenRouter = /openrouter\.ai/i.test(url);
  const legacyProvider = onOpenRouter ? "openrouter" : provider === "anthropic" ? "anthropic" : "ollama";
  const all = tierChain(args.tier, await getTierModels());
  // PAID GUARD: on OpenRouter, only EVER call free (:free) models — the account has
  // credit, so a paid id would be billed. A misconfigured non-free model is skipped
  // (never charged) and the owner is alerted. (Local Ollama / other has no billing.)
  const models = onOpenRouter ? all.filter(isFreeModel) : all.filter(Boolean);
  if (onOpenRouter && all.some((m) => m && !isFreeModel(m))) {
    void alertDealer("LLM paid-guard: skipped a NON-free model", [`tier=${args.tier}`, `not free: ${all.filter((m) => m && !isFreeModel(m)).join(", ")}`, "Only :free ids are called. Fix site_settings('llm_models')."], { key: "llm-nonfree" });
  }
  const timeout = TIER_TIMEOUT_MS[args.tier];

  // Telemetry: track every model tried + why it failed, so the dashboard can
  // show how often a call had to switch off its primary (free models rotate).
  const started = Date.now();
  const failures: LlmFailure[] = [];
  let attempts = 0;

  for (const model of models) {
    if (!model) continue;
    attempts += 1;
    const req = buildChatRequest(provider, { system: args.system, messages: args.messages, maxTokens: args.maxTokens, apiKey, url, model });
    if (onOpenRouter) {
      req.headers["HTTP-Referer"] = "https://tezmotors.uz";
      req.headers["X-Title"] = "Tez Motors";
    }
    try {
      const res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: AbortSignal.timeout(timeout) });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("LLM non-OK", provider, model, res.status, body.slice(0, 300));
        failures.push({ model, reason: "non_ok", status: res.status });
        continue; // try the tier fallback
      }
      const text = parseChatResponse(provider, await res.json());
      if (text) {
        void recordLlmCall({ tier: args.tier, provider: legacyProvider, answeredModel: model, attempts, failures, latencyMs: Date.now() - started });
        return text;
      }
      console.error("LLM empty content", model);
      failures.push({ model, reason: "empty" });
    } catch (err) {
      console.error("LLM call failed", model, err instanceof Error ? err.message : err);
      failures.push({ model, reason: failReason(err) });
    }
  }
  // Whole chain failed → record it (answeredModel=null) so the dashboard shows
  // template fallbacks, then alert the owner the free models are down.
  if (attempts > 0) {
    void recordLlmCall({ tier: args.tier, provider: null, answeredModel: null, attempts, failures, latencyMs: Date.now() - started });
  }
  if (onOpenRouter && models.length > 0) {
    void alertDealer("OpenRouter FREE models unavailable", [`tier=${args.tier}`, `tried: ${models.join(", ")}`, "AI replies are falling back to the template. Check OpenRouter free-tier status / daily cap / rate limits."], { key: "llm-free-down" });
  }
  return null;
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
    // Reasoning models spend tokens "thinking" before the answer; give enough
    // headroom that the visible reply isn't truncated to empty.
    maxTokens: 700,
    tier: "chat",
  });
}

/**
 * Generic single-shot completion (system + user → text). Returns null when the
 * LLM is unconfigured or the call fails, so callers fail open to a template.
 */
export async function llmText(args: { system: string; user: string; maxTokens?: number; tier?: LlmTier }): Promise<string | null> {
  // Default to the "reason" tier (extraction / content / parsing / operator); a
  // caller that wants chat-speed can pass tier:"chat".
  return callChat({ system: args.system, messages: [{ role: "user", content: args.user }], maxTokens: args.maxTokens ?? 700, tier: args.tier ?? "reason" });
}

/**
 * Pure: OpenAI-compatible multimodal messages (text + image parts). Unit-tested.
 * Image URLs are restricted to http(s) and data: schemes — never file:// /
 * javascript: / gopher:, etc. The LLM provider (e.g. local Ollama) does the
 * fetching; without this filter, a malicious caller could ask the on-box model
 * to read local files. Up to 8 images per call.
 */
export function buildVisionMessages(system: string, user: string, images: string[]) {
  const safe = images.filter((u) => typeof u === "string" && /^(?:https?:|data:image\/(?:png|jpe?g|webp|gif);)/i.test(u)).slice(0, 8);
  return [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "text", text: user },
        ...safe.map((url) => ({ type: "image_url", image_url: { url } })),
      ],
    },
  ];
}

/**
 * Vision completion — reads images (screenshots / data URLs / http URLs) into
 * text. Used to defeat AutoHome's font/pseudo-element obfuscation (read pixels).
 * Supported via the OpenAI-compatible path only — free local Ollama `qwen2.5-vl`
 * (or GPT-4o / Groq vision). Returns null on the Anthropic provider or any
 * failure (caller fails open). `LLM_VISION_MODEL` overrides the model.
 */
export async function llmVision(args: { system: string; user: string; images: string[]; maxTokens?: number }): Promise<string | null> {
  if (!llmConfigured() || args.images.length === 0) return null;
  const chain = await resolveTierChain("vision");
  if (chain.length === 0) return legacyLlmVision(args); // local openai-compat dev
  const started = Date.now();
  const failures: LlmFailure[] = [];
  let attempts = 0;
  for (const m of chain) {
    attempts += 1;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (m.key) headers["authorization"] = `Bearer ${m.key}`;
    if (m.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://tezmotors.uz";
      headers["X-Title"] = "Tez Motors";
    }
    const body = JSON.stringify({
      model: m.model,
      max_tokens: args.maxTokens ?? 1800,
      temperature: 0.1,
      stream: false,
      messages: buildVisionMessages(args.system, args.user, args.images),
    });
    try {
      const res = await fetch(openaiChatUrl(m.url), { method: "POST", headers, body, signal: AbortSignal.timeout(TIER_TIMEOUT_MS.vision) });
      if (!res.ok) { console.error("LLM vision non-OK", m.provider, m.model, res.status); failures.push({ model: m.model, provider: m.provider, reason: "non_ok", status: res.status }); continue; }
      const text = parseChatResponse("openai", await res.json());
      if (text) {
        void recordLlmCall({ tier: "vision", provider: m.provider, answeredModel: m.model, attempts, failures, latencyMs: Date.now() - started });
        return text;
      }
      failures.push({ model: m.model, provider: m.provider, reason: "empty" });
    } catch (err) {
      console.error("LLM vision failed", m.provider, m.model, err instanceof Error ? err.message : err);
      failures.push({ model: m.model, provider: m.provider, reason: failReason(err) });
    }
  }
  if (attempts > 0) {
    void recordLlmCall({ tier: "vision", provider: null, answeredModel: null, attempts, failures, latencyMs: Date.now() - started });
  }
  void alertDealer("FREE vision models unavailable (all providers)", ["tier=vision", `tried: ${chain.map((c) => `${c.provider}:${c.model}`).join(", ")}`, "Vision (spec-screenshot) extraction fell back to none. Check provider free-tier status."], { key: "llm-free-down" });
  return null;
}

/** Legacy single-endpoint vision (local openai-compatible / Ollama) — used only
 *  when no failover-provider key is set. */
async function legacyLlmVision(args: { system: string; user: string; images: string[]; maxTokens?: number }): Promise<string | null> {
  if (resolveProvider() !== "openai" || args.images.length === 0) return null;
  const apiKey = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || "";
  const url = openaiChatUrl(process.env.LLM_API_URL || OLLAMA_URL);
  const onOpenRouter = /openrouter\.ai/i.test(url);
  const legacyProvider = onOpenRouter ? "openrouter" : "ollama";
  const all = tierChain("vision", await getTierModels());
  // PAID GUARD (see callChat): on OpenRouter only call :free vision models.
  const models = onOpenRouter ? all.filter(isFreeModel) : all.filter(Boolean);
  const started = Date.now();
  const failures: LlmFailure[] = [];
  let attempts = 0;
  for (const model of models) {
    if (!model) continue;
    attempts += 1;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;
    if (onOpenRouter) {
      headers["HTTP-Referer"] = "https://tezmotors.uz";
      headers["X-Title"] = "Tez Motors";
    }
    const body = JSON.stringify({
      model,
      max_tokens: args.maxTokens ?? 1800,
      temperature: 0.1,
      stream: false,
      messages: buildVisionMessages(args.system, args.user, args.images),
    });
    try {
      const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(TIER_TIMEOUT_MS.vision) });
      if (!res.ok) { console.error("LLM vision non-OK", model, res.status); failures.push({ model, reason: "non_ok", status: res.status }); continue; }
      const text = parseChatResponse("openai", await res.json());
      if (text) {
        void recordLlmCall({ tier: "vision", provider: legacyProvider, answeredModel: model, attempts, failures, latencyMs: Date.now() - started });
        return text;
      }
      failures.push({ model, reason: "empty" });
    } catch (err) {
      console.error("LLM vision failed", model, err instanceof Error ? err.message : err);
      failures.push({ model, reason: failReason(err) });
    }
  }
  if (attempts > 0) {
    void recordLlmCall({ tier: "vision", provider: null, answeredModel: null, attempts, failures, latencyMs: Date.now() - started });
  }
  if (onOpenRouter && models.length > 0) {
    void alertDealer("OpenRouter FREE models unavailable", ["tier=vision", `tried: ${models.join(", ")}`, "Vision (spec-screenshot) extraction fell back to none. Check OpenRouter free-tier status."], { key: "llm-free-down" });
  }
  return null;
}
