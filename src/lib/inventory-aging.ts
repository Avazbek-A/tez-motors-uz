/**
 * Aged-inventory markdown engine.
 *
 * Combines how long a car has sat on the lot with how much real demand it has
 * (favorites + watches + inquiries) to recommend a price markdown — so dead
 * stock gets moved instead of quietly tying up capital. Pure + deterministic so
 * it's unit-tested; the cron (api/cron/inventory-aging) only DETECTS and alerts
 * — it never auto-changes a price (the dealer applies the markdown).
 */

export const STALE_AFTER_DAYS = 45;

/**
 * Suggested markdown % for a car. 0 = leave it alone (not stale, or still in
 * demand). Older + colder ⇒ bigger markdown, capped at 20%.
 */
export function suggestMarkdownPct(daysOnLot: number, demandScore: number): number {
  if (!Number.isFinite(daysOnLot) || daysOnLot < STALE_AFTER_DAYS) return 0;
  // Genuinely wanted stock holds its price even if it's been around a while.
  if (demandScore >= 8) return 0;

  let pct = daysOnLot >= 180 ? 12 : daysOnLot >= 90 ? 8 : 4;
  if (demandScore === 0) pct += 3; // no interest at all — nudge harder
  return Math.min(pct, 20);
}

/**
 * Suggested price INCREASE % for fresh stock with strong demand — the other
 * side of dynamic repricing. 0 = leave it. Only fresh cars (≤30 days) qualify,
 * so we never raise the price on stuck inventory.
 */
export function suggestIncreasePct(daysOnLot: number, demandScore: number): number {
  if (!Number.isFinite(daysOnLot) || daysOnLot > 30) return 0;
  if (demandScore >= 20) return 5;
  if (demandScore >= 12) return 3;
  return 0;
}

/** Apply an increase % to a price, rounded up to the nearest $100. */
export function increasePrice(priceUsd: number, pct: number): number {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0 || pct <= 0) return Math.round(priceUsd) || 0;
  return Math.ceil((priceUsd * (1 + pct / 100)) / 100) * 100;
}

/** Apply a markdown % to a price, rounded down to the nearest $100. */
export function markdownPrice(priceUsd: number, pct: number): number {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0 || pct <= 0) return Math.round(priceUsd) || 0;
  const marked = priceUsd * (1 - pct / 100);
  return Math.floor(marked / 100) * 100;
}

export interface AgingInput {
  price_usd: number;
  daysOnLot: number;
  demandScore: number;
}

export interface AgingSuggestion {
  markdownPct: number;
  suggestedPriceUsd: number;
}

/** Full suggestion for one car; markdownPct 0 means "no action". */
export function agingSuggestion(input: AgingInput): AgingSuggestion {
  const pct = suggestMarkdownPct(input.daysOnLot, input.demandScore);
  return {
    markdownPct: pct,
    suggestedPriceUsd: pct > 0 ? markdownPrice(input.price_usd, pct) : Math.round(input.price_usd),
  };
}

/**
 * Is the age signal an artifact of a bulk import rather than real lot age?
 *
 * The catalog was seeded by importing ~600 cars in one run, so every row shares
 * a `created_at` within minutes of the others. Once that single date crosses
 * STALE_AFTER_DAYS the engine flags the entire inventory at once and the dealer
 * gets a Telegram alert telling them to discount every car they own — advice
 * with no information in it, which is worse than silence because it teaches
 * them to ignore the channel.
 *
 * Two conditions have to hold together, so a dealer whose stock genuinely went
 * cold still gets alerted: nearly everything is flagged AND the fleet's ages are
 * bunched together. Real inventory arrives over time, so its ages spread out.
 */
export const UNIFORM_AGE_SPREAD_DAYS = 14;
export const DEGENERATE_FLAGGED_SHARE = 0.9;

export function isBulkImportArtifact(daysOnLot: number[], flaggedCount: number): boolean {
  if (daysOnLot.length === 0) return false;
  if (flaggedCount / daysOnLot.length < DEGENERATE_FLAGGED_SHARE) return false;
  const sorted = [...daysOnLot].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return at(0.9) - at(0.1) < UNIFORM_AGE_SPREAD_DAYS;
}
