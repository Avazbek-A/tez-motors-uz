import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFxRates } from "@/lib/fx-rate";
import { median, cleanCarPrices, priceTrend, priceConfidence } from "@/lib/market-intel";
import { baseModelKey } from "@/lib/model-normalize";
import {
  computeLandedCost,
  suggestedListPrice,
  resolveFuelKind,
  DEFAULT_IMPORT_CONFIG,
  FUEL_KINDS,
  type ImportConfig,
  type FuelKind,
} from "@/lib/import-cost";
import { demandScore, opportunityScore, verdict, recommendedQty } from "@/lib/buying-brain";
import { aggregatePreorderDemand, modelKey } from "@/lib/procurement-demand";
import { freightPerUnit } from "@/lib/freight";

/**
 * Buying & pricing brain — fuses demand (inquiries/saved-searches/watches/
 * favorites) × market price (OLX/Telegram median) × landed cost (UZ customs
 * engine, on supplier cost from PO history / model catalog) into a ranked
 * "what to import, how many, at what price" recommendation. Read-only, admin.
 */
const MAX = 5000;
const MARKET_WINDOW_DAYS = 120;
const key = (brand: string, model: string) => `${brand}|${model}`.toLowerCase();

function mergeConfig(stored: unknown): ImportConfig {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<ImportConfig>;
  const rates = { ...DEFAULT_IMPORT_CONFIG.rates };
  for (const f of FUEL_KINDS) rates[f] = { ...DEFAULT_IMPORT_CONFIG.rates[f], ...(s.rates?.[f] ?? {}) };
  return {
    rates,
    fees: { ...DEFAULT_IMPORT_CONFIG.fees, ...(s.fees ?? {}) },
    targetMarginPct: typeof s.targetMarginPct === "number" ? s.targetMarginPct : DEFAULT_IMPORT_CONFIG.targetMarginPct,
  };
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - MARKET_WINDOW_DAYS * 86_400_000).toISOString();
    const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

    const [carsRes, marketRes, inqRes, watchRes, favRes, savedRes, poRes, sourceRes, cfgRes, fx] = await Promise.all([
      supabase.from("cars").select("id, brand, model, fuel_type, spec_data").limit(MAX),
      supabase.from("market_listings").select("brand, model, price_usd, observed_at, last_seen_at, source").gte("observed_at", since).not("price_usd", "is", null).limit(MAX),
      supabase.from("inquiries").select("car_id").not("car_id", "is", null).limit(MAX),
      supabase.from("price_watches").select("car_id").limit(MAX),
      supabase.from("favorites").select("car_id").limit(MAX),
      supabase.from("saved_searches").select("filters").limit(MAX),
      supabase.from("purchase_orders").select("brand, model, unit_cost_usd").not("unit_cost_usd", "is", null).limit(MAX),
      supabase.from("source_prices").select("brand, model, price_usd, observed_at").not("price_usd", "is", null).order("observed_at", { ascending: false }).limit(MAX).then((r) => r, () => ({ data: [] })),
      supabase.from("site_settings").select("values").eq("id", "import_config").maybeSingle(),
      getFxRates(supabase),
    ]);

    const config = mergeConfig(cfgRes.data?.values);

    // Pre-order demand (deposited = committed) keyed on the SAME brand|model key,
    // so made-to-order demand fuses with in-stock car demand. This is the signal
    // the buying brain was previously blind to (pre-orders reference
    // model_catalog, not cars). Used below once modelMeta is built.
    const preorderDemand = await aggregatePreorderDemand(supabase);

    // Cheapest China retail price (AutoHome trim price_raw, "26.35万" = 263 500 ¥)
    // → USD, as a LAST-RESORT cost proxy for models with no RFQ/PO cost. It's the
    // Chinese MSRP (dealers buy at/below it), so it's a conservative upper bound —
    // surfaced only with costSource='china_estimate' so the dealer treats it as such.
    const chinaCostUsd = (spec: unknown): number | null => {
      const trims = (spec as { trims?: { price_raw?: string | null }[] } | null)?.trims;
      if (!Array.isArray(trims)) return null;
      let minCny = Infinity;
      for (const t of trims) {
        const m = String(t?.price_raw || "").match(/([\d.]+)\s*万/);
        if (m) { const cny = parseFloat(m[1]) * 10_000; if (cny > 0 && cny < minCny) minCny = cny; }
      }
      if (!Number.isFinite(minCny) || !(fx.cny_usd > 0)) return null;
      return Math.round(minCny * fx.cny_usd);
    };

    // car_id → model key + a representative fuel for the model. Also the China-price
    // cost proxy per model key (first non-null wins).
    const carToKey = new Map<string, string>();
    const modelMeta = new Map<string, { brand: string; model: string; fuel: FuelKind }>();
    const chinaCostByKey = new Map<string, number>();
    for (const c of carsRes.data || []) {
      const k = key(c.brand as string, c.model as string);
      carToKey.set(c.id as string, k);
      if (!modelMeta.has(k)) modelMeta.set(k, { brand: c.brand as string, model: c.model as string, fuel: resolveFuelKind(c.fuel_type as string) });
      if (!chinaCostByKey.has(k)) { const cc = chinaCostUsd(c.spec_data); if (cc != null) chinaCostByKey.set(k, cc); }
    }

    // Market median per model. Also bucket by BASE-model key (trim/chassis/year
    // stripped) so a catalog car like "H6 2.0T" picks up "H6" market comps when it
    // has no exact-key listings — without merging genuinely distinct models.
    type MLite = { price_usd: number; observed_at: string | null; last_seen_at: string | null; source: string };
    const marketByKey = new Map<string, { listings: MLite[]; brand: string; model: string }>();
    const marketByBase = new Map<string, { listings: MLite[] }>();
    for (const m of marketRes.data || []) {
      const lite: MLite = {
        price_usd: num(m.price_usd),
        observed_at: (m.observed_at as string) ?? null,
        last_seen_at: (m.last_seen_at as string) ?? null,
        source: (m.source as string) ?? "other",
      };
      const k = key(m.brand as string, m.model as string);
      const g = marketByKey.get(k) || { listings: [], brand: m.brand as string, model: m.model as string };
      g.listings.push(lite);
      marketByKey.set(k, g);
      const bk = baseModelKey(m.brand as string, m.model as string);
      const gb = marketByBase.get(bk) || { listings: [] };
      gb.listings.push(lite);
      marketByBase.set(bk, gb);
      if (!modelMeta.has(k)) modelMeta.set(k, { brand: m.brand as string, model: m.model as string, fuel: "petrol" });
    }

    // Demand counters per model (+ brand-level saved searches).
    const demand = new Map<string, { inquiries: number; watches: number; favorites: number }>();
    const bump = (k: string | undefined, field: "inquiries" | "watches" | "favorites") => {
      if (!k) return;
      const d = demand.get(k) || { inquiries: 0, watches: 0, favorites: 0 };
      d[field] += 1;
      demand.set(k, d);
    };
    for (const r of inqRes.data || []) bump(carToKey.get(r.car_id as string), "inquiries");
    for (const r of watchRes.data || []) bump(carToKey.get(r.car_id as string), "watches");
    for (const r of favRes.data || []) bump(carToKey.get(r.car_id as string), "favorites");

    const savedByBrand = new Map<string, number>();
    for (const r of savedRes.data || []) {
      const f = (r.filters || {}) as { brand?: string };
      if (f.brand) savedByBrand.set(f.brand.toLowerCase(), (savedByBrand.get(f.brand.toLowerCase()) || 0) + 1);
    }

    // Supplier cost per model (avg of PO unit costs).
    const supplierAgg = new Map<string, { sum: number; n: number }>();
    for (const p of poRes.data || []) {
      const k = key(p.brand as string, p.model as string);
      const a = supplierAgg.get(k) || { sum: 0, n: 0 };
      a.sum += num(p.unit_cost_usd);
      a.n += 1;
      supplierAgg.set(k, a);
      if (!modelMeta.has(k)) modelMeta.set(k, { brand: p.brand as string, model: p.model as string, fuel: "petrol" });
    }

    // Forward source cost per model (latest RFQ quote, USD). Rows are ordered
    // newest-first, so the first seen per model is the most recent — this beats
    // PO history because it reflects what the supplier quotes RIGHT NOW.
    const sourceCostByKey = new Map<string, number>();
    for (const s of (sourceRes.data as { brand: string; model: string; price_usd: number }[]) || []) {
      const k = key(s.brand, s.model);
      if (!sourceCostByKey.has(k)) sourceCostByKey.set(k, num(s.price_usd));
      if (!modelMeta.has(k)) modelMeta.set(k, { brand: s.brand, model: s.model, fuel: "petrol" });
    }

    // Surface pre-order-only models too: a model nobody stocks but several
    // people pre-ordered is exactly what to import. Seed meta from the catalog.
    for (const [k, pd] of preorderDemand) {
      if (!modelMeta.has(k)) modelMeta.set(k, { brand: pd.brand, model: pd.model, fuel: "petrol" });
    }

    // Score every model that has market data OR demand OR pre-orders OR a quote.
    const candidates = new Set<string>([...marketByKey.keys(), ...demand.keys(), ...preorderDemand.keys(), ...sourceCostByKey.keys()]);
    const rows = [];
    for (const k of candidates) {
      const meta = modelMeta.get(k);
      if (!meta) continue;
      const d = demand.get(k) || { inquiries: 0, watches: 0, favorites: 0 };
      const savedSearches = savedByBrand.get(meta.brand.toLowerCase()) || 0;
      const pre = preorderDemand.get(k) || { total: 0, deposited: 0 };
      const dScore = demandScore({
        inquiries: d.inquiries,
        watches: d.watches,
        favorites: d.favorites,
        savedSearches,
        preordersTotal: pre.total,
        preordersDeposited: pre.deposited,
      });

      // Exact brand|model comps, else fall back to base-model comps (H6 2.0T → H6).
      const mk = marketByKey.get(k) || marketByBase.get(baseModelKey(meta.brand, meta.model)) || null;
      const listings = mk?.listings ?? [];
      // Clean parts/junk/outliers out of the comp cloud before the median, and
      // report the cleaned sample as the confidence signal.
      const cleanedPrices = cleanCarPrices(listings.map((l) => l.price_usd));
      const marketMedian = cleanedPrices.length ? median(cleanedPrices) : null;
      const sampleSize = cleanedPrices.length;
      // Freshness from last_seen_at (re-scrape time) falling back to observed_at.
      const times = listings.map((l) => Date.parse(l.last_seen_at || l.observed_at || "")).filter((t) => Number.isFinite(t));
      const latestMs = times.length ? Math.max(...times) : null;
      const freshnessDays = latestMs ? Math.floor((Date.now() - latestMs) / 86_400_000) : null;
      // Spread, source diversity, trend, confidence — the "why" behind the median.
      const spreadPct =
        marketMedian && marketMedian > 0 && cleanedPrices.length > 1
          ? Math.round(((Math.max(...cleanedPrices) - Math.min(...cleanedPrices)) / marketMedian) * 1000) / 10
          : null;
      const sourceCount = new Set(listings.map((l) => l.source)).size;
      const trend = priceTrend(listings, { windowDays: 30 });
      const conf = priceConfidence({ sampleSize, freshnessDays, spreadPct, sourceCount });

      // Prefer a current RFQ source price over PO-history average — it reflects
      // what the supplier quotes now, not what we paid in the past.
      const sup = supplierAgg.get(k);
      const poAvgCostUsd = sup ? Math.round(sup.sum / sup.n) : null;
      const sourceCostUsd = sourceCostByKey.get(k) ?? null;
      // RFQ (now) → PO history (past) → China-retail estimate (last resort).
      const chinaEstUsd = chinaCostByKey.get(k) ?? null;
      const supplierCostUsd = sourceCostUsd ?? poAvgCostUsd ?? chinaEstUsd;
      const costSource = sourceCostUsd != null ? "rfq" : poAvgCostUsd != null ? "po_history" : chinaEstUsd != null ? "china_estimate" : null;

      let landedCostUsd: number | null = null;
      let marginUsd: number | null = null;
      let marginPct: number | null = null;
      let suggestedPriceUsd: number | null = null;
      if (supplierCostUsd != null) {
        const breakdown = computeLandedCost({
          vehiclePriceUsd: supplierCostUsd,
          freightUsd: config.fees.freightUsd,
          clearanceUsd: config.fees.clearanceUsd,
          inlandLogisticsUsd: config.fees.inlandLogisticsUsd,
          otherUsd: config.fees.otherUsd,
          rates: config.rates[meta.fuel],
        });
        landedCostUsd = breakdown.landedCostUsd;
        suggestedPriceUsd = suggestedListPrice(landedCostUsd, config.targetMarginPct);
        if (marketMedian != null && landedCostUsd > 0) {
          marginUsd = Math.round(marketMedian - landedCostUsd);
          marginPct = Math.round((marginUsd / landedCostUsd) * 1000) / 10;
        }
      }

      const score = opportunityScore({ demandScore: dScore, marginPct, sampleSize, freshnessDays });
      rows.push({
        brand: meta.brand,
        model: meta.model,
        fuel: meta.fuel,
        demand: { ...d, savedSearches },
        preorders: { total: pre.total, deposited: pre.deposited },
        committed: pre.deposited > 0, // money is down — import against this first
        demandScore: dScore,
        marketMedianUsd: marketMedian,
        marketSample: sampleSize,
        marketFreshnessDays: freshnessDays,
        marketSpreadPct: spreadPct,
        marketSources: sourceCount,
        marketTrendPct: trend.changePct, // + rising, − falling (last 30d vs prior 30d)
        confidence: conf.score, // 0–1 trust in this market read
        confidenceLabel: conf.label,
        supplierCostUsd,
        costSource,
        costEstimated: costSource === "china_estimate", // cost is a China-retail proxy, not a real quote
        landedCostUsd,
        marginUsd,
        marginPct,
        suggestedPriceUsd,
        opportunityScore: score,
        verdict: verdict(score, marginPct),
        // Never recommend fewer than the units already paid for via deposits.
        recommendedQty: Math.max(recommendedQty(dScore, marginPct), pre.deposited),
        // Advisory: per-unit freight if the recommended qty ships consolidated
        // (vs the flat single-unit rate) — shows the consolidation upside.
        freightPerUnitUsd: freightPerUnit(Math.max(recommendedQty(dScore, marginPct), pre.deposited, 1)).perUnitUsd,
      });
    }

    rows.sort((a, b) => b.opportunityScore - a.opportunityScore);
    return NextResponse.json({ ok: true, fx, count: rows.length, recommendations: rows.slice(0, 100) });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute buying recommendations" }, { status: 500 });
  }
}
