# Market price intelligence (OLX & Telegram)

Know what cars actually sell for in Tashkent so you can (1) **quote
competitively** and (2) **pick which models to import** by market price vs your
landed cost. Lives at **Admin → Market Intel**.

## How the data gets in — three ways

### 1. Paste + AI parse (works today, no setup)
Copy a chunk of an OLX search page or a Telegram car channel, paste it into
**Add market data**, pick the source, and click **Parse with AI**. The LLM
extracts `brand / model / year / price / city`; you tick the rows to keep and
**Save**. Prices are normalized to USD on save (so'm → USD at the CBU rate).
Requires `LLM_API_KEY`; without it, use the manual add row.

### 2. Manual add
For one-off entries (or when the LLM is off): type brand / model / year / price
/ currency and **Add**.

### 3. Automated collectors (the scalable path — now working)
You **cannot scrape OLX/Telegram from Cloudflare Workers** — OLX has anti-bot
protection a Worker `fetch` can't pass, and Telegram channel history can only be
read by a logged-in user client (MTProto), not a bot. So two **collectors run
off-Workers** (on your always-on Vostro / any Node 18+ box) and POST listings to
the ingest endpoint. Full setup is in **`deploy/collector/README.md`**:

- **OLX** → `deploy/collector/olx-collector.mjs`. **API-first** (OLX's JSON API,
  plain `fetch`, robust) with a **Playwright DOM fallback** if the API changes.
  Searches are configurable (`OLX_SEARCHES_FILE`, else a sensible default set).
- **Telegram** → `deploy/collector/telegram-collector.mjs` (**gramJS** MTProto
  user client). One-time `node telegram-collector.mjs --login` mints a reusable
  `TG_SESSION`; then it reads recent messages from `TG_CHANNELS` and posts only
  the ones matching its brand/model dictionary (clean data) — the server parses
  the messy price text.

```bash
cd deploy/collector && npm install && npx playwright install chromium
export INGEST_URL=https://tezmotors.uz/api/admin/market/ingest
export MARKET_INGEST_SECRET=…same value as the app secret…
node olx-collector.mjs           # schedule every 6h
node telegram-collector.mjs --login   # once, then schedule the bare command
```

Set `MARKET_INGEST_SECRET` (a Worker/app secret) and the collectors present it as
`Authorization: Bearer …`. Admin sessions can ingest without it.

> **Respect the sources.** Keep the cadence gentle, follow OLX's Terms/robots and
> Telegram's ToS, and treat this as price *reference*, not bulk republishing.

## What you get

The intelligence table groups listings by **brand / model / year** and shows:

- **Market median** (+ min–max range) in USD — the going rate.
- **Your price** — the median of your own listed units for that model.
- **vs market** — how your price compares (🟢 below market = competitive, 🔴 above).
- **n** — sample size, and **Fresh** — how recent the latest observation is
  (don't trust a median built from 2 stale listings).
- **New opportunity** — a model selling well that you don't list yet.
- **calc** — opens the **Import calculator** with that market price pre-filled,
  so you instantly see your **import margin at the market price** given your
  landed cost. This is the import-selection decision: market price − landed cost.

## How it ties together

```
collector / paste ─▶ market_listings (USD-normalized, deduped)
                         │
                         ├─▶ Market Intel table  → competitive quote (your price vs median)
                         └─▶ Import calculator    → profitability (market price − landed cost)
```

Pricing data is internal: `market_listings` is service-role only (RLS on, no
policies), like `car_costs`.
