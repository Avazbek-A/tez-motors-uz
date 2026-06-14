/**
 * Market-price intelligence — pure helpers (no I/O, fully unit-tested).
 *
 * Turns observed OLX / Telegram / manual listings into a competitive picture:
 * parse messy UZ price strings → normalize to USD → dedupe → aggregate to a
 * per-model market median → profitability vs landed cost. The scraping itself
 * lives in an off-Workers collector; this is the math the website owns.
 */

export type RawCurrency = "usd" | "uzs" | "unknown";

export interface ParsedMoney {
  amount: number;
  currency: RawCurrency;
}

/**
 * Best-effort parse of a price out of a free-text listing fragment. Handles the
 * common Uzbek formats: "$15 000", "15 000 у.е.", "180 000 000 сум", "180 млн",
 * "14.5 mln". Returns null if no plausible price is found.
 */
export function parseMoney(text: string): ParsedMoney | null {
  if (!text) return null;
  const s = text.toLowerCase().replace(/ /g, " ");

  const hasUsd = /\$|у\.?\s?е\.?|y\.?\s?e\.?|usd|долл/.test(s);
  const hasUzs = /сум|so['’ ]?m|сўм|uzs|сом/.test(s);
  const million = /млн|mln|million|миллион/.test(s);
  const billion = /млрд|mlrd|миллиард|billion/.test(s);

  // Strip Uzbek phone numbers first — Telegram car posts are full of them
  // ("+998 90 123 45 67", "998901234567") and the "largest number" heuristic
  // would otherwise mistake a phone for the price.
  const sNoPhone = s
    .replace(/\+?998[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, " ")
    .replace(/\b998\d{9}\b/g, " ");
  // Grab the most prominent number (longest digit run, separators stripped).
  const matches = sNoPhone.match(/\d[\d\s.,]*\d|\d/g);
  if (!matches) return null;
  const nums = matches
    .map((m) => {
      const cleaned = m.replace(/[\s.,]/g, "");
      const n = parseInt(cleaned, 10);
      return Number.isFinite(n) ? n : NaN;
    })
    // Drop phone-length runs (≥ 11 digits) — never a car price (max ~6e9 UZS ≈ $475k).
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1e11);
  if (nums.length === 0) return null;

  // If a "million/billion" multiplier is present, the price is usually the
  // small leading number (e.g. "180 млн"). Otherwise take the largest number.
  let amount: number;
  if (billion || million) {
    // Use the first reasonably small number as the mantissa.
    const mantissa = nums.find((n) => n < 100000) ?? nums[0];
    amount = mantissa * (billion ? 1_000_000_000 : 1_000_000);
  } else {
    amount = Math.max(...nums);
  }

  let currency: RawCurrency = "unknown";
  if (hasUsd && !hasUzs) currency = "usd";
  else if (hasUzs && !hasUsd) currency = "uzs";
  else if (hasUsd && hasUzs) currency = "usd"; // price usually quoted in y.e.
  else {
    // No explicit currency: huge numbers are soum, small ones are USD/y.e.
    currency = amount >= 1_000_000 ? "uzs" : "usd";
  }

  return { amount, currency };
}

/** Normalize a parsed price to USD using the current USD/UZS rate. */
export function toUsd(money: ParsedMoney | null, usdUzs: number): number | null {
  if (!money || !(money.amount > 0)) return null;
  if (money.currency === "uzs") return usdUzs > 0 ? Math.round(money.amount / usdUzs) : null;
  // usd or unknown-treated-as-usd
  return Math.round(money.amount);
}

/** Convenience: parse + normalize in one call. */
export function priceToUsd(text: string, usdUzs: number): number | null {
  return toUsd(parseMoney(text), usdUzs);
}

/** Stable dedupe key for an observation. Prefers an explicit source ref. */
export function fingerprint(o: {
  source?: string | null;
  source_ref?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  price_usd?: number | null;
  city?: string | null;
}): string {
  if (o.source_ref) return `${o.source || "x"}:${o.source_ref}`.toLowerCase().slice(0, 200);
  return [o.source || "x", o.brand || "", o.model || "", o.year ?? "", o.price_usd ?? "", o.city || ""]
    .join("|")
    .toLowerCase()
    .slice(0, 200);
}

export function median(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2);
}

/** No real Chinese-import car sells below this; cheaper "matches" are parts /
 *  accessories / services / typos that keyword search drags in. */
export const CAR_PRICE_FLOOR_USD = 2000;

/**
 * Clean a price cluster before taking a market median. OLX/Telegram keyword
 * matching pulls in junk ($5 floor-mats under "Jolion", a rent-per-day rate, a
 * mistyped price), which wrecks the median. Two passes: (1) drop anything below
 * the car-price floor, (2) drop values far from the provisional median (wrong-
 * model matches / typos). Returns the kept comps. Pure.
 */
