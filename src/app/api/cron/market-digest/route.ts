import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { summarize, median } from "@/lib/market-intel";
import { buildMarketDigest, type MarketRow } from "@/lib/market-digest";
import { sendDealerDigest } from "@/lib/cron/dealer-digest";
import { reportServerError, logEvent } from "@/lib/error-report";

/**
 * Weekly market-intelligence digest to the dealer: which of your cars are priced
 * above/below the OLX/Telegram market median, and which in-demand models you
 * don't list yet. Reuses the same summarize()/median() the Market Intel stats
 * route uses. Fail-open.
 */
const WINDOW_DAYS = 90;
const MAX_ROWS = 5000;

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

    const [listingsRes, carsRes] = await Promise.all([
      supabase.from("market_listings").select("brand, model, year, price_usd, observed_at").gte("observed_at", since).not("price_usd", "is", null).limit(MAX_ROWS),
      supabase.from("cars").select("brand, model, price_usd, inventory_status").neq("inventory_status", "sold").limit(MAX_ROWS),
    ]);

    const groups = summarize(listingsRes.data || []);
    const ourPrices = new Map<string, number[]>();
    for (const c of carsRes.data || []) {
      const key = `${c.brand}|${c.model}`.toLowerCase();
      const p = Number(c.price_usd);
      if (Number.isFinite(p) && p > 0) ourPrices.set(key, [...(ourPrices.get(key) || []), p]);
    }

    const rows: MarketRow[] = groups.map((g) => {
      const key = `${g.brand}|${g.model}`.toLowerCase();
      const ours = ourPrices.has(key) ? median(ourPrices.get(key)!) : null;
      const vsMarketPct = ours != null && g.medianUsd != null && g.medianUsd > 0 ? Math.round(((ours - g.medianUsd) / g.medianUsd) * 1000) / 10 : null;
      return { brand: g.brand, model: g.model, medianUsd: g.medianUsd, count: g.count, ourPriceUsd: ours, weSell: ours != null, vsMarketPct };
    });

    const lines = buildMarketDigest(rows, "ru");
    await sendDealerDigest("📊 Tez Motors — рынок за неделю", lines);

    logEvent("cron.market_digest", { models: rows.length, listings: (listingsRes.data || []).length });
    return NextResponse.json({ ok: true, models: rows.length });
  } catch (error) {
    reportServerError("GET /api/cron/market-digest", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
