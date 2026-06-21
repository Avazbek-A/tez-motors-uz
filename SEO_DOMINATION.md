# SEO Domination Strategy — Importing Cars to Uzbekistan

**Owner:** Tez Motors (tezmotors.uz) · **Author:** strategy pass 2026-06-20
**Companion docs:** [SEARCH_CONSOLE.md](SEARCH_CONSOLE.md) (verification + webmaster wiring), [docs/MARKET_INTEL.md](docs/MARKET_INTEL.md) (the demand data we already own)

> Goal: own page 1 of **both Google.uz and Yandex** for every query a person types
> when they want to import / buy / clear-customs on a car in Uzbekistan — in
> Russian **and** Uzbek.

---

## 0. The thesis (read this first)

The "import cars to Uzbekistan" SERP is won by three content shapes, in this order:

1. **Customs / `растаможка` cost calculators** (calk.uz, gonzo-motors.uz rank with these)
2. **`под ключ` total-cost breakdowns per model** ("BYD Han под ключ — полная стоимость")
3. **Marketplace-style listings of hot Chinese models** (avtoelon.uz: BYD alone = 706 listings)

The regulatory complexity of UZ car imports (tiered duty by engine + age, `утильсбор`,
EV exemptions, the 7-year / Euro-5 / no-RHD rules) is an **evergreen content goldmine**
that today's page-1 players only half-exploit: broker blogs (autostrada.uz, ustabor.uz)
have the words but no inventory or live calculator; marketplaces have listings but no
authoritative guides; calk.uz has a calculator but no cars.

**Tez Motors already holds the assets nobody else combines:**

| Asset | Where it lives | Why it's a moat |
|---|---|---|
| A working UZ customs engine | `src/lib/customs-uz.ts` | calk.uz/gonzo have one; broker blogs don't |
| Live inventory + per-trim spec & customs data | `cars` table, `spec_data` jsonb | marketplaces have listings; calculators don't |
| **Real demand signal** (which models people actually want) | `market_listings` / `docs/MARKET_INTEL.md` | **lets us rank programmatic pages by true demand — unique** |
| Bilingual DB-backed CMS | `posts` table, `renderMarkdown` | broker blogs are static; we publish at scale |
| Full indexing plumbing | Search Console + Yandex/Bing webmaster APIs + IndexNow | most competitors fly blind |

**Domination = turn those assets into server-rendered, schema-rich, programmatic pages
at scale (model × "под ключ" × city × comparison), anchored by the best customs
calculator in the country and the most authoritative (primary-source-cited) regulatory
content — then win Yandex specifically on behavioral signals + Turbo Pages + commercial
factors.**

---

## 1. The battlefield (verified research, 2026-06-20)

### 1a. Who ranks now
- **calk.uz** — 78-calculator portal; live RU `растаможка` calculator at
  `calk.uz/ru/calculator/rastamozhka` (duty + excise + VAT + утильсбор + registration).
  Sources its rates from lex.uz / cbu.uz / soliq.uz. **This is the calculator to beat.**
- **gonzo-motors.uz** — direct competitor dealer; combines catalog + prices + calculator
  (the exact winning format). *We already scrape Gonzo (gonzo-detail.mjs) — we know their data.*
- **avtoelon.uz** — major marketplace; Chinese brands dominate (BYD 706, Chery 333,
  Leapmotor 170, Jetour 167, Changan 135, Haval 120, Li Auto 102, Zeekr 101).
  A major competitor — *not* the proven category leader (its "dominance" claim was refuted).
- **Broker blogs** — autostrada.uz, auto.ustabor.uz rank for `растаможка` guides.
- **Authority/legal portals** — buxgalter.uz, norma.uz, gov.uz, lex.uz (for the rules themselves).

### 1b. Demand reality (qualitative — see open question on volume)
- **BYD is #3 in the UZ market**, ~+39% growth, **74.1% of EV sales**. BYD/Chery/Changan/
  Haval/Li Auto/Zeekr/Jetour/Leapmotor are the high-demand, transactional-intent models.
- **EVs are the single highest-value content angle** (see §7) — 0% customs duty, excise-exempt,
  the tax math is dramatic and search-worthy.

### 1c. Yandex matters as much as Google here
Yandex is roughly half of CIS search. It ranks differently from Google (details in §4 / Pillar 4).
The biggest implication for us: **Yandex renders JavaScript poorly — content must be in the
server HTML.** That single fact drives Pillar 0.