export function cleanCarPrices(prices: number[]): number[] {
  const floored = prices.filter((n) => Number.isFinite(n) && n >= CAR_PRICE_FLOOR_USD);
  if (floored.length < 2) return floored;
  const m0 = median(floored);
  if (m0 == null) return floored;
  return floored.filter((n) => n >= 0.4 * m0 && n <= 2.5 * m0);
}

export interface ModelGroup {
  brand: string;
  model: string;
  year: number | null;
  medianUsd: number | null;
  minUsd: number | null;
  maxUsd: number | null;
  count: number;
  latestObservedAt: string | null;
}

interface ListingLike {
  brand: string;
  model: string;
  year?: number | null;
  price_usd?: number | null;
  observed_at?: string | null;
}

const groupKey = (l: ListingLike) => `${l.brand}|${l.model}|${l.year ?? ""}`.toLowerCase();

/** Aggregate raw listings into a per-(brand, model, year) market summary. */
export function summarize(listings: ListingLike[]): ModelGroup[] {
  const buckets = new Map<string, ListingLike[]>();
  for (const l of listings) {
    if (!l.brand || !l.model) continue;
    const k = groupKey(l);
    const arr = buckets.get(k) || [];
    arr.push(l);
    buckets.set(k, arr);
  }

  const out: ModelGroup[] = [];
  for (const arr of buckets.values()) {
    // Clean junk/outliers before the median; `count` reflects the comps actually
    // used (real confidence), not the raw match count (which includes parts etc.).
    const prices = cleanCarPrices(arr.map((l) => Number(l.price_usd)).filter((n) => Number.isFinite(n) && n > 0));
    const dates = arr.map((l) => l.observed_at).filter(Boolean) as string[];
    out.push({
      brand: arr[0].brand,
      model: arr[0].model,
      year: arr[0].year ?? null,
      medianUsd: median(prices),
      minUsd: prices.length ? Math.min(...prices) : null,
      maxUsd: prices.length ? Math.max(...prices) : null,
      count: prices.length,
      latestObservedAt: dates.length ? dates.sort().slice(-1)[0] : null,
    });
  }
  // Most-sampled, freshest first.
  return out.sort((a, b) => b.count - a.count);
}

/** Margin if you sold at the market price, given your landed cost. */
export function profitability(
  marketUsd: number | null,
  landedUsd: number | null,
): { marginUsd: number | null; marginPct: number | null } {
  if (marketUsd == null || landedUsd == null || landedUsd <= 0) {
    return { marginUsd: null, marginPct: null };
  }
  const marginUsd = Math.round(marketUsd - landedUsd);
  const marginPct = Math.round((marginUsd / landedUsd) * 1000) / 10;
  return { marginUsd, marginPct };
}

// ─────────────────────────────────────────────────────────────────────────────
// Big-leap analytics: richer extraction, price trend, confidence, mileage-adjusted
// fair value. All pure + unit-tested (market-intel.test.ts). $0 — no LLM/network.
// ─────────────────────────────────────────────────────────────────────────────

/** Pull a km odometer reading out of free-text (UZ/RU listings). Null if none. */
export function extractMileageKm(text: string | null | undefined): number | null {
  if (!text) return null;
  const s = text.toLowerCase();
  // "120 000 км", "85000 km", "150 тыс км", "150 тыс. км" — letters break the
  // char-class so it can't span across words like "2.0 turbo". Lookahead instead
  // of \b: \b is false after Cyrillic "км" (Cyrillic isn't a JS word char).
  const m = s.match(/(\d[\d\s.,]{0,8}?)\s*(тыс\.?\s*)?(км|km)(?![a-zа-яё])/);
  if (!m) return null;
  let n = parseInt(m[1].replace(/[\s.,]/g, ""), 10);
  if (!Number.isFinite(n)) return null;
  if (m[2]) n *= 1000; // "150 тыс км" = 150 000
  if (n < 0 || n > 1_000_000) return null;
  return n;
}

/** Classify new vs used from free-text. Null when there's no clear signal. */
export function extractCondition(text: string | null | undefined): "new" | "used" | null {
  if (!text) return null;
  const s = text.toLowerCase();
  // "0 км" only counts as new when it's a standalone zero — not the trailing
  // "0 км" of "90000 км" (which is a used car). Lookbehind blocks a preceding digit.
  if (/(без пробега|(?<!\d)0\s*(км|km)(?![a-zа-яё]))/.test(s)) return "new";
  if (/(б\/?у|с пробегом|пробег|used|second[\s-]?hand)/.test(s)) return "used";
  if (/(нов(ый|ая|ое|ые)|\bnew\b|yangi)/.test(s)) return "new";
  return null;
}

