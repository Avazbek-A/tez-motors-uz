/**
 * Market analytics — the second layer of the pricing engine (Phase-1 of the
 * build-all push, see PRICING_ENGINE_ROADMAP.md). Pure, fully unit-tested, $0:
 * sold-price/time-to-sell inference, dealer-vs-private, seller motivation,
 * cross-source dedup, Bayesian shrinkage, prediction intervals, elasticity,
 * residual value, regional spread, regime-break, VIN journeys, holding cost.
 *
 * These operate on `market_listings` rows (asking prices + lifecycle timestamps)
 * and turn them into decision-grade signals. The raw math (parse/median/clean)
 * lives in market-intel.ts; this builds on top of it.
 */
import { median, cleanCarPrices } from "./market-intel";

const DAY = 86_400_000;

// ─── Listings shape (loosely typed; rows come from market_listings) ───────────
export interface ListingLike {
  price_usd?: number | null;
  mileage_km?: number | null;
  year?: number | null;
  model?: string | null;
  city?: string | null;
  source?: string | null;
  raw_text?: string | null;
  observed_at?: string | null; // first seen
  last_seen_at?: string | null; // last re-scrape
}

const ts = (l: ListingLike): number => Date.parse(l.last_seen_at || l.observed_at || "") || 0;
const firstTs = (l: ListingLike): number => Date.parse(l.observed_at || l.last_seen_at || "") || 0;

// ─── 1. Sold-price & time-to-sell inference ───────────────────────────────────
// A listing not re-seen for `staleDays` (while scraping continues) has left the
// market — sold or withdrawn. We can't see the true sale price, only the last
// asking, so the clearing price = asking × (1 − haggleGap). The single biggest
// accuracy correction: asking prices are systematically above transaction prices.

/** Disappeared listings with their days-on-market. Internal helper. */
function goneListings(listings: ListingLike[], opts?: { now?: number; staleDays?: number }): { price: number; days: number }[] {
  const now = opts?.now ?? Date.now();
  const stale = (opts?.staleDays ?? 14) * DAY;
  const out: { price: number; days: number }[] = [];
  for (const l of listings) {
    const last = ts(l);
    const first = firstTs(l);
    if (!last || !first) continue;
    if (now - last <= stale) continue; // still live
    const price = Number(l.price_usd);
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({ price, days: Math.max(0, Math.round((last - first) / DAY)) });
  }
  return out;
}

export interface SoldSignal {
  soldCount: number; // listings that disappeared (sold/withdrawn proxy)
  activeCount: number; // still live
  medianDaysToSell: number | null;
  clearingMedianUsd: number | null; // estimated transaction price
  askingMedianUsd: number | null; // last asking of the gone listings, for reference
}

export function inferSold(listings: ListingLike[], opts?: { now?: number; staleDays?: number; haggleGap?: number }): SoldSignal {
  const now = opts?.now ?? Date.now();
  const stale = (opts?.staleDays ?? 14) * DAY;
  const haggle = opts?.haggleGap ?? 0.05;
  const gone = goneListings(listings, { now, staleDays: opts?.staleDays });
  const activeCount = listings.filter((l) => ts(l) && now - ts(l) <= stale).length;

  const askingPrices = cleanCarPrices(gone.map((g) => g.price));
  const askingMedian = askingPrices.length ? median(askingPrices) : null;
  const clearingMedian = askingMedian != null ? Math.round(askingMedian * (1 - haggle)) : null;
  const daysList = gone.map((g) => g.days).filter((d) => d >= 0);

  return {
    soldCount: gone.length,
    activeCount,
    medianDaysToSell: daysList.length ? median(daysList) : null,
    clearingMedianUsd: clearingMedian,
    askingMedianUsd: askingMedian,
  };
}

// ─── 2. Dealer-vs-private classification ──────────────────────────────────────
// A dealer's ask is your competitor's RETAIL; a private ask is your ACQUISITION
// cost. Splitting them lets the buy price anchor on private sales.

/** Normalize a phone to its 9-digit national form (UZ), or null. */
export function extractPhone(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = String(text).replace(/[()\s\-.]/g, "");
  const m = cleaned.match(/\+?998\d{9}|(?<!\d)\d{9}(?!\d)/);
  if (!m) return null;
  const d = m[0].replace(/\D/g, "");
  return d.slice(-9);
}

