/**
 * Dealer Copilot — intent router (Phase AE).
 *
 * Two-stage, fail-open: a DETERMINISTIC keyword/regex classifier always runs and
 * is the source of truth; an optional LLM JSON classification only "wins" when it
 * parses, validates, and lands in-enum. So the copilot works with no LLM, a weak
 * local model, or broken JSON. All functions here are pure + unit-tested; the
 * single LLM fetch lives in core.ts.
 *
 * Russian-first (the dealer types RU) with English aliases.
 */
import { ALL_INTENTS, isIntent, type Intent, type IntentParams, type ParsedIntent } from "./intents";

const ORDER_REF = /\bTM-[A-Z0-9]{8}\b/i;

/** Normalize a money token: "$34,000" / "34k" / "34 000" / "34тыс" → 34000. */
export function normalizeAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d[\d\s.,]*)\s*(k|к|тыс|млн|m)?/i);
  if (!m) return null;
  let n = Number(m[1].replace(/[\s,](?=\d{3}\b)/g, "").replace(/\s/g, "").replace(/,/g, "."));
  if (!Number.isFinite(n)) {
    n = Number(m[1].replace(/[\s,]/g, ""));
  }
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit === "k" || unit === "к" || unit === "тыс") n *= 1_000;
  if (unit === "млн" || unit === "m") n *= 1_000_000;
  return Math.round(n);
}

function extractPct(text: string): number | null {
  const m = text.match(/(\d{1,2})\s*%/);
  if (m) return Number(m[1]);
  const m2 = text.match(/(?:на|by)\s+(\d{1,2})\s*(?:процент|percent|%)/i);
  return m2 ? Number(m2[1]) : null;
}

function extractQty(text: string): number | null {
  const m = text.match(/(\d{1,3})\s*(?:шт|штук|pcs|units?|x|×|штуки)/i);
  if (m) return Number(m[1]);
  const m2 = text.match(/(?:закаж|order|draft|заявк\w*)\D{0,12}(\d{1,3})\b/i);
  return m2 ? Number(m2[1]) : null;
}

/** Keyword sets per intent (RU + EN). Order matters: earlier = higher priority. */
const RULES: { intent: Intent; re: RegExp }[] = [
  { intent: "markdown_car", re: /(mark\s*down|markdown|уцен|снизь|снизить цену|скинь цен|drop\s*price|сделай скидк|discount.*car)/i },
  { intent: "advance_order", re: /(advance order|продвинь заказ|переведи заказ|обнови заказ|статус заказа|move order|order.*to (sourcing|transit|customs|delivered)|TM-[A-Z0-9]{8})/i },
  { intent: "draft_po", re: /(draft.*po|purchase order|закуп|закаж.*поставщик|заявк.*поставщик|order.*from supplier|создай заказ поставщику|нужно ввезти|нужно заказать)/i },
  { intent: "cash_position", re: /(cash|деньги|баланс|капитал|сколько.*денег|money|финанс|депозит|deposit|runway|оборот)/i },
  { intent: "demand", re: /(demand|спрос|что.*везти|что.*заказать|what.*import|популярн|hot|востребован|чего хотят)/i },
  { intent: "aged_stock", re: /(aged|stale|залежал|застоял|давно.*лот|старые маш|что.*уценить|aging|долго стоит)/i },
  { intent: "lead_summary", re: /(lead|лид|заявк|inquir|клиент.*нов|новые обращ|hot lead|горяч)/i },
  { intent: "business_summary", re: /(сводк|обзор|brief|как дела|статус бизнес|что важн|сегодня|итог|overview|summary)/i },
  { intent: "help", re: /(help|помощ|что ты умеешь|команд|what can you)/i },
];

