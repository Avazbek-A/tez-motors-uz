/**
 * Minimal, Workers-safe LLM wrapper (single fetch — no node-only deps).
 *
 * Fail-open by design, mirroring src/lib/telegram.ts and src/lib/email.ts:
 * if LLM_API_KEY is unset, or the call fails for any reason, this returns
 * `null` and the caller degrades to a templated, retrieval-only reply. The
 * assistant must never 500 because the model is down or unconfigured.
 *
 * IMPORTANT — anti-hallucination contract: this helper NEVER selects cars or
 * invents prices. Car retrieval happens server-side against the DB; the model
 * only writes friendly prose *about a fixed inventory list it is handed*. The
 * system prompt forbids inventing models/prices and instructs it to recommend
 * only from the provided JSON.
 *
 * Defaults target the Anthropic Messages API (frontier quality, HTTP-only).
 * Override via env without code changes:
 *   LLM_API_KEY   (required to enable)
 *   LLM_API_URL   (default https://api.anthropic.com/v1/messages)
 *   LLM_MODEL     (default claude-3-5-haiku-latest)
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
  return [
    `Customer request: "${userMessage}"`,
    "",
    `INVENTORY (the only cars that exist): ${inventory}`,
  ].join("\n");
}

/**
 * Generate a grounded natural-language recommendation. Returns the model's
 * text, or `null` when the LLM is unconfigured or the call fails (caller then
 * falls back to a templated reply). Never throws.
 */
export async function generateAssistantReply(args: {
  locale: string;
  userMessage: string;
  cars: AssistantCarLite[];
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<string | null> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;

  const url = process.env.LLM_API_URL || "https://api.anthropic.com/v1/messages";
  const model = process.env.LLM_MODEL || "claude-3-5-haiku-latest";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system: systemPrompt(args.locale),
        messages: [
          // Prior turns give the model conversational memory; the current turn
          // carries the freshly-retrieved inventory so grounding stays exact.
          ...(args.history ?? []).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: userPrompt(args.userMessage, args.cars) },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("LLM non-OK", res.status, body.slice(0, 500));
      return null;
    }

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = (data.content || [])
      .filter((b) => b?.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();

    return text.length > 0 ? text : null;
  } catch (err) {
    // Network / parse failure — fail open to the templated fallback.
    console.error("LLM call failed", err);
    return null;
  }
}

/**
 * Generic single-shot completion (system + user → text). Returns null when the
 * LLM is unconfigured or the call fails, so callers fail open to a template.
 * Used by the proactive sales-reply drafter (src/lib/sales-ai.ts).
 */
export async function llmText(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string | null> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;

  const url = process.env.LLM_API_URL || "https://api.anthropic.com/v1/messages";
  const model = process.env.LLM_MODEL || "claude-3-5-haiku-latest";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: args.maxTokens ?? 400,
        system: args.system,
        messages: [{ role: "user", content: args.user }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("LLM non-OK", res.status, body.slice(0, 500));
      return null;
    }
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (data.content || [])
      .filter((b) => b?.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    console.error("LLM call failed", err);
    return null;
  }
}
