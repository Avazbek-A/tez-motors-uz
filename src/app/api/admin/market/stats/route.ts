import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { summarize, median } from "@/lib/market-intel";

/**
 * Market intelligence summary: per-model market median (+range, sample size,
 * freshness) from recent listings, annotated with YOUR current list price for
 * that model so you can see where you sit vs the market and which models look
 * profitable to import. Read-only, admin-gated, service-role.
 */
const WINDOW_DAYS = 90;
const MAX_ROWS = 5000;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

    const [listingsRes, carsRes] = await Promise.all([
      supabase
        .from("market_listings")
        .select("brand, model, year, price_usd, observed_at")
        .gte("observed_at", since)
        .not("price_usd", "is", null)
        .limit(MAX_ROWS),
      supabase.from("cars").select("brand, model, price_usd, inventory_status").neq("inventory_status", "sold").limit(MAX_ROWS),
    ]);

    const groups = summarize(listingsRes.data || []);

    // Our list price by brand|model (median across our available units).
    const ourPrices = new Map<string, number[]>();
    for (const c of carsRes.data || []) {
      const key = `${c.brand}|${c.model}`.toLowerCase();
      const p = Number(c.price_usd);
      if (Number.isFinite(p) && p > 0) {
        const arr = ourPrices.get(key) || [];
        arr.push(p);
        ourPrices.set(key, arr);
      }
    }

    const rows = groups.map((g) => {
      const key = `${g.brand}|${g.model}`.toLowerCase();
      const ours = ourPrices.has(key) ? median(ourPrices.get(key)!) : null;
      const vsMarketPct =
        ours != null && g.medianUsd != null && g.medianUsd > 0
          ? Math.round(((ours - g.medianUsd) / g.medianUsd) * 1000) / 10
          : null;
      return { ...g, ourPriceUsd: ours, weSell: ours != null, vsMarketPct };
    });

    return NextResponse.json({
      ok: true,
      windowDays: WINDOW_DAYS,
      totalListings: (listingsRes.data || []).length,
      models: rows.length,
      rows,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute market stats" }, { status: 500 });
  }
}
