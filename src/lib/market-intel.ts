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

  // Grab the most prominent number (longest digit run, separators stripped).
  const matches = s.match(/\d[\d\s.,]*\d|\d/g);
  if (!matches) return null;
  const nums = matches
    .map((m) => {
      const cleaned = m.replace(/[\s.,]/g, "");
      const n = parseInt(cleaned, 10);
      return Number.isFinite(n) ? n : NaN;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
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
    const prices = arr.map((l) => Number(l.price_usd)).filter((n) => Number.isFinite(n) && n > 0);
    const dates = arr.map((l) => l.observed_at).filter(Boolean) as string[];
    out.push({
      brand: arr[0].brand,
      model: arr[0].model,
      year: arr[0].year ?? null,
      medianUsd: median(prices),
      minUsd: prices.length ? Math.min(...prices) : null,
      maxUsd: prices.length ? Math.max(...prices) : null,
      count: arr.length,
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