const DEALER_RE = /(автосалон|авто\s*салон|автоцентр|авто\s*центр|\bсалон\b|\bдилер\b|dealer|в наличии|в рассрочку|рассрочк|кредит|лизинг|кафолат|обмен на новые|автомолл|automall)/i;

export function classifySeller(text: string | null | undefined, opts?: { phoneListingCount?: number }): "dealer" | "private" {
  const s = (text || "").toLowerCase();
  if (DEALER_RE.test(s)) return "dealer";
  if ((opts?.phoneListingCount ?? 0) >= 5) return "dealer"; // one phone, many listings = bulk seller
  return "private";
}

// ─── 3. Seller-motivation scoring ─────────────────────────────────────────────
// How desperate the seller is → how far below ask they'll go. Sets a per-listing
// lowball, not a model average. 0 (firm) … 1 (very motivated).
export function motivationScore(text: string | null | undefined, opts?: { priceDropped?: boolean }): number {
  if (!text && !opts?.priceDropped) return 0;
  const s = (text || "").toLowerCase();
  let score = 0;
  if (/(сроч|срочно|urgent|tezda|tez\s*sotil|зарез|нужны деньги|деньги срочно|пул керак)/.test(s)) score += 0.4;
  if (/(уезжа|переезд|leaving|emigr|на родину|ketяпман|ketyapman)/.test(s)) score += 0.3;
  if (/(торг|договорн|обмен|chegirma|скидк|уступлю|можно дешевле)/.test(s)) score += 0.2;
  if (/(быстро|сегодня|на этой неделе|today|bugun)/.test(s)) score += 0.1;
  if (opts?.priceDropped) score += 0.3;
  return Math.min(1, Math.round(score * 100) / 100);
}

