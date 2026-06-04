import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFxRates } from "@/lib/fx-rate";
import { median } from "@/lib/market-intel";
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

    const [carsRes, marketRes, inqRes, watchRes, favRes, savedRes, poRes, cfgRes, fx] = await Promise.all([
      supabase.from("cars").select("id, brand, model, fuel_type").limit(MAX),
      supabase.from("market_listings").select("brand, model, price_usd, observed_at").gte("observed_at", since).not("price_usd", "is", null).limit(MAX),
      supabase.from("inquiries").select("car_id").not("car_id", "is", null).limit(MAX),
      supabase.from("price_watches").select("car_id").limit(MAX),
      supabase.from("favorites").select("car_id").limit(MAX),
      supabase.from("saved_searches").select("filters").limit(MAX),
      supabase.from("purchase_orders").select("brand, model, unit_cost_usd").not("unit_cost_usd", "is", null).limit(MAX),
      supabase.from("site_settings").select("values").eq("id", "import_config").maybeSingle(),
      getFxRates(supabase),
    ]);

    const config = mergeConfig(cfgRes.data?.values);

    // Pre-order demand (deposited = committed) keyed on the SAME brand|model key,
    // so made-to-order demand fuses with in-stock car demand. This is the signal
    // the buying brain was previously blind to (pre-orders reference
    // model_catalog, not cars). Used below once modelMeta is built.
    const preorderDemand = await aggregatePreorderDemand(supabase);

    // car_id → model key + a representative fuel for the model.
    const carToKey = new Map<string, string>();
    const modelMeta = new Map<string, { brand: string; model: string; fuel: FuelKind }>();
    for (const c of carsRes.data || []) {
      const k = key(c.brand as string, c.model as string);
      carToKey.set(c.id as string, k);
      if (!modelMeta.has(k)) modelMeta.set(k, { brand: c.brand as string, model: c.model as string, fuel: resolveFuelKind(c.fuel_type as string) });
    }

    // Market median per model.
    const marketByKey = new Map<string, { prices: number[]; dates: string[]; brand: string; model: string }>();
    for (const m of marketRes.data || []) {
      const k = key(m.brand as string, m.model as string);
      const g = marketByKey.get(k) || { prices: [], dates: [], brand: m.brand as string, model: m.model as string };
      g.prices.push(num(m.price_usd));
      if (m.observed_at) g.dates.push(m.observed_at as string);
      marketByKey.set(k, g);
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

    // Surface pre-order-only models too: a model nobody stocks but several
    // people pre-ordered is exactly what to import. Seed meta from the catalog.
    for (const [k, pd] of preorderDemand) {
      if (!modelMeta.has(k)) modelMeta.set(k, { brand: pd.brand, model: pd.model, fuel: "petrol" });
    }

    // Score every model that has market data OR demand OR pre-orders.
    const candidates = new Set<string>([...marketByKey.keys(), ...demand.keys(), ...preorderDemand.keys()]);
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

      const mk = marketByKey.get(k);
      const marketMedian = mk ? median(mk.prices) : null;
      const sampleSize = mk ? mk.prices.length : 0;
      const latest = mk && mk.dates.length ? mk.dates.sort().slice(-1)[0] : null;
      const freshnessDays = latest ? Math.floor((Date.now() - new Date(latest).getTime()) / 86_400_000) : null;

      const sup = supplierAgg.get(k);
      const supplierCostUsd = sup ? Math.round(sup.sum / sup.n) : null;

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
        supplierCostUsd,
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
