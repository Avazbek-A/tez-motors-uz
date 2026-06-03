/**
 * Weekly market-intelligence digest — turns the passive Market Intel table into
 * a proactive pricing nudge for the dealer. Pure + unit-tested; the cron
 * (api/cron/market-digest) feeds it the same per-model rows the stats route
 * computes and ships the lines via sendDealerDigest.
 */
export interface MarketRow {
  brand: string;
  model: string;
  medianUsd: number | null;
  count: number;
  ourPriceUsd: number | null;
  weSell: boolean;
  vsMarketPct: number | null;
}

/** A model needs at least this many sampled listings before we trust its median. */
export const MIN_SAMPLE = 2;
/** How far from the market median is worth flagging (percent). */
export const PRICE_GAP_PCT = 8;
/** Sample size that makes a model-you-don't-sell a real "opportunity". */
export const OPPORTUNITY_SAMPLE = 4;

const usd = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-US");

const COPY = {
  ru: { none: "Свежих рыночных данных пока мало — соберите больше через коллекторы OLX/Telegram.", over: "Выше рынка (стоит пересмотреть цену):", under: "Ниже рынка (есть запас поднять):", opp: "Спрос есть, а у вас нет в каталоге:", sample: "объявл." },
  uz: { none: "Bozor ma'lumotlari hali kam — OLX/Telegram kollektorlari orqali ko'proq yig'ing.", over: "Bozordan yuqori (narxni ko'rib chiqing):", under: "Bozordan past (ko'tarish imkoni bor):", opp: "Talab bor, lekin katalogingizda yo'q:", sample: "e'lon" },
  en: { none: "Not much fresh market data yet — collect more via the OLX/Telegram collectors.", over: "Above market (consider lowering):", under: "Below market (room to raise):", opp: "In demand but not in your catalog:", sample: "listings" },
};

function L(locale: string): "ru" | "uz" | "en" {
  return locale === "uz" ? "uz" : locale === "en" ? "en" : "ru";
}

/** Build the digest lines from per-model market rows. Deterministic. */
export function buildMarketDigest(rows: MarketRow[], locale = "ru"): string[] {
  const l = L(locale);
  const c = COPY[l];
  const reliable = rows.filter((r) => r.medianUsd != null && r.count >= MIN_SAMPLE);

  const over = reliable
    .filter((r) => r.weSell && (r.vsMarketPct ?? 0) >= PRICE_GAP_PCT)
    .sort((a, b) => (b.vsMarketPct ?? 0) - (a.vsMarketPct ?? 0))
    .slice(0, 5);
  const under = reliable
    .filter((r) => r.weSell && (r.vsMarketPct ?? 0) <= -PRICE_GAP_PCT)
    .sort((a, b) => (a.vsMarketPct ?? 0) - (b.vsMarketPct ?? 0))
    .slice(0, 5);
  const opps = reliable
    .filter((r) => !r.weSell && r.count >= OPPORTUNITY_SAMPLE)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (over.length === 0 && under.length === 0 && opps.length === 0) return [c.none];

  const lines: string[] = [];
  const name = (r: MarketRow) => `${r.brand} ${r.model}`;
  if (over.length) {
    lines.push(c.over);
    for (const r of over) lines.push(`• ${name(r)}: ваша ${usd(r.ourPriceUsd!)} vs рынок ${usd(r.medianUsd!)} (+${r.vsMarketPct}%)`);
  }
  if (under.length) {
    lines.push(c.under);
    for (const r of under) lines.push(`• ${name(r)}: ваша ${usd(r.ourPriceUsd!)} vs рынок ${usd(r.medianUsd!)} (${r.vsMarketPct}%)`);
  }
  if (opps.length) {
    lines.push(c.opp);
    for (const r of opps) lines.push(`• ${name(r)}: рынок ${usd(r.medianUsd!)} · ${r.count} ${c.sample}`);
  }
  return lines;
}