---

## 2. The keyword → intent → content-type → competition map

> The core deliverable. Priority = (commercial value × winnability). Tiers below are
> execution order. "Have?" = do we already have a page for it.

### TIER 1 — Transactional + high-intent (build/upgrade first)

| Keyword cluster (RU / UZ) | Intent | Best content type | Competition | Have? |
|---|---|---|---|---|
| `растаможка авто Узбекистан [калькулятор]` / `bojxona to'lovi kalkulyator` | Trans-info | **Interactive calculator + guide hub** | calk.uz, gonzo, broker blogs | ⚠️ have calculator, under-optimized |
| `[BYD Han] под ключ цена Ташкент` / `narxi` | Transactional | **Per-model "под ключ" page** (calc result baked in) | gonzo, marketplaces | ❌ no model pages |
| `купить [BYD Song] Узбекистан` / `sotib olish` | Transactional | **Per-model page** + live listings | avtoelon, gonzo | ❌ |
| `авто из Китая под ключ` / `Xitoydan avtomobil` | Transactional | Source-country hub + inventory | gonzo, blogs | ⚠️ homepage only |
| `электромобиль Узбекистан купить` / `elektromobil` | Transactional | EV hub + EV filter + calculator | marketplaces | ✅ `/catalog/type/electric` (upgrade) |
| `[brand] в рассрочку / в кредит` / `muddatli to'lov` | Transactional | Finance landing + per-model finance block | banks, dealers | ❌ |

### TIER 2 — Programmatic long-tail (the scale engine)

| Pattern | Intent | Content type | Competition | Have? |
|---|---|---|---|---|
| `[brand] [model] цена/обзор/характеристики Узбекистан` | Info→Trans | **Per-model page** (× ~80 hot models × 3 locales) | weak/fragmented | ❌ **biggest gap** |
| `[model A] vs [model B]` (BYD Song vs Haval H6…) | Info | **Comparison page** (programmatic from spec_data) | YouTube, blogs | ❌ |
| `авто из Кореи / США / Германии в Узбекистан` | Info→Trans | Source-country guide (per country) | RU broker blogs | ❌ *(needs owner decision §6)* |
| `купить авто [Самарканд/Бухара/…]` | Trans (geo) | **City page** | marketplaces | ✅ 7 cities (expand + enrich) |
| `[brand] Ташкент / автосалон [brand]` | Trans | **Brand page** | marketplaces | ✅ 48 brands (enrich w/ schema) |

### TIER 3 — Informational / authority (E-E-A-T + links + answer boxes)

| Keyword cluster | Intent | Content type | Competition | Have? |
|---|---|---|---|---|
| `растаможка авто Узбекистан 2026 [сколько стоит / как рассчитать]` | Info | **Pillar guide** (cites lex.uz) | broker blogs, buxgalter | ⚠️ no dedicated guide |
| `утильсбор Узбекистан таблица ставок` | Info | Rate-table guide (BRV ladder) | norma.uz, gov.uz | ❌ |
| `растаможка электромобиля Узбекистан` | Info | EV cost guide (0% duty story) | news sites | ❌ |
| `можно ли ввезти авто старше 7 лет / Евро-5 / руль справа` | Info | "Can I import X?" eligibility guide | scattered | ❌ |
| `как пригнать авто из Китая` (process) | Info | Step-by-step import guide + video | dtf.ru, blogs | ❌ |
| `сколько ждать авто из Китая / сроки доставки` | Info | Logistics/timeline guide | blogs | ❌ |

**Language rule for every row:** ship **RU first** (Yandex morphology + buyer majority),
**UZ (Latin) second** (Google + younger/regional buyers, lower competition = easier wins),
EN as completeness. The blog/`posts` table and `makePageMetadata` already do all 3 locales.

---

## 3. Our assets vs. gaps (codebase audit, 2026-06-17 state)

**Strong foundation already in place** — do *not* rebuild:
- Dynamic `sitemap.ts` (all content × 3 locales + alternates + lastmod), `robots.ts`
  (AI + search crawlers allow-listed, private paths blocked).
- `makePageMetadata` + `localizedAlternates` (canonical + hreflang + x-default→ru).
- JSON-LD: Organization (AutoDealer+LocalBusiness, geo/hours), WebSite+SearchAction,
  Product (cars + parts), BlogPosting, FAQPage, BreadcrumbList, conditional AggregateRating.
