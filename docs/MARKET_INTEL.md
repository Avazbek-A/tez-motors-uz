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

### 3. Automated collector (the scalable path)
You **cannot scrape OLX/Telegram from Cloudflare Workers** — OLX has anti-bot
protection a Worker `fetch` can't pass, and Telegram channel history can only be
read by a logged-in user client (MTProto), not a bot. So a small **collector
runs off-Workers** (ideally on your always-on Vostro) and POSTs listings to the
site's ingest endpoint:

- **OLX** → `deploy/collector/olx-collector.mjs` (Playwright reference script).
  `npm i playwright && npx playwright install chromium`, set `INGEST_URL` +
  `MARKET_INGEST_SECRET`, run on a `cron`/systemd-timer every few hours.
- **Telegram** → use a **Telethon** (Python) or **gramJS** user client logged in
  with your own account + `api_id`/`api_hash`; read recent messages from the car
  channels you follow, and POST them to the same endpoint with
  `{ source: "telegram", listings: [{ brand, model, year, raw_text }] }`. The
  server parses the messy price text for you.

Set `MARKET_INGEST_SECRET` (a Worker secret) and the collector presents it as
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
