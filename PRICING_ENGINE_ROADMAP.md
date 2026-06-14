# Pricing-engine roadmap

The complete set of "I-buy-price" engine leaps — shipped, queued, and blocked. This
is the master tracker for the build-all push started 2026-06-14. All work is **$0**
(no LLM/paid APIs — heuristics + statistics done in-house) and ships through the
normal flow: commit → auto-push → `./deploy/deploy.sh` (auto-migrates). See also
memory `market-intel-engine` and `DEPLOY.md`.

**Legend** — ✅ shipped · 🔨 build now (pure, existing data) · ⏳ mechanism ships now, sharpens as data accrues · 🔒 blocked on an owner action · 🌐 blocked on an external data source to obtain/recon · 💲 needs paid compute.

---

## ✅ Already shipped (2026-06-14, commit dfed1c3 + prior)

1. **Listing lifecycle** — `market_listings.last_seen_at`; ingest upserts → days-on-market.
2. **Richer extraction** — mileage_km + condition from raw_text (heuristics).
3. **Price trend** — recent-30d vs prior-30d median per model.
4. **Confidence score** — 0–1 from sample/freshness/spread/sources; High/Med/Low badge.
5. **Hedonic mileage value** — OLS price-on-odometer; wired into trade-in.
6. **In-app signal strip** — "market moves" ≥8% on the buying page.
7. **OLX + avtoelon collectors live; Telegram built** (gated on creds).

---

## Build queue — ✅ ALL SHIPPED (build-all push, 2026-06-14)

### Phase 1 — pure analytics core (`src/lib/market-analytics.ts`, unit-tested) ✅
- [x] **Sold-price & time-to-sell inference** (`inferSold`) — disappeared listings → clearing price (asking − haggle) + days-to-sell. ⏳ sharpens as lifecycle accrues.
- [x] **Dealer-vs-private classification** (`classifySeller` + `extractPhone`).
- [x] **Seller-motivation scoring** (`motivationScore`).
- [x] **Cross-source dedup** (`dedupeListings` — phone+model+year+band).
- [x] **Bayesian shrinkage** (`shrinkEstimate`).
- [x] **Prediction intervals** (`predictionInterval`).
- [x] **Price elasticity** (`priceElasticity`). ⏳ needs sold data.
- [x] **Residual-value forecast** (`residualValue` + `estimateAnnualDepreciation`).
- [x] **Regional spread** (`regionalSpread`).
- [x] **Regime-break detection** (`regimeBreak`).
- [x] **VIN journey + odometer-rollback** (`extractVin` + `vinJourneys`).
- [x] **Cost-of-capital / holding cost** (`holdingCost`).

### Phase 2 — buy brain wiring (`/api/admin/buying` + page) ✅
- [x] Shrinkage + prediction intervals per rec.
- [x] Dealer/private split (acquisition median + resale ceiling).
- [x] Cost-of-capital → net margin.
- [x] Regime-break flag surfaced (⚠).
- [x] **Demand momentum** (recent vs prior inquiries).
- [x] **Capital allocation** (`?budget=N` → optimal buy mix by profit density).

### Phase 3 — Deal-sniper ✅
- [x] `/api/admin/deals` + `/admin/deals` page (buy-low feed).

### Phase 4 — Dynamic repricing ✅
- [x] `/api/admin/repricing` + `/admin/repricing` page (markdown suggestions on own stock).

### Phase 5 — new value inputs ✅ (migration 077)
- [x] **Remaining-warranty** (`cars.in_service_date` + `warrantyMonthsLeft`).
- [x] **Battery state-of-health** (`cars.battery_soh_pct`).
- [x] **Official-vs-gray provenance** (`cars.import_channel`) → `valueAdjustmentFactor` wired into repricing + admin form.

### Phase 6 — ops & tools ✅
- [x] **Negotiation cockpit** (`negotiationBand` → buying sell-guidance + repricing floor).
- [x] **Scraper health** (`/api/admin/market/health`).
- [x] **Import-policy simulator** (`/api/admin/policy-sim?dutyDelta=N`).
- [x] **Lead-to-inventory matching** (`/api/admin/leads/match`).
- [x] **AutoHome/supplier-cost leading indicator** (`costTrendPct` in buying recs).
- [x] **Calibration scaffold** (`/api/admin/calibration` — proxy until realized sale prices wired).
- [x] All surfaced on **`/admin/engine`** (Engine Ops).

---

## 🔒 / 🌐 / 💲 Blocked (build scaffold where possible, can't complete unilaterally)

- **Telegram coverage** 🔒 — collector built; needs owner `TG_API_ID/HASH/SESSION/CHANNELS`. Biggest coverage gain.
- **Calibration loop vs real sales** 🔒 — needs the dealer's actual realized **sale prices**. I'll build the consumer; it stays inert until that data exists/is identified.
- **Competitor import-volume intel** 🌐 — Uzbek customs/trade stats; recon needed (may be brand/segment-level only).
- **New-car price anchor** 🌐 — official local new-car prices; need a source.
- **Cross-border re-export arbitrage** 🌐 — KZ/Dubai/RU source feeds.
- **Auction max-bid automation** 🌐 — foreign export-auction access.
- **Named-competitor dealer tracking** 🌐/🔨 — partially buildable as a watchlist of seller refs once we can identify them in listings.
- **Photo-based condition grading** 💲 — needs a vision model (local/open to stay ~$0); parked.
- **Monthly-payment-based pricing** 🌐 — needs financing terms/config.
- **Data-as-a-product** — business model, not engine code.

---

## Principles
- **$0**: heuristics + statistics in-house; no LLM/paid feeds.
- **Sequential, committed**: each leap lands as its own focused commit (auto-pushed); deploys batched at phase boundaries.
- **Honest gates**: mechanisms that need data-accrual or owner action ship as working code, clearly marked — never faked as "complete."