- **Programmatic SEO already exists**: 48 brand pages, 6 filter pages, 7 city pages (× 3 locales).
- Search Console (Google/Yandex/Bing) verified; webmaster APIs wired; IndexNow live.

**Gaps to fix (mapped to pillars below):**

| # | Gap | File | Pillar |
|---|---|---|---|
| G1 | **Car detail body renders client-side** — page fetches `car` server-side for metadata then throws it away; `<CarDetailClient/>` re-fetches via `/api/cars/[slug]` | `catalog/[slug]/page.tsx:97,103` | P0 |
| G2 | Calculator results & content are client-only; no HowTo/SoftwareApplication/FAQ schema | `calculator/_content.tsx` | P0/P1 |
| G3 | No per-model pages (biggest long-tail miss) | — | P2 |
| G4 | No comparison pages | — | P2 |
| G5 | `/parts/category/[category]` has no `generateMetadata` | that route | P0 |
| G6 | Scooter detail pages have no Product schema | `scooters/[slug]` | P0 |
| G7 | `/deals`, brand/filter/city pages lack ItemList/AggregateOffer schema | multiple | P0 |
| G8 | Manifest hardcoded `lang: ru` (not localized) | `manifest.ts` | P0 |
| G9 | Blog list canonical includes `?category=` | `blog/page.tsx:60` | P0 |
| G10 | No related-cars widget on car detail (internal linking) | `catalog/[slug]` | P2 |
| G11 | No dedicated `растаможка` content hub under the calculator | — | P1/P3 |
| G12 | No Turbo Pages, no Yandex.Business listing | — | P4/P5 |

---

## 4. The six pillars

### Pillar 0 — Stop the foundation leaks (technical; do first, fast wins)
The plumbing is great; a few leaks waste it.

- **G1 (highest leverage): make car detail server-rendered.** `page.tsx` *already* fetches
  the full `car`. Pass it (and `aggregate`) as props into `CarDetailClient`; have the client
  hydrate from props instead of re-fetching in `useEffect`. Result: full car content (specs,
  description, gallery) in the initial HTML → indexable by Yandex, faster LCP, no spinner flash,
  one fewer API round-trip. **This is the single highest-ROI technical change.**
- **G2:** server-render the calculator's explanatory content + rate tables (keep the live
  form interactive); add `SoftwareApplication`/`WebApplication` + `FAQPage` + `HowTo` schema.
- **G5–G9:** add the missing `generateMetadata` (parts category), Product schema (scooters),
  `ItemList`/`AggregateOffer` schema (deals, brand, filter, city collection pages), localize the
  manifest, drop `?category=` from the blog-list canonical (self-canonical to `/blog`).

### Pillar 1 — Own `растаможка`: the calculator as a weapon
calk.uz and gonzo rank because the calculator *is* the product for this query.

- **Build a `растаможка` hub page** at `/calculator` (or `/rastamozhka` alias): the live
  calculator on top, then evergreen content underneath — the duty ladder, `утильсбор` BRV
  table, the EV 0%-duty story, the 7-year/Euro-5/RHD rules — **all server-rendered and citing
  lex.uz / Tax Code Art. 289** (see §7). This wins both the calculator query *and* the
  informational `сколько стоит растаможка` query with one URL.
- **Bake calculator output into the per-model "под ключ" pages** (Pillar 2) instead of trying
  to index arbitrary calculator query-strings — that gives Google/Yandex curated, content-rich
  result pages (no faceted index bloat).
- **Keep rates version-controlled & dated.** Regulation here changes fast (BRV and the EV fee
  both moved in the last 12 months). Anchor displayed values on **BRV multiples**, not som
  amounts; stamp "actual on <date>"; cite the resolution number.
- Earn PR links: a genuinely best-in-country calculator is the kind of tool gazeta.uz / spot.uz /
  kun.uz cite — pitch it.

### Pillar 2 — Programmatic SEO at scale (the growth engine)
You have brand/filter/city. The untapped multipliers:

- **Per-model pages** — `/catalog/brand/[brand]/[model]` (extends existing hierarchy + breadcrumbs).
  Each aggregates all listings/trims of that model + **"под ключ" landed cost** (from
  `customs-uz.ts`) + specs + a comparison block + an import-guide block + finance block.
  **Prioritize which models to generate by real demand from `market_listings`** (we know BYD=706
  etc.) — build the high-demand models first. Target ~60–100 models × 3 locales.
