/**
 * Autonomous buying & pricing brain — pure scoring (unit-tested, no I/O).
 *
 * Fuses the three signals the importer already collects into one decision:
 *   demand (inquiries / saved searches / watches / favorites)
 *   × market price (OLX/Telegram median)
 *   × landed cost (UZ customs engine)
 * → what to import, how many, at what price, with a projected margin and an
 * opportunity score. The route does the DB aggregation and calls these.
 */

export interface DemandSignals {
  inquiries: number;
  savedSearches: number;
  watches: number;
  favorites: number;
  /** Total pre-orders for this model (made-to-order intent). Optional. */
  preordersTotal?: number;
  /** Pre-orders with a deposit paid — the most committed signal. Optional. */
  preordersDeposited?: number;
}

/**
 * Demand → 0–100, weighted and log-scaled so a handful of strong signals scores
 * well and it saturates rather than letting one viral model dwarf everything.
 *
 * A deposited pre-order is the strongest possible intent — the buyer put money
 * down on an exact config — so it weighs ×8; an un-deposited pre-order ×4
 * (committed config, not yet paid). Both rank above a plain inquiry (×3):
 * importing against pre-sold demand is the whole point of an importer.
 */
export function demandScore(s: DemandSignals): number {
  const preordersTotal = Math.max(0, s.preordersTotal ?? 0);
  const preordersDeposited = Math.max(0, Math.min(preordersTotal, s.preordersDeposited ?? 0));
  const preordersPending = preordersTotal - preordersDeposited;
  const weighted =
    Math.max(0, s.inquiries) * 3 +
    Math.max(0, s.watches) * 2 +
    Math.max(0, s.savedSearches) * 2 +
    Math.max(0, s.favorites) * 1 +
    preordersDeposited * 8 +
    preordersPending * 4;
  if (weighted <= 0) return 0;
  return Math.min(100, Math.round(100 * (1 - Math.exp(-weighted / 12))));
}

export interface OpportunityInput {
  demandScore: number; // 0–100
  marginPct: number | null; // % of landed cost; null when cost/market unknown
  sampleSize: number; // market listings backing the median
  freshnessDays: number | null; // days since the latest market observation
}

/**
 * Opportunity → 0–100. Blends demand (40%) and margin (60%), scaled by
 * confidence (more/fresher market data = higher confidence). With no
 * margin/market data it falls back to a damped demand-only signal so a hot
 * model still surfaces for the dealer to price manually.
 */
export function opportunityScore(i: OpportunityInput): number {
  const demand = Math.max(0, Math.min(100, i.demandScore));
  if (i.marginPct == null || i.sampleSize <= 0) {
    return Math.round(demand * 0.4);
  }
  const marginComponent = Math.max(0, Math.min(1, i.marginPct / 20)); // 20%+ = full
  const sampleConf = Math.min(1, i.sampleSize / 5);
  const freshConf =
    i.freshnessDays == null ? 0.5 : i.freshnessDays <= 30 ? 1 : i.freshnessDays <= 90 ? 0.7 : 0.4;
  const confidence = sampleConf * freshConf;
  const raw = (demand / 100) * 0.4 + marginComponent * 0.6;
  // Confidence dampens but never zeroes a genuine demand+margin signal.
  return Math.round(100 * raw * (0.5 + 0.5 * confidence));
}

export type Verdict = "strong_buy" | "buy" | "consider" | "skip";

export function verdict(score: number, marginPct: number | null): Verdict {
  if (marginPct != null && marginPct < 5) return "skip"; // thin/negative margin
  if (score >= 70) return "strong_buy";
  if (score >= 45) return "buy";
  if (score >= 20) return "consider";
  return "skip";
}

/** Suggested units to import — driven by demand, gated by margin viability. */
export function recommendedQty(demandScore: number, marginPct: number | null): number {
  if (marginPct != null && marginPct < 5) return 0;
  const base = Math.ceil(Math.max(0, Math.min(100, demandScore)) / 20); // 0..5
  return Math.max(1, Math.min(6, base));
}

const VERDICT_LABELS: Record<Verdict, string> = {
  strong_buy: "Strong buy",
  buy: "Buy",
  consider: "Consider",
  skip: "Skip",
};

export function verdictLabel(v: Verdict): string {
  return VERDICT_LABELS[v];
}
