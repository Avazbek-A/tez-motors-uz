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

## 🔨 / ⏳ Build queue (this push, in order)

### Phase 1 — pure analytics core (`src/lib/`, unit-tested)
- [ ] **Sold-price & time-to-sell inference** ⏳ — a listing that disappears (stale `last_seen_at` while peers stay fresh) = sold/withdrawn; estimate a *clearing* price (asking − learned haggle gap) and days-to-sell. The asking→transaction correction.
- [ ] **Dealer-vs-private classification** 🔨 — heuristic on raw_text (salon keywords) + repeated phone numbers + posting volume. Splits "your competitor's retail" from "your acquisition cost."
- [ ] **Seller-motivation scoring** 🔨 — text signals (срочно / уезжаю / торг / срочная продажа / relisted-lower) → 0–1 desperation → per-listing lowball price.
- [ ] **Cross-source dedup** 🔨 — same car on OLX+avtoelon+Telegram = one comp. Signature = phone + price-band + model + year; collapse before median/confidence.
- [ ] **Bayesian shrinkage (thin models)** 🔨 — partial-pool a model's median toward its brand/segment mean by sample size; honest numbers for the 156/208 no-comp models.
- [ ] **Prediction intervals** 🔨 — fair value as a band (±, ~80%) from spread + sample, pairing with the confidence score.
- [ ] **Price elasticity curve** ⏳ — price ↔ days-to-sell relationship per model (needs sold-inference data to mature).
- [ ] **Residual-value forecast** ⏳ — forward depreciation curve per model from the price time-series.
- [ ] **Regional spread (intra-UZ)** 🔨 — per-city median deltas (uses `city`) → buy-cheap-region / sell-dear-region.
- [ ] **Market regime-break detection** 🔨 — flag when a model's incoming price distribution shifts structurally (mean/variance break) → "assumptions changed."
- [ ] **VIN journey + odometer-rollback** 🔨 — parse VINs from raw_text; track a car across relistings; flag mileage that *decreased* over time (rollback) and relisted-lower (motivation).
- [ ] **Cost-of-capital / holding cost** 🔨 — per-day carrying cost folded into margin + markdown math.

### Phase 2 — buy brain wiring (`/api/admin/buying`, page)
- [ ] Apply shrinkage + prediction intervals to each rec.
- [ ] Dealer/private split (anchor buy price on private, ceiling on dealer).
- [ ] Regional spread column.
- [ ] Cost-of-capital in the margin.
- [ ] Regime-break flag surfaced.
- [ ] **Demand forecasting** 🔨 — next-period demand per model from inquiry/watch/saved-search time-series + simple seasonality. Reactive → anticipatory.
- [ ] **Capital allocation** 🔨 — given a cash budget, the optimal buy *mix* (profit-per-$-per-day knapsack), not just a ranked list.

### Phase 3 — Deal-sniper (new surface)
- [ ] `/api/admin/deals` — scan individual live listings priced below mileage-adjusted fair value (× motivation × dealer/private) → ranked acquisition targets.
- [ ] `/admin/deals` page — the buy-low feed.

### Phase 4 — Dynamic repricing (own inventory)
- [ ] `/api/admin/repricing` — your stock × days-in-stock × market trend × holding cost → markdown suggestions.
- [ ] Admin surface (extend inventory or new page).

### Phase 5 — new value inputs (migrations + valuation + admin form)
- [ ] **Remaining-warranty** 🔨 — `cars.in_service_date`; warranty-left as a value input.
- [ ] **Battery state-of-health (EV/PHEV)** 🔨 — `cars.battery_soh_pct`; dominant value driver for electrics.
- [ ] **Official-vs-gray provenance** 🔨 — `cars.import_channel`; provenance premium split.

### Phase 6 — ops & tools
- [ ] **Negotiation cockpit** 🔨 — floor / target / walk-away per car for the sales floor.
- [ ] **Scraper drift / health monitoring** 🔨 — per-collector yield tracking; alert when a source's output drops.
- [ ] **Import-policy scenario simulator** 🔨 — what-if on customs/duty config → impact on every buy price.
- [ ] **Lead-to-inventory matching** 🔨 — match open inquiries/saved-searches to current + incoming stock.
- [ ] **AutoHome China-price leading indicator** ⏳ — track `source_prices` changes over time as a ~1–2-month-ahead local signal.

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