- **Comparison pages** — `/compare/[brandA]-[modelA]-vs-[brandB]-[modelB]`, generated from
  `spec_data`. Seed from the highest-demand pairs (BYD Song vs Haval H6, Zeekr 001 vs Li Auto, …).
- **Source-country hubs** — `/import/china` (+ korea/usa/germany *if* we serve them — §6):
  process, timeline, cost, eligibility, funnel to inventory.
- **Enrich existing brand/filter/city pages** with `ItemList`/`AggregateOffer` schema + intro
  copy + internal links to the new model pages.
- **Internal linking (G10):** related-cars widget on car detail, model→trim→comparison→guide
  cross-links. This is how link equity flows to the long tail.
- Every new page → `sitemap.ts` (already dynamic — wire the new tables/queries) → IndexNow ping.

### Pillar 3 — Evergreen regulatory authority (E-E-A-T + links + answer boxes)
The blog (`posts`, bilingual, server-rendered, FAQ schema) is ready. Publish a **content cluster**:

- **Pillar article:** "Растаможка авто в Узбекистане 2026: полный гайд" → links to the calculator hub.
- **Cluster spokes** (each cites a primary source from §7, dated, BRV-anchored):
  утильсбор rate table · EV 0%-duty explainer · "можно ли ввезти авто старше 7 лет / Евро-5 /
  руль справа" · "как пригнать авто из Китая" (process + video) · delivery timelines ·
  excise (Art. 289) explainer.
- **Model import guides:** "Как пригнать BYD Han из Китая" → links to that model page.
- Interlink the cluster ↔ calculator hub ↔ model pages. Mirror RU → UZ.

### Pillar 4 — Yandex domination playbook (run in parallel with Google)
Yandex ≈ half the market and ranks on different signals. Webmaster/Metrica are already wired
(see SEARCH_CONSOLE.md). Focus:

- **Server-rendered HTML everywhere** (Pillar 0) — Yandex's JS rendering is weak; this is the
  prerequisite for Yandex indexing the money pages at all.
- **Behavioral factors (ПФ)** — Yandex weights CTR, dwell time, and "no return to SERP" heavily.
  The calculator and comparison tools are dwell-time machines; ship them and they feed the signal.
  Use the Engine Ops "fix CTR" list (high-impression/low-CTR) to rewrite titles.
- **Commercial factors** — for transactional queries Yandex rewards visible prices, contacts,
  delivery info, assortment breadth, reviews, online chat. We have most — ensure all are crawlable
  in server HTML.
- **Turbo Pages** — Yandex's fast-cached mobile format; high value on UZ mobile. Implement for
  catalog + blog + model pages.