// ─── 4. Cross-source dedup ────────────────────────────────────────────────────
// The same car on OLX + avtoelon + Telegram = ONE comp, not three. Anchor on the
// phone (the strong cross-platform identity) + model + year + price band; keep the
// freshest sighting. Listings with no phone pass through (can't safely collapse).
export function dedupeListings<T extends ListingLike>(rows: T[]): T[] {
  const byKey = new Map<string, T>();
  const out: T[] = [];
  for (const r of rows) {
    const phone = extractPhone(r.raw_text);
    if (!phone) {
      out.push(r);
      continue;
    }
    const band = Number.isFinite(Number(r.price_usd)) && Number(r.price_usd) > 0 ? Math.round(Number(r.price_usd) / 500) : "?";
    const key = `${phone}|${(r.model || "").toLowerCase()}|${r.year ?? "?"}|${band}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
      out.push(r);
    } else if (ts(r) > ts(prev)) {
      const idx = out.indexOf(prev);
      if (idx >= 0) out[idx] = r;
      byKey.set(key, r);
    }
  }
  return out;
}

// ─── 5. Bayesian shrinkage (thin models) ──────────────────────────────────────
// Partial-pool a model's median toward its brand/segment mean by sample size:
// few comps → lean on the group; many comps → trust the model. Gives the 156/208
// no/low-comp models a defensible number instead of a hard fallback.
export function shrinkEstimate(modelMedian: number | null, modelN: number, groupMean: number | null, opts?: { k?: number }): number | null {
  const k = opts?.k ?? 5; // pseudo-count: n=k → 50/50
  if (modelMedian == null) return groupMean;
  if (groupMean == null) return modelMedian;
  const w = modelN / (modelN + k);
  return Math.round(w * modelMedian + (1 - w) * groupMean);
}

// ─── 6. Prediction interval ───────────────────────────────────────────────────
// Fair value as a band, widened for small samples. Pairs with the confidence score.
export function predictionInterval(med: number | null, prices: number[], opts?: { z?: number }): { low: number; high: number } | null {
  if (med == null || prices.length < 2) return null;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length;
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(prices.length);
  const z = opts?.z ?? 1.28; // ~80%
  const margin = z * se * (1 + 2 / prices.length); // small-sample widening
  return { low: Math.max(0, Math.round(med - margin)), high: Math.round(med + margin) };
}

// ─── 7. Price elasticity (price ↔ days-to-sell) ───────────────────────────────
// Higher ask → longer to sell. The slope lets the dealer trade margin for speed.
export function priceElasticity(listings: ListingLike[], opts?: { now?: number; staleDays?: number }): { daysPerUsd: number | null; n: number } {
  const pts = goneListings(listings, opts).filter((p) => p.days >= 0 && p.price > 0);
  if (pts.length < 4) return { daysPerUsd: null, n: pts.length };
  const n = pts.length;
  const mx = pts.reduce((a, c) => a + c.price, 0) / n;
  const my = pts.reduce((a, c) => a + c.days, 0) / n;
  let num = 0;
  let den = 0;
  for (const c of pts) {
    num += (c.price - mx) * (c.days - my);
    den += (c.price - mx) ** 2;
  }
  if (den === 0) return { daysPerUsd: null, n };
  return { daysPerUsd: Math.round((num / den) * 1e5) / 1e5, n };
}

// ─── 8. Residual-value forecast ───────────────────────────────────────────────
/** Annual depreciation %/yr fitted log-linearly from cross-sectional year medians. */
export function estimateAnnualDepreciation(points: { year: number; medianUsd: number }[], nowYear: number): number | null {
  const pts = points
    .filter((p) => p.medianUsd > 0 && p.year > 1990 && p.year <= nowYear)
    .map((p) => ({ age: nowYear - p.year, lp: Math.log(p.medianUsd) }));
  if (pts.length < 3) return null;
  const n = pts.length;
  const mx = pts.reduce((a, c) => a + c.age, 0) / n;
  const my = pts.reduce((a, c) => a + c.lp, 0) / n;
  let num = 0;
  let den = 0;
  for (const c of pts) {
    num += (c.age - mx) * (c.lp - my);
    den += (c.age - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den; // d ln(price)/d age, expected negative
  const ratePct = (1 - Math.exp(slope)) * 100;
  if (!Number.isFinite(ratePct)) return null;
  return Math.max(0, Math.min(40, Math.round(ratePct * 10) / 10));
}

/** Project a value forward `monthsAhead`, compounding annual depreciation. */
export function residualValue(currentUsd: number | null, monthsAhead: number, annualDepreciationPct?: number): number | null {
  if (currentUsd == null || currentUsd <= 0) return null;
  const rate = (annualDepreciationPct ?? 12) / 100;
  return Math.max(0, Math.round(currentUsd * Math.pow(1 - rate, monthsAhead / 12)));
}

// ─── 9. Regional spread (intra-UZ) ────────────────────────────────────────────
export interface RegionStat {
  city: string;
  median: number;
  n: number;
  deltaPct: number | null; // vs overall median
}
export function regionalSpread(listings: ListingLike[], opts?: { minSample?: number }): RegionStat[] {
  const min = opts?.minSample ?? 3;
  const overall = median(cleanCarPrices(listings.map((l) => Number(l.price_usd)).filter((n) => Number.isFinite(n) && n > 0)));
  const byCity = new Map<string, number[]>();
  for (const l of listings) {
    const c = (l.city || "").trim();
    const p = Number(l.price_usd);
    if (!c || !Number.isFinite(p) || p <= 0) continue;
    (byCity.get(c) || byCity.set(c, []).get(c)!).push(p);
  }
  const out: RegionStat[] = [];
  for (const [city, raw] of byCity) {
    const prices = cleanCarPrices(raw);
    if (prices.length < min) continue;
    const m = median(prices)!;
    out.push({ city, median: m, n: prices.length, deltaPct: overall && overall > 0 ? Math.round(((m - overall) / overall) * 1000) / 10 : null });
  }
  return out.sort((a, b) => (a.deltaPct ?? 0) - (b.deltaPct ?? 0)); // cheapest region first
}

// ─── 10. Regime-break detection ───────────────────────────────────────────────
// Flag when a model's incoming price distribution shifts structurally (a policy
// change, a new competitor dumping stock) so the engine says "assumptions changed".
export interface RegimeResult {
  broke: boolean;
  recentMean: number | null;
  priorMean: number | null;
  shiftPct: number | null;
  reason: string | null;
}
export function regimeBreak(listings: ListingLike[], opts?: { now?: number; windowDays?: number; shiftThresholdPct?: number }): RegimeResult {
  const now = opts?.now ?? Date.now();
  const win = (opts?.windowDays ?? 30) * DAY;
  const thr = opts?.shiftThresholdPct ?? 15;
  const recent: number[] = [];
  const prior: number[] = [];
  for (const l of listings) {
    const p = Number(l.price_usd);
    if (!Number.isFinite(p) || p <= 0) continue;
    const t = ts(l);
    if (!t) continue;
    const age = now - t;
    if (age <= win) recent.push(p);
    else if (age <= 2 * win) prior.push(p);
  }
  const rc = cleanCarPrices(recent);
  const pc = cleanCarPrices(prior);
  if (rc.length < 4 || pc.length < 4) return { broke: false, recentMean: null, priorMean: null, shiftPct: null, reason: null };
  const rMean = rc.reduce((a, b) => a + b, 0) / rc.length;
  const pMean = pc.reduce((a, b) => a + b, 0) / pc.length;
  const shiftPct = Math.round(((rMean - pMean) / pMean) * 1000) / 10;
  const pVar = pc.reduce((a, b) => a + (b - pMean) ** 2, 0) / pc.length;
  const rVar = rc.reduce((a, b) => a + (b - rMean) ** 2, 0) / rc.length;
  const varRatio = pVar > 0 ? rVar / pVar : 1;
  const broke = Math.abs(shiftPct) >= thr || varRatio > 3 || varRatio < 1 / 3;
  const reason = !broke ? null : Math.abs(shiftPct) >= thr ? `price ${shiftPct > 0 ? "jumped" : "dropped"} ${Math.abs(shiftPct)}%` : "volatility shift";
  return { broke, recentMean: Math.round(rMean), priorMean: Math.round(pMean), shiftPct, reason };
}

// ─── 11. VIN journey + odometer-rollback ──────────────────────────────────────
/** Extract a 17-char VIN (no I/O/Q) from text, or null. */
export function extractVin(text: string | null | undefined): string | null {
  const m = (text || "").toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  return m ? m[0] : null;
}

export interface VinJourney {
  vin: string;
  sightings: number;
  rollback: boolean; // odometer decreased over time
  firstKm: number | null;
  lastKm: number | null;
  priceDropUsd: number | null;
}
export function vinJourneys(listings: ListingLike[]): VinJourney[] {
  const byVin = new Map<string, ListingLike[]>();
  for (const l of listings) {
    const vin = extractVin(l.raw_text);
    if (!vin) continue;
    (byVin.get(vin) || byVin.set(vin, []).get(vin)!).push(l);
  }
  const out: VinJourney[] = [];
  for (const [vin, group] of byVin) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => firstTs(a) - firstTs(b));
    let rollback = false;
    let prevKm: number | null = null;
    for (const l of sorted) {
      const km = Number(l.mileage_km);
      if (Number.isFinite(km) && km >= 0) {
        if (prevKm != null && km < prevKm - 1000) rollback = true; // dropped >1000km = rollback
        prevKm = km;
      }
    }
    const firstPrice = Number(sorted[0].price_usd);
    const lastPrice = Number(sorted[sorted.length - 1].price_usd);
    const kmOf = (l: ListingLike) => (Number.isFinite(Number(l.mileage_km)) ? Number(l.mileage_km) : null);
    out.push({
      vin,
      sightings: group.length,
      rollback,
      firstKm: kmOf(sorted[0]),
      lastKm: kmOf(sorted[sorted.length - 1]),
      priceDropUsd: Number.isFinite(firstPrice) && Number.isFinite(lastPrice) ? Math.round(firstPrice - lastPrice) : null,
    });
  }
  return out.sort((a, b) => b.sightings - a.sightings);
}

// ─── 12. Cost-of-capital / holding cost ───────────────────────────────────────
// Cash tied up in slow stock has a real cost; UZ capital is expensive. Fold it
// into margin + markdown math so "high margin but sits 90 days" reads as the bad
// deal it often is.
export function holdingCost(vehicleCostUsd: number, daysHeld: number, opts?: { annualCapitalCostPct?: number; perDayFixedUsd?: number }): number {
  if (!(vehicleCostUsd > 0) || !(daysHeld > 0)) return 0;
  const rate = (opts?.annualCapitalCostPct ?? 24) / 100; // ~24%/yr capital cost in UZ
  const capital = vehicleCostUsd * rate * (daysHeld / 365);
  const fixed = (opts?.perDayFixedUsd ?? 0) * daysHeld;
  return Math.round(capital + fixed);
}
