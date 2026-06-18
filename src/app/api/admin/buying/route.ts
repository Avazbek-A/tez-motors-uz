import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFxRates } from "@/lib/fx-rate";
import { median, cleanCarPrices, priceTrend, priceConfidence } from "@/lib/market-intel";
import {
  dedupeListings,
  classifySeller,
  extractPhone,
  shrinkEstimate,
  predictionInterval,
  regimeBreak,
  holdingCost,
  inferSold,
  negotiationBand,
  priceElasticity,
  residualValue,
  estimateAnnualDepreciation,
  regionalSpread,
  type ListingLike,
} from "@/lib/market-analytics";
import { baseModelKey } from "@/lib/model-normalize";
import {
  suggestedListPrice,
  resolveFuelKind,
  DEFAULT_IMPORT_CONFIG,
  FUEL_KINDS,
  type ImportConfig,
  type FuelKind,
} from "@/lib/import-cost";
import { finalCarPrice } from "@/lib/final-price";
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
    const NOW_YEAR = new Date().getFullYear();
    const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

    const [carsRes, marketRes, inqRes, watchRes, favRes, savedRes, poRes, sourceRes, cfgRes, fx] = await Promise.all([
      supabase.from("cars").select("id, brand, model, fuel_type, spec_data").limit(MAX),
      supabase.from("market_listings").select("brand, model, price_usd, observed_at, last_seen_at, source, raw_text, city, year, mileage_km").gte("observed_at", since).not("price_usd", "is", null).limit(MAX),
      supabase.from("inquiries").select("car_id, created_at").not("car_id", "is", null).limit(MAX),
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

    // Market listings → clean comp clouds. (1) build full rows, (2) count phones
    // to spot bulk sellers, (3) tag dealer vs private, (4) DEDUPE cross-source so
    // the same car on OLX+avtoelon+Telegram counts once, (5) group by model + base
    // model (trim/chassis/year stripped) so "H6 2.0T" picks up "H6" comps.
    type MLite = ListingLike & { price_usd: number; brand: string; model: string; seller: "dealer" | "private" };
    const allListings: MLite[] = (marketRes.data || []).map((m) => ({
      price_usd: num(m.price_usd),
      brand: m.brand as string,
      model: m.model as string,
      observed_at: (m.observed_at as string) ?? null,
      last_seen_at: (m.last_seen_at as string) ?? null,
      source: (m.source as string) ?? "other",
      raw_text: (m.raw_text as string) ?? null,
      city: (m.city as string) ?? null,
      year: (m.year as number) ?? null,
      mileage_km: (m.mileage_km as number) ?? null,
      seller: "private",
    }));
    const phoneCounts = new Map<string, number>();
    for (const l of allListings) {
      const p = extractPhone(l.raw_text);
      if (p) phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
    }
    for (const l of allListings) {
      const p = extractPhone(l.raw_text);
      l.seller = classifySeller(l.raw_text, { phoneListingCount: p ? phoneCounts.get(p) : 0 });
    }
    const deduped = dedupeListings(allListings);

    const marketByKey = new Map<string, { listings: MLite[]; brand: string; model: string }>();
    const marketByBase = new Map<string, { listings: MLite[] }>();
    const brandPrices = new Map<string, number[]>(); // for Bayesian shrinkage of thin models
    for (const lite of deduped) {
      const k = key(lite.brand, lite.model);
      const g = marketByKey.get(k) || { listings: [], brand: lite.brand, model: lite.model };
      g.listings.push(lite);
      marketByKey.set(k, g);
      const bk = baseModelKey(lite.brand, lite.model);
      const gb = marketByBase.get(bk) || { listings: [] };
      gb.listings.push(lite);
      marketByBase.set(bk, gb);
      const bl = lite.brand.toLowerCase();
      (brandPrices.get(bl) || brandPrices.set(bl, []).get(bl)!).push(lite.price_usd);
      if (!modelMeta.has(k)) modelMeta.set(k, { brand: lite.brand, model: lite.model, fuel: "petrol" });
    }
    const brandMeanByBrand = new Map<string, number>();
    for (const [b, raw] of brandPrices) {
      const clean = cleanCarPrices(raw);
      if (clean.length) brandMeanByBrand.set(b, Math.round(clean.reduce((a, n) => a + n, 0) / clean.length));
    }

    // Demand counters per model (+ brand-level saved searches).
    const demand = new Map<string, { inquiries: number; watches: number; favorites: number }>();
    const bump = (k: string | undefined, field: "inquiries" | "watches" | "favorites") => {
      if (!k) return;
      const d = demand.get(k) || { inquiries: 0, watches: 0, favorites: 0 };
      d[field] += 1;
      demand.set(k, d);
    };
    // Demand momentum (forecast signal): recent-30d vs prior-30d inquiry counts
    // per model → is interest accelerating? Buy ahead of a rising curve.
    const nowMs = Date.now();
    const demandMomentum = new Map<string, { recent: number; prior: number }>();
    for (const r of inqRes.data || []) {
      bump(carToKey.get(r.car_id as string), "inquiries");
      const k = carToKey.get(r.car_id as string);
      const t = Date.parse((r.created_at as string) || "");
      if (!k || !t) continue;
      const age = nowMs - t;
      const dm = demandMomentum.get(k) || { recent: 0, prior: 0 };
      if (age <= 30 * 86_400_000) dm.recent += 1;
      else if (age <= 60 * 86_400_000) dm.prior += 1;
      demandMomentum.set(k, dm);
    }
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
    const sourceHistByKey = new Map<string, { price_usd: number; observed_at: string | null }[]>(); // for cost-trend (AutoHome/RFQ leading indicator)
    for (const s of (sourceRes.data as { brand: string; model: string; price_usd: number; observed_at: string }[]) || []) {
      const k = key(s.brand, s.model);
      if (!sourceCostByKey.has(k)) sourceCostByKey.set(k, num(s.price_usd));
      (sourceHistByKey.get(k) || sourceHistByKey.set(k, []).get(k)!).push({ price_usd: num(s.price_usd), observed_at: s.observed_at ?? null });
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

      // Dealer-vs-private split: private asks = your acquisition cost; dealer asks
      // = competitor retail (your resale ceiling). Anchor accordingly.
      const privClean = cleanCarPrices(listings.filter((l) => l.seller === "private").map((l) => l.price_usd));
      const dealClean = cleanCarPrices(listings.filter((l) => l.seller === "dealer").map((l) => l.price_usd));
      const acquisitionMedianUsd = privClean.length >= 3 ? median(privClean) : marketMedian;
      const resaleCeilingUsd = dealClean.length >= 3 ? median(dealClean) : null;

      // Bayesian shrinkage: thin models partial-pool toward their brand mean, so a
      // 1-comp read isn't taken at face value. Use the shrunk value as the margin
      // anchor when the sample is thin.
      const brandMean = brandMeanByBrand.get(meta.brand.toLowerCase()) ?? null;
      const shrunkMedianUsd = shrinkEstimate(marketMedian, sampleSize, brandMean);
      const effectiveMedian = sampleSize >= 3 ? marketMedian : shrunkMedianUsd;
      const interval = predictionInterval(effectiveMedian, cleanedPrices);
      const regime = regimeBreak(listings, { windowDays: 30 });

      // Sold-price / time-to-sell inference (sharpens as lifecycle data accrues).
      const sold = inferSold(listings, { staleDays: 14 });
      const estDaysToSell = sold.medianDaysToSell ?? 60; // assume 60d when no sold data yet

      const mom = demandMomentum.get(k);
      const demandTrendPct = mom ? (mom.prior > 0 ? Math.round(((mom.recent - mom.prior) / mom.prior) * 100) : mom.recent > 0 ? 100 : null) : null;

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
      let holdingCostUsd: number | null = null;
      let netMarginUsd: number | null = null;
      let netMarginPct: number | null = null;
      if (supplierCostUsd != null) {
        // Landed cost via the AUTHORITATIVE, law-cited customs engine (customs-uz),
        // the same matrix the public calculator + Telegram bot use — so the buy-side
        // and the customer-facing quote can never disagree. The dealer imports NEW,
        // certificate-of-origin cars from China → age defaults to "new", origin to
        // "certified". The per-cm³ duty term only bites petrol/diesel, so a
        // representative 2.0 L stands in at the model level (the exact cc refines
        // per-unit in the quote/calculator). customs-uz already charges the official
        // 2.5-BRV customs fee + the law-based utilization fee, so the dealer's own
        // flat fees (broker clearance, local delivery, misc) fold into inland.
        const fp = finalCarPrice({
          carUsd: supplierCostUsd,
          fuelType: meta.fuel,
          origin: "certified",
          engineCc: meta.fuel === "petrol" || meta.fuel === "diesel" ? 2000 : 0,
          freightUsd: config.fees.freightUsd,
          certUsd: config.rates[meta.fuel].certificationUsd,
          inlandUsd: config.fees.inlandLogisticsUsd + config.fees.clearanceUsd + config.fees.otherUsd,
          marginPct: config.targetMarginPct,
          usdUzs: fx.usd_uzs,
        });
        landedCostUsd = fp.landedUsd;
        suggestedPriceUsd = suggestedListPrice(landedCostUsd, config.targetMarginPct);
        // Margin vs the effective (shrinkage-adjusted) market read, not the raw
        // 1-comp median.
        if (effectiveMedian != null && landedCostUsd > 0) {
          marginUsd = Math.round(effectiveMedian - landedCostUsd);
          marginPct = Math.round((marginUsd / landedCostUsd) * 1000) / 10;
          // Net of the cost of capital tied up while it sits (est. days-to-sell).
          holdingCostUsd = holdingCost(landedCostUsd, estDaysToSell);
          netMarginUsd = marginUsd - holdingCostUsd;
          netMarginPct = Math.round((netMarginUsd / landedCostUsd) * 1000) / 10;
        }
      }

      // Sales-floor cockpit: where to open / aim / walk away when selling this model.
      const sellBand = negotiationBand(landedCostUsd, effectiveMedian);
      // Supplier-cost trend (AutoHome/RFQ) — a leading indicator: cost rising now =
      // local price + landed cost rising in ~1–2 months.
      const costTrendPct = priceTrend(sourceHistByKey.get(k) || [], { windowDays: 30 }).changePct;

      // Forward depreciation from cross-sectional year medians → residual in 12mo.
      const byYear = new Map<number, number[]>();
      for (const l of listings) if (l.year) (byYear.get(l.year) || byYear.set(l.year, []).get(l.year)!).push(l.price_usd);
      const depPoints = [...byYear.entries()].map(([year, ps]) => ({ year, medianUsd: median(cleanCarPrices(ps)) ?? 0 })).filter((p) => p.medianUsd > 0);
      const annualDepreciationPct = estimateAnnualDepreciation(depPoints, NOW_YEAR);
      const residual12moUsd = residualValue(effectiveMedian, 12, annualDepreciationPct ?? undefined);
      // Elasticity (price↔days-to-sell) + cheapest region.
      const elasticity = priceElasticity(listings, { staleDays: 14 });
      const regions = regionalSpread(listings, { minSample: 3 });
      const cheapestRegion = regions.length && regions[0].deltaPct != null && regions[0].deltaPct < 0 ? regions[0] : null;

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
        marketMedianShrunkUsd: shrunkMedianUsd !== marketMedian ? shrunkMedianUsd : null, // surfaced only when shrinkage changed it
        acquisitionMedianUsd, // private-seller median — what you'd pay to acquire
        resaleCeilingUsd, // dealer median — competitor retail ceiling
        fairLowUsd: interval?.low ?? null,
        fairHighUsd: interval?.high ?? null,
        clearingMedianUsd: sold.clearingMedianUsd, // est. transaction price (asking − haggle)
        estDaysToSell: sold.medianDaysToSell, // null until lifecycle data accrues
        marketSample: sampleSize,
        marketFreshnessDays: freshnessDays,
        marketSpreadPct: spreadPct,
        marketSources: sourceCount,
        marketTrendPct: trend.changePct, // + rising, − falling (last 30d vs prior 30d)
        demandTrendPct, // recent-30d vs prior-30d inquiries — demand momentum
        regimeBreak: regime.broke ? regime.reason : null, // structural market shift warning
        confidence: conf.score, // 0–1 trust in this market read
        confidenceLabel: conf.label,
        supplierCostUsd,
        costSource,
        costEstimated: costSource === "china_estimate", // cost is a China-retail proxy, not a real quote
        landedCostUsd,
        marginUsd,
        marginPct,
        holdingCostUsd, // cost of capital while it sits
        netMarginUsd, // margin after holding cost
        netMarginPct,
        costTrendPct, // supplier-cost momentum (leading indicator)
        annualDepreciationPct, // fitted from year medians (null if too few years)
        residual12moUsd, // projected value in 12 months
        elasticityDaysPerUsd: elasticity.daysPerUsd, // +days per $ asked (speed↔price)
        cheapestRegion: cheapestRegion ? { city: cheapestRegion.city, deltaPct: cheapestRegion.deltaPct } : null,
        sellWalkAwayUsd: sellBand.walkAwayUsd,
        sellTargetUsd: sellBand.targetUsd,
        sellOpeningUsd: sellBand.openingUsd,
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

    // Capital allocation: given ?budget=N (USD cash on hand), the optimal buy MIX
    // — greedy by profit density (net margin per landed $), respecting each model's
    // recommended qty. Turns a ranked list into an actual purchase plan.
    let allocation: {
      budgetUsd: number;
      spentUsd: number;
      expectedProfitUsd: number;
      picks: { brand: string; model: string; qty: number; capitalUsd: number; expectedProfitUsd: number }[];
    } | null = null;
    const budget = Math.max(0, Number(new URL(request.url).searchParams.get("budget")) || 0);
    if (budget > 0) {
      const buyable = rows
        .filter((r) => r.landedCostUsd && r.landedCostUsd > 0 && (r.netMarginUsd ?? r.marginUsd ?? 0) > 0)
        .map((r) => ({ r, density: (r.netMarginUsd ?? r.marginUsd ?? 0) / (r.landedCostUsd as number) }))
        .sort((a, b) => b.density - a.density);
      let spent = 0;
      const picks: { brand: string; model: string; qty: number; capitalUsd: number; expectedProfitUsd: number }[] = [];
      for (const { r } of buyable) {
        const unit = r.landedCostUsd as number;
        const want = Math.max(1, r.recommendedQty || 1);
        let qty = 0;
        while (qty < want && spent + unit <= budget) {
          spent += unit;
          qty += 1;
        }
        if (qty > 0) {
          const per = r.netMarginUsd ?? r.marginUsd ?? 0;
          picks.push({ brand: r.brand, model: r.model, qty, capitalUsd: Math.round(unit * qty), expectedProfitUsd: Math.round(per * qty) });
        }
      }
      allocation = { budgetUsd: budget, spentUsd: Math.round(spent), expectedProfitUsd: picks.reduce((a, p) => a + p.expectedProfitUsd, 0), picks };
    }

    return NextResponse.json({ ok: true, fx, count: rows.length, recommendations: rows.slice(0, 100), allocation });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute buying recommendations" }, { status: 500 });
  }
}
