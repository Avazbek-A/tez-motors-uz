/**
 * Marketing Autopilot — the brain that decides WHAT a one-person dealer should
 * post about, by reading the live state of the business: aged stock that needs
 * to move, fresh arrivals worth announcing, models people keep asking about, and
 * promos already running that deserve amplification. It turns those signals into
 * a prioritized list of concrete content suggestions that flow straight into the
 * existing Content Studio (generate → draft → schedule → auto-post) pipeline.
 *
 * This module is pure + deterministic (unit-tested). The data gather lives in
 * marketing-autopilot-data.ts; the actual copy is produced by marketing-content.ts.
 */
import type { ContentKind, ContentLocale } from "./marketing-content";

export interface CarSignal {
  carId: string;
  name: string; // "BYD Han 2024"
  daysOnLot: number;
  priceUsd: number;
}

export interface DemandSignal {
  carId: string;
  name: string;
  inquiries: number;
}

export interface PromoSignal {
  carId: string;
  name: string;
  label: string | null;
  salePriceUsd: number;
}

export interface MarketingSignals {
  agedStock: CarSignal[]; // available cars sitting too long (most-aged first)
  newArrivals: CarSignal[]; // added recently (freshest first)
  hotDemand: DemandSignal[]; // most-inquired cars (last 30d)
  activePromos: PromoSignal[]; // promotions currently live
}

export interface MarketingSuggestion {
  /** Stable key so the UI can dedupe / track which were acted on. */
  key: string;
  priority: number; // lower = act first
  /** Why this is worth posting — shown to the dealer. */
  reason: string;
  /** Recommended content format. */
  kind: ContentKind;
  /** Default language for the draft (dealer can change before generating). */
  locale: ContentLocale;
  /** Linked car, when the post is about a specific unit. */
  carId: string | null;
  /** Free-text subject for non-car posts (roundups, evergreen). */
  topic: string | null;
  /** Short human label for the suggestion list. */
  subjectLabel: string;
  /** Suggested tone passed to the copywriter. */
  tone: string;
}

/** Inventory ages (days) that make a car worth a "move it" promo push. */
export const AGED_LOT_DAYS = 45;
/** A car added within this many days is a "new arrival" worth announcing. */
export const NEW_ARRIVAL_DAYS = 10;
/** Minimum inquiries (30d) to call a model "in demand". */
export const HOT_DEMAND_MIN = 3;

const usd = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-US");

/**
 * Derive a prioritized list of marketing content to create from the business
 * signals. Deterministic — same signals always yield the same suggestions.
 */
export function buildMarketingSuggestions(signals: MarketingSignals): MarketingSuggestion[] {
  const out: MarketingSuggestion[] = [];

  // 1. Aged stock — the highest-value content moves cash off the lot.
  for (const c of signals.agedStock.filter((c) => c.daysOnLot >= AGED_LOT_DAYS).slice(0, 3)) {
    out.push({
      key: `aged:${c.carId}`,
      priority: 1,
      reason: `On the lot ${c.daysOnLot} days — a focused promo helps move it.`,
      kind: "promo",
      locale: "ru",
      carId: c.carId,
      topic: null,
      subjectLabel: c.name,
      tone: "urgent but honest, value-focused",
    });
  }

  // 2. New arrivals — fresh, timely, give people a reason to look now.
  const arrivals = signals.newArrivals.filter((c) => c.daysOnLot <= NEW_ARRIVAL_DAYS);
  if (arrivals.length >= 3) {
    // A single "new this week" roundup reads better than three separate posts.
    const names = arrivals.slice(0, 5).map((c) => c.name).join(", ");
    out.push({
      key: "arrivals:roundup",
      priority: 2,
      reason: `${arrivals.length} cars arrived recently — announce them in one roundup.`,
      kind: "telegram",
      locale: "ru",
      carId: null,
      topic: `New arrivals at Tez Motors this week: ${names}. In stock and ready to import turn-key.`,
      subjectLabel: `New arrivals (${arrivals.length})`,
      tone: "fresh, exciting",
    });
  } else {
    for (const c of arrivals.slice(0, 2)) {
      out.push({
        key: `arrival:${c.carId}`,
        priority: 2,
        reason: `Just arrived (${c.daysOnLot}d ago) — announce it while it's fresh.`,
        kind: "telegram",
        locale: "ru",
        carId: c.carId,
        topic: null,
        subjectLabel: c.name,
        tone: "fresh, exciting",
      });
    }
  }

  // 3. Amplify promos already running — you've discounted, now drive traffic.
  for (const p of signals.activePromos.slice(0, 3)) {
    out.push({
      key: `promo:${p.carId}`,
      priority: 3,
      reason: `Promo live${p.label ? ` ("${p.label}")` : ""} at ${usd(p.salePriceUsd)} — announce it widely.`,
      kind: "promo",
      locale: "ru",
      carId: p.carId,
      topic: null,
      subjectLabel: `${p.name} — ${usd(p.salePriceUsd)}`,
      tone: "urgent, deal-driven",
    });
  }

  // 4. Hot demand — social proof: "everyone's asking about this".
  for (const d of signals.hotDemand.filter((d) => d.inquiries >= HOT_DEMAND_MIN).slice(0, 2)) {
    out.push({
      key: `demand:${d.carId}`,
      priority: 4,
      reason: `${d.inquiries} inquiries in 30 days — lean into the interest with social proof.`,
      kind: "instagram",
      locale: "ru",
      carId: d.carId,
      topic: null,
      subjectLabel: d.name,
      tone: "confident, social-proof",
    });
  }

  // 5. Evergreen fallback — keep the channel alive on quiet days. Always last,
  //    only surfaced when there's little else, so we don't crowd timely posts.
  if (out.length < 2) {
    out.push({
      key: "evergreen:import-guide",
      priority: 9,
      reason: "Quiet inventory week — post evergreen trust-building content.",
      kind: "blog",
      locale: "ru",
      carId: null,
      topic: "How Tez Motors imports cars from China to Uzbekistan turn-key: sourcing, shipping, customs, and warranty — step by step.",
      subjectLabel: "Import process explainer",
      tone: "trustworthy, educational",
    });
  }

  return out.sort((a, b) => a.priority - b.priority);
}
