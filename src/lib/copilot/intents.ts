/**
 * Dealer Copilot — intent taxonomy (Phase AE).
 *
 * The dealer runs the business by chatting. Each message is classified into one
 * intent + params. READ intents answer questions (no mutation). WRITE intents
 * are confirm-gated: they propose an action the dealer must explicitly confirm
 * before anything changes.
 */

export const READ_INTENTS = [
  "cash_position", // money cockpit summary
  "demand", // what customers want / what to import
  "aged_stock", // cars sitting too long + markdown suggestions
  "lead_summary", // new leads / hot leads / tasks due
  "business_summary", // the full operator briefing
] as const;

export const WRITE_INTENTS = [
  "markdown_car", // lower a car's price (params: carQuery + priceUsd|pct)
  "advance_order", // move an order to the next/given status (params: orderRef + status?)
  "draft_po", // draft a supplier purchase order (params: brand/model + qty)
] as const;

export const ALL_INTENTS = [...READ_INTENTS, ...WRITE_INTENTS, "help", "unknown"] as const;

export type ReadIntent = (typeof READ_INTENTS)[number];
export type WriteIntent = (typeof WRITE_INTENTS)[number];
export type Intent = (typeof ALL_INTENTS)[number];

export function isWriteIntent(i: string): i is WriteIntent {
  return (WRITE_INTENTS as readonly string[]).includes(i);
}
export function isReadIntent(i: string): i is ReadIntent {
  return (READ_INTENTS as readonly string[]).includes(i);
}
export function isIntent(i: string): i is Intent {
  return (ALL_INTENTS as readonly string[]).includes(i);
}

/** Raw params a classifier may extract; resolution (car/order lookup) happens in core. */
export interface IntentParams {
  carQuery?: string | null; // free-text car name to resolve against inventory
  priceUsd?: number | null; // absolute target price for markdown
  pct?: number | null; // percentage markdown
  orderRef?: string | null; // TM-XXXXXXXX
  status?: string | null; // target order status
  brand?: string | null;
  model?: string | null;
  qty?: number | null;
}

export interface ParsedIntent {
  intent: Intent;
  params: IntentParams;
  /** "rules" (deterministic) or "llm" — for observability/debugging. */
  source: "rules" | "llm";
}