export interface TrendResult {
  recentMedian: number | null;
  priorMedian: number | null;
  changePct: number | null; // + = market rising, − = falling
  recentCount: number;
  priorCount: number;
}

/**
 * Price trend per model: median of the recent window vs the window before it.
 * Uses last_seen_at (fresher signal) falling back to observed_at. `now` is an
 * arg so tests are deterministic.
 */
export function priceTrend(
  listings: { price_usd: number | null; observed_at?: string | null; last_seen_at?: string | null }[],
  opts?: { now?: number; windowDays?: number },
): TrendResult {
  const now = opts?.now ?? Date.now();
  const win = (opts?.windowDays ?? 30) * 86_400_000;
  const recent: number[] = [];
  const prior: number[] = [];
  for (const l of listings) {
    const p = Number(l.price_usd);
    if (!Number.isFinite(p) || p <= 0) continue;
    const t = Date.parse(l.last_seen_at || l.observed_at || "");
    if (!Number.isFinite(t)) continue;
    const age = now - t;
    if (age <= win) recent.push(p);
    else if (age <= 2 * win) prior.push(p);
  }
  const rc = cleanCarPrices(recent);
  const pc = cleanCarPrices(prior);
  const rm = median(rc);
  const pm = median(pc);
  const changePct = rm != null && pm != null && pm > 0 ? Math.round(((rm - pm) / pm) * 1000) / 10 : null;
  return { recentMedian: rm, priorMedian: pm, changePct, recentCount: rc.length, priorCount: pc.length };
}

export interface ConfidenceInput {
  sampleSize: number;
  freshnessDays: number | null; // age of the freshest comp
  spreadPct: number | null; // (max−min)/median ×100
  sourceCount?: number; // distinct sources (olx/avtoelon/telegram)
}

/** 0–1 trust score for a model's market read. More/fresher/tighter/diverse = higher. */
export function priceConfidence(i: ConfidenceInput): { score: number; label: "high" | "medium" | "low" } {
  const sample = Math.min(1, i.sampleSize / 12); // saturates ~12 comps
  const fresh = i.freshnessDays == null ? 0 : Math.max(0, Math.min(1, (60 - i.freshnessDays) / 53)); // 1 ≤7d → 0 ≥60d
  const spread = i.spreadPct == null ? 0.5 : Math.max(0, Math.min(1, 1 - i.spreadPct / 80)); // tight band = confident
  const src = Math.min(1, 0.4 + 0.2 * (i.sourceCount ?? 1)); // 1→.6, 2→.8, 3+→1
  const score = Math.round((0.4 * sample + 0.25 * fresh + 0.2 * spread + 0.15 * src) * 100) / 100;
  const label = score >= 0.66 ? "high" : score >= 0.4 ? "medium" : "low";
  return { score, label };
}

export interface MileageValue {
  value: number | null;
  perKm: number | null; // $ depreciation per km (negative)
  basis: "regression" | "flat" | "median";
}

/**
 * Mileage-adjusted fair value: OLS of price on odometer across comps, evaluated at
 * targetKm. Falls back to a flat −$0.08/km off the median when comps are thin or the
 * regression is degenerate (positive/absurd slope). The hedonic core for used-car
 * (trade-in) valuation — a 30k-km car and a 150k-km car are not the same median.
 */
export function mileageAdjustedValue(
  comps: { price_usd: number | null; mileage_km: number | null }[],
  targetKm: number,
): MileageValue {
  const pts = comps
    .map((c) => ({ p: Number(c.price_usd), km: Number(c.mileage_km) }))
    .filter((c) => Number.isFinite(c.p) && c.p > 0 && Number.isFinite(c.km) && c.km >= 0 && c.km < 600_000);
  const med = median(cleanCarPrices(pts.map((p) => p.p)));

  if (pts.length < 4) return { value: med, perKm: null, basis: "median" };

  const n = pts.length;
  const mx = pts.reduce((a, c) => a + c.km, 0) / n;
  const my = pts.reduce((a, c) => a + c.p, 0) / n;
  let num = 0;
  let den = 0;
  for (const c of pts) {
    num += (c.km - mx) * (c.p - my);
    den += (c.km - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;

  // Degenerate slope (rises with km, or steeper than −$2/km) → flat depreciation.
  if (den === 0 || slope > 0 || slope < -2) {
    if (med == null) return { value: null, perKm: null, basis: "median" };
    const flat = -0.08;
    return { value: Math.max(0, Math.round(med + flat * (targetKm - mx))), perKm: flat, basis: "flat" };
  }
  const intercept = my - slope * mx;
  return {
    value: Math.max(0, Math.round(intercept + slope * targetKm)),
    perKm: Math.round(slope * 100) / 100,
    basis: "regression",
  };
}