/** Deterministic classification — always available, the fallback + source of truth. */
export function classifyDeterministic(message: string): ParsedIntent {
  const text = (message || "").trim();
  const params: IntentParams = {};

  const orderM = text.match(ORDER_REF);
  if (orderM) params.orderRef = orderM[0].toUpperCase();

  let intent: Intent = "unknown";
  for (const r of RULES) {
    if (r.re.test(text)) { intent = r.intent; break; }
  }
  // A bare order code with no verb → treat as an order status read elsewhere,
  // but here advance_order rule already catches TM-codes; keep as advance only
  // if a move verb is present, else it's a lookup the core can answer read-only.

  if (intent === "markdown_car") {
    params.pct = extractPct(text);
    // A target price token: "$34,000" or "до/to/за 34k". NOT bare numbers —
    // model names contain digits (Tank 300, Tiggo 8), which must survive.
    const PRICE_TOKEN = /(?:до|to|за|->)\s*\$?\s*[\d][\d\s.,]*\s*(?:k|к|тыс)?|\$\s*[\d][\d\s.,]*\s*(?:k|к|тыс)?/gi;
    const priceM = text.match(PRICE_TOKEN);
    if (priceM && params.pct == null) params.priceUsd = normalizeAmount(priceM[0]);
    // Car phrase: strip the action keyword, the price/pct tokens, and connectives.
    params.carQuery = text
      .replace(RULES[0].re, " ")
      .replace(PRICE_TOKEN, " ")
      .replace(/\d{1,3}\s*%/g, " ")
      .replace(/\b(до|to|за|на|by|цену|цены|price)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || null;
  } else if (intent === "advance_order") {
    const st = text.match(/\b(ordered|deposit_paid|sourcing|in_transit|at_customs|ready_for_pickup|delivered|таможн|в пути|готов|выдан|доставлен)\b/i);
    if (st) params.status = st[1].toLowerCase();
  } else if (intent === "draft_po") {
    params.qty = extractQty(text);
    // brand/model: the noun phrase after the order verb, minus qty tokens.
    params.brand = null;
    params.model = text
      .replace(RULES[2].re, " ")
      .replace(/\d{1,3}\s*(?:шт|штук|pcs|units?|x|×)?/gi, " ")
      .replace(/\b(поставщик\w*|supplier|штук\w*|единиц)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || null;
  }

  return { intent, params, source: "rules" };
}

/** System prompt for the LLM JSON classifier. */
export function routerSystemPrompt(): string {
  return [
    "You classify a car-dealer's message into ONE intent and extract params. Output STRICT JSON only, no prose.",
    `Intents: ${ALL_INTENTS.join(", ")}.`,
    "READ (answer a question): cash_position, demand, aged_stock, lead_summary, business_summary.",
    "WRITE (propose an action): markdown_car {carQuery, priceUsd?, pct?}, advance_order {orderRef, status?}, draft_po {model, qty?}.",
    "If unsure use \"unknown\". NEVER invent a car name, order code, or price not in the message.",
    'Shape: {"intent":"...","params":{"carQuery":null,"priceUsd":null,"pct":null,"orderRef":null,"status":null,"model":null,"qty":null}}',
  ].join(" ");
}

/** Tolerant parse of the LLM's JSON classification. Returns null if unusable. */
export function parseRouterResponse(raw: string | null): ParsedIntent | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: { intent?: unknown; params?: Record<string, unknown> };
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const intent = typeof obj.intent === "string" ? obj.intent.trim() : "";
  if (!isIntent(intent)) return null;
  const p = (obj.params || {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const numv = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : normalizeAmount(typeof v === "string" ? v : null));
  return {
    intent: intent as Intent,
    params: {
      carQuery: str(p.carQuery),
      priceUsd: numv(p.priceUsd),
      pct: typeof p.pct === "number" ? p.pct : null,
      orderRef: str(p.orderRef)?.toUpperCase() ?? null,
      status: str(p.status)?.toLowerCase() ?? null,
      brand: str(p.brand),
      model: str(p.model),
      qty: typeof p.qty === "number" ? p.qty : null,
    },
    source: "llm",
  };
}

/**
 * Merge LLM + deterministic results. The LLM wins on INTENT only when it's a
 * write intent that the rules also flagged as a write OR a read the rules left
 * as unknown — but params always prefer whichever has the concrete value, with
 * the order code/price from rules trusted (extracted from the literal message).
 */
export function mergeClassifications(rules: ParsedIntent, llm: ParsedIntent | null): ParsedIntent {
  if (!llm) return rules;
  // Trust rules when they confidently found a write intent (keyword + a target).
  const rulesIsActionable =
    rules.intent !== "unknown" && rules.intent !== "help";
  const intent = rulesIsActionable ? rules.intent : llm.intent;
  return {
    intent,
    params: {
      carQuery: rules.params.carQuery || llm.params.carQuery || null,
      priceUsd: rules.params.priceUsd ?? llm.params.priceUsd ?? null,
      pct: rules.params.pct ?? llm.params.pct ?? null,
      orderRef: rules.params.orderRef || llm.params.orderRef || null,
      status: rules.params.status || llm.params.status || null,
      brand: rules.params.brand || llm.params.brand || null,
      model: rules.params.model || llm.params.model || null,
      qty: rules.params.qty ?? llm.params.qty ?? null,
    },
    source: intent === llm.intent && !rulesIsActionable ? "llm" : "rules",
  };
}