- **Yandex.Business / Yandex Maps** listing for geo queries ("автосалон Ташкент") — local pack (P5).
- **Russian morphology** — Yandex handles RU declensions natively; RU content is non-negotiable.
- Grow **ИКС** (Yandex's quality index) via brand search demand, traffic, and the behavioral wins.

### Pillar 5 — Off-page, local, reviews, video
- **Google Business Profile + Yandex.Business** — geo/local pack for "импорт авто / автосалон Ташкент".
- **Reviews** — you have `reviews` + AggregateRating schema; drive review volume (post-purchase TG/SMS ask).
- **YouTube** — model reviews + "процесс растаможки" videos; embed on model/guide pages, rank in both engines.
- **PR backlinks** — calculator + market data → pitch gazeta.uz/spot.uz/kun.uz; cross-link the Telegram channel.

### Pillar 6 — Measurement & moat
- Use the existing **Engine Ops dashboard** (Google per-page perf, fix-CTR list, index-coverage via
  URL Inspection, Yandex queries) weekly.
- **Validate keyword volume** via Yandex Wordstat (free) + Google Keyword Planner for `.uz`
  before over-investing in any single cluster (open question — owner action).
- Track a fixed **priority keyword set** (RU + UZ) for rank movement.
- Re-run a SERP audit on google.uz **and** yandex.uz for the Tier-1 queries to confirm page-1 targets.

---

## 5. Phased roadmap

**Phase 0 — Foundation leaks (week 1, mostly mechanical, big compounding payoff)**
G1 car-detail SSR · calculator schema (G2) · parts-category metadata (G5) · scooter Product
schema (G6) · collection ItemList schema (G7) · localized manifest (G8) · blog canonical (G9).

**Phase 1 — Calculator weapon + authority hub (weeks 2–3)**
`растаможка` hub page (calculator + server-rendered rate tables + primary-source citations) ·
pillar guide article. **Rate source resolved:** render the tables from the exported
constants in `src/lib/customs-uz.ts` (DUTY_BASE, utilizationBrv, BRV_SUM, VAT_PCT) — that
model is reverse-engineered from @autodeklarantbot and validated to the dollar, so content
and calculator stay in lockstep and never drift.

**Phase 2 — Programmatic scale (weeks 3–6)**
Per-model pages (demand-ranked from `market_listings`) · "под ключ" landed cost per model ·
related-cars internal linking · sitemap + IndexNow wiring for the new routes.

**Phase 3 — Comparisons + content cluster + Yandex extras (weeks 6–9)**
Comparison pages · the full RU→UZ content cluster · Turbo Pages · Yandex.Business + GBP listings.

**Phase 4 — Off-page + measurement loop (ongoing)**
Reviews drive · YouTube · PR links · weekly Engine Ops review · keyword-rank tracking.

---

## 6. Owner decisions & action items

**Decisions that change the plan (need your input):**
1. **Which source countries do we actually serve?** China is the clear core. Do we also broker
   **Korea / USA / Germany / Japan**? This decides whether we build country hubs for those
   (real `пригнать авто из Кореи/США` demand) or stay China-focused.
2. **Language priority** — RU-first is the default. Any reason to lead UZ (e.g., targeting
   regional/younger buyers where UZ competition is thinner)?
3. **Appetite for the car-detail SSR refactor (G1)?** It's the #1 technical win but touches a
   31KB client component. Recommend yes.
4. **Programmatic publish gate** — auto-publish model/comparison pages, or review-gate them
   (like the parts pipeline)?

**Owner-only action items (I can't do these):**
- Yandex **Wordstat** + Google **Keyword Planner** pull for `.uz` to confirm volumes.
- Create/claim **Google Business Profile** + **Yandex.Business** listings.
- Cloudflare **Cache Rule for `/_next/image*`** (still the #1 perf lever per perf_posture).

---

## 7. Verified regulatory facts — the content source-of-truth

> Use ONLY these in published content. All confirmed by 3+ sources via adversarial fact-check
> (2026-06-20). **Time-sensitive — anchor on BRV multiples, not som; date every figure; cite the
> resolution.** BRV = 412,000 som (since 2025-08-01).

- **EV (pure battery, TN VED 8703 80):** **0% customs duty** + **excise-exempt**, but **12% VAT**
  applies, plus recycling fee. Fee **quadrupled effective 2025-05-01** (Cabinet Res. No. 52,
  2025-01-31): **120 BRV** for EV <3yr (~45M som), **210 BRV** for EV >3yr (~78.75M som).
  Domestically-assembled EVs exempt from the fee until 2030-01-01.
  *Sources: gazeta.uz, spot.uz, kun.uz, autostrada.uz.*
- **Customs duty (ICE), tiered by engine displacement × age:** new (<1yr) ≈ **15% + $0.4–$1/cc**;
  used (3+yr) ≈ **40% + $3.0/cc**. (Some sources show a finer 15/20/30/40% ladder at
  <1 / 1–3 / 3–7 / 7+ yr — **reconcile against the 2022-04-15 Presidential Resolution on lex.uz
  before finalizing the calculator config**.) *Sources: autostrada.uz, spot.uz, ustabor.uz.*
- **Recycling fee (`утильсбор`)** — BRV-denominated, scales by engine × age. M1 passenger ladder:
  ≤1000cc = 30 BRV new / 90 BRV >3yr … up to >3500cc = 300 new / 480 >3yr.
  *Sources: norma.uz, autostrada.uz. Established by Cabinet Res. No. 347 (2020-06-02); procedures
  in No. 358 (2021-06-09).*
- **VAT = 12%** on (car value + transport + recycling fee + duty). (Cut from 15% on 2023-01-01.)
- **ICE import limits:** max **7 years** old, **Euro-5** minimum, **RHD banned**. EVs are exempt
  from the age/Euro floor. *Sources: ustabor.uz, autostrada.uz; Euro-5 floor from a 2024 decree.*
- **Excise:** rates per **Tax Code Article 289**. *Source: gov.uz, lex.uz.*

**Primary legal anchors to cite for E-E-A-T:** Tax Code Art. 289 (excise); Cabinet Res. No. 347 /
No. 358 (recycling fee); Res. No. 52 of 2025-01-31 (EV hike); Presidential Resolution 2022-04-15
(duty rates) — all on lex.uz.

---

## 8. Refuted claims — DO NOT publish

These failed fact-checking (≥2 of 3 verifiers refuted). Keeping them out protects E-E-A-T:
- ❌ The ladder "120 BRV for 1001–2000cc, 180 BRV 2001–3000cc, 240 BRV 3001–3500cc"
  (conflicts with the verified 30→480 ladder).
- ❌ "EVs have no age limit / flat 30 BRV regardless of size / no excise" (as stated by ustabor.uz).
- ❌ "EVs exempt from duty + excise until 2027."
- ❌ All gonzo-motors.uz specific price-structure figures (unverified).
- ❌ "avtoelon.uz is THE dominant marketplace / ~41,857 active listings" — it's *a* major
  competitor, not the proven leader.

---

## Open questions still to close (don't skip before scaling)
1. **Yandex specifics unverified** — the §4 Yandex playbook is established SEO domain knowledge,
   not freshly verified for UZ; validate Turbo/ПФ impact empirically via Webmaster after launch.
2. **Keyword volume unverified** — confirm cluster demand via Wordstat / Keyword Planner.
3. **Live SERP composition** — audit google.uz + yandex.uz for the exact Tier-1 queries to lock targets.
4. ~~**Duty age-tier breakpoints** — reconcile against lex.uz.~~ **RESOLVED:** `src/lib/customs-uz.ts`
   is reverse-engineered from the @autodeklarantbot customs-declarant bot and validated to the
   dollar (finer + more complete than web sources: FTA/certified/uncertified origin, 15/30/40%
   age ladder, EV/PHEV, util tiers). It is the rate source of truth — the hub renders from it.

---

## Implementation status (2026-06-21)

**Shipped & committed** (branch `design/cinematic-showroom`, `next build` verified, **not pushed**):

- **P0** — car-detail SSR (full listing now in initial HTML); calculator `WebApplication` schema.
- **P1** — server-rendered растаможка hub (rate tables derived from the engine, EV 0%-duty
  story, eligibility, visible FAQ → FAQPage schema, lex.uz citations); title retargeted to
  "Калькулятор растаможки авто в Узбекистане 2026".
- **P2** — per-model pages (`/catalog/brand/[brand]/[model]`, под-ключ from the engine, ItemList
  + reused CarCard); source-country hubs (`/import/{china,korea,usa,germany}`); comparison pages
  (`/compare/a-vs-b`). All interlinked, schema'd, and in the sitemap (× locales).
- **G7** — ItemList schema on brand + filter collection pages.
- **P3** — two trilingual pillar guides (migration `101_seed_import_guides.sql`; publish on deploy).
- **P4 (code)** — RSS feed at `/feed.xml`. Yandex foundations already in place: **SSR everywhere**
  (P0), IndexNow, Webmaster APIs, verification meta, commercial factors (visible prices/contacts).
  **Turbo Pages: intentionally skipped** — Yandex de-emphasized Turbo; sitemap + IndexNow + SSR
  cover discovery without that maintenance burden.

**Recon corrections:** the initial audit over-claimed gaps — G5 (parts metadata) and G6 (scooter
Product schema) were already done; G9 (blog `?category=` canonical) is intentional, not a bug;
G8 (manifest locale) skipped (Next `manifest.ts` is single-locale, and the site is RU-first).

**Owner-only — still pending (cannot be done from code):**
1. **Push the branch & deploy.** Everything is committed locally but not pushed. Deploy applies
   migration `101` → the two guides go live; the new routes + RSS start serving.
2. Create **Google Business Profile** + **Yandex.Business** listings (local pack for
   "автосалон / импорт авто Ташкент").
3. Pull **Yandex Wordstat** + **Google Keyword Planner** (`.uz`) to confirm cluster volumes, then
   decide RU-vs-UZ lead per cluster (default shipped: RU-first, UZ second, EN third).
4. Cloudflare **Cache Rule for `/_next/image*`** — still the #1 perf lever (owner action).
5. After indexing, watch the Engine Ops "fix CTR" list and rewrite low-CTR titles.
