# Off-Workers collectors

Cloudflare Workers can't run a headless browser, persistent scrapers, or a local
LLM. These three Node scripts run on the dealer's own box (the Vostro / any Node
18+ machine) and feed the website over HTTP. They're intentionally separate from
the Next app and have their own deps.

```bash
cd deploy/collector
npm install
npx playwright install chromium   # for extractor.mjs + the OLX browser fallback
```

| Script | What it does | Talks to |
|---|---|---|
| `extractor.mjs` | Headless-browser media extractor — renders JS pages (AutoHome, AliExpress) and returns real gallery image URLs. | The app's `/api/admin/media/extract` calls it when `EXTRACTOR_URL` is set. |
| `olx-crawlee.mjs` | **Crawlee-based** OLX crawler (recommended) — managed retries, session pool, proxy rotation, fingerprints. | POSTs to `/api/admin/market/ingest`. |
| `olx-collector.mjs` | Legacy naive OLX scraper (fetch-loop + ad-hoc Playwright). Kept as a zero-dep fallback. | POSTs to `/api/admin/market/ingest`. |
| `alibaba-crawlee.mjs` | **Crawlee-based** Alibaba parts crawler — writes a reviewable DRAFT CSV. Needs residential `PROXY_URLS`. | Admin uploads the CSV to Parts → Import. |
| `olx-parts-crawlee.mjs` | **Crawlee-based** OLX parts crawler — proven API, **no proxies needed**; writes a reviewable DRAFT CSV. | Admin uploads the CSV to Parts → Import. |
| `telegram-collector.mjs` | Reads car-sales Telegram channels (MTProto / your account via gramJS). | POSTs to `/api/admin/market/ingest`. |
| `instagram-collector.mjs` | Instagram **official Graph API** hashtag discovery (no profile scraping). | Writes a JSON research report. |
| `proxy-check.mjs` | Verify `PROXY_URLS` connects + rotates before running the Alibaba crawler. | — |

All POSTs authenticate with `MARKET_INGEST_SECRET` (set the same value as a Worker
secret on the app). The extractor uses an optional `EXTRACTOR_SECRET`.

## Crawling framework: Crawlee (Node/TS)

The crawling layer is built on **[Crawlee](https://crawlee.dev)** — the same
Node/TS stack as the app, so there is **no second runtime (no Python) to maintain
on the box**. Crawlee gives every crawler, for free: a managed request queue,
automatic retries with backoff, a rotating **session pool** (banned cookie-sets
retired automatically), optional **proxy rotation**, realistic browser
**fingerprints**, and bounded concurrency. New targets (Alibaba parts, etc.) are
thin crawlers on top of `crawlee-shared.mjs`, which owns the cross-cutting policy.

`crawlee-shared.mjs` exports:
- `baseCrawlerOptions(overrides)` — retries / session pool / concurrency / proxy.
- `buildProxyConfiguration()` — reads `PROXY_URLS` (comma-separated); the real
  anti-bot lever for hostile targets. Unset → direct connection.
- `ingestListings(source, listings)` — chunked POST to the ingest endpoint.

Tuning env (all optional, sane defaults): `PROXY_URLS`, `CRAWL_MAX_CONCURRENCY`
(4), `CRAWL_MAX_RETRIES` (5).

> **When to add proxies / a paid API:** OLX is low-anti-bot — direct works.
> Alibaba/social media are hostile; set `PROXY_URLS` (residential), and for the
> worst targets prefer official APIs or a paid scraping API over fighting captchas.

## 1. Media extractor (AutoHome etc.)

```bash
export EXTRACTOR_SECRET="$(openssl rand -hex 16)"   # optional; match the app
export EXTRACTOR_PORT=8789
node extractor.mjs                                   # listens on :8789
```
On the app side set `EXTRACTOR_URL=http://localhost:8789` (+ `EXTRACTOR_SECRET`).
Only works where the app can reach this host — i.e. the **self-hosted / local**
deployment, NOT the Cloudflare Workers edge. The app always falls back to its
static parser, so this just upgrades coverage for JS-only galleries.

## 2. OLX crawler (Crawlee — recommended)

```bash
export INGEST_URL="https://tezmotors.uz/api/admin/market/ingest"   # or http://localhost:3000/...
export MARKET_INGEST_SECRET="…same value as the app secret…"
# optional: a JSON file of [{ "q":"byd song plus","brand":"BYD","model":"Song Plus" }, …]
export OLX_SEARCHES_FILE=./searches.json
# optional anti-bot/tuning:
export PROXY_URLS="http://user:pass@gw:8000"   # residential proxies if OLX starts blocking
export CRAWL_MAX_CONCURRENCY=4
node olx-crawlee.mjs
```
API-first (Crawlee `HttpCrawler` over OLX's JSON API), with a Crawlee-managed
`PlaywrightCrawler` fallback for any query the API misses. Schedule with cron,
e.g. `0 */6 * * *`. Respect OLX ToS/robots; run gently.

The legacy `node olx-collector.mjs` still works (no Crawlee dep) as a fallback.

## 3. Alibaba parts crawler (Crawlee → reviewable CSV)

Sources spare-parts listings from Alibaba into a CSV the dealer **reviews and
publishes** — it never auto-publishes scraped data. Output matches the
`Parts → Import` format exactly (rows are drafts: `is_published=false`).

```bash
export PROXY_URLS="http://user:pass@residential-gw:8000"   # STRONGLY recommended
# optional: searches file = [{ "q":"brake pads","category":"brakes","fits_brands":["BYD"] }, …]
export ALIBABA_SEARCHES_FILE=./alibaba-searches.json
export ALIBABA_OUT=./alibaba-parts.csv
export ALIBABA_PER_SEARCH=20
node alibaba-crawlee.mjs
```
Then in the app: **Admin → Parts → Import → upload `alibaba-parts.csv`** (run a
dry-run first), translate RU/UZ names, set OEM/fitment, then publish.

> **Anti-bot reality:** Alibaba aggressively blocks datacenter IPs. Without
> `PROXY_URLS` (residential) you'll get a captcha wall and `0 parts` — the crawler
> detects this, rotates the session, and exits with a clear message. Set residential
> proxies and run gently (`category` ∈ engine, body, electrical, suspension, brakes,
> interior, other). Verify product/price/image rights before publishing.

**Test your proxies first** (verifies they connect + rotate, before a real run):
```bash
export PROXY_URLS="http://user:pass@gw1:8000,http://user:pass@gw2:8000"
node proxy-check.mjs        # prints egress IP per probe; warns if not rotating
```
With no `PROXY_URLS` it reports your direct egress IP — the one Alibaba blocks.

## 4. OLX parts crawler (Crawlee → reviewable CSV, no proxies)

Like the Alibaba crawler but on OLX's **proven public API** — so it works without
proxies and is the fastest way to seed real, local parts sourcing. Output matches
`Parts → Import` exactly (drafts: `is_published=false`).

```bash
# optional: searches file = [{ "q":"тормозные колодки","category":"brakes","fits_brands":["BYD"] }, …]
export OLX_PARTS_SEARCHES_FILE=./olx-parts-searches.json
export OLX_PARTS_OUT=./olx-parts.csv
export OLX_PARTS_PER_SEARCH=20
export USD_UZS=12600        # UZS→USD for price_usd (admin verifies on review)
node olx-parts-crawlee.mjs
```
Prices convert UZS→USD (original sum label + condition + city + source URL go into
`description_ru` for the admin). Then **Admin → Parts → Import** (dry-run first),
translate UZ/EN names, set OEM/fitment, publish. `category` ∈ engine, body,
electrical, suspension, brakes, interior, other.

## 5. Telegram collector

```bash
# one-time: get api_id/api_hash at https://my.telegram.org, then mint a session:
export TG_API_ID=123456 TG_API_HASH=abc...
node telegram-collector.mjs --login          # asks phone + code → prints TG_SESSION

export TG_SESSION="1Ab...="                  # from --login (treat as a password)
export TG_CHANNELS="@autosalon_tashkent,@bu_avto_uz"
export INGEST_URL="https://tezmotors.uz/api/admin/market/ingest"
export MARKET_INGEST_SECRET="…same value as the app secret…"
node telegram-collector.mjs
```
Only messages matching the brand/model dictionary in `telegram-collector.mjs`
become listings (keeps the data clean) — extend `MODELS` for what you track.

## 6. Instagram content discovery (official Graph API)

Social media is best sourced via **official APIs**, not fragile profile scrapers
(which break constantly and risk bans/ToS). Instagram's API permits **Hashtag
Search** for a connected Business/Creator account — find trending/top public car
content for marketing + competitor research. It writes a JSON report (this is
research, not catalog data).

```bash
export IG_ACCESS_TOKEN="EAAB..."     # long-lived token (instagram_basic + manage_insights)
export IG_USER_ID="178414..."         # your IG Business account id
export IG_HASHTAGS="avtosalontashkent,byduzbekistan,cheryuzbekistan"
export IG_MEDIA_TYPE=top               # top | recent
node instagram-collector.mjs           # → instagram-report.json
```
Setup (one-time, Meta side) + limits are documented in the file header. Without a
token it skips cleanly (fail-open). **Arbitrary profile scraping is intentionally
not supported** — the official API doesn't allow it, and unofficial scraping isn't
worth the breakage/ban risk.

## Local LLM (Ollama) — free, for the self-hosted app

The collectors don't need an LLM, but the app's generative features (operator
briefings, marketing copy, lead/supplier replies, market parsing) do. To run them
free on this same box:

```bash
# install Ollama (https://ollama.com), then:
ollama pull qwen2.5:7b-instruct   # good Russian/Uzbek; qwen2.5:3b-instruct is faster
ollama serve                      # http://localhost:11434
```
In the app's env: `LLM_PROVIDER=openai`, `LLM_API_URL=http://localhost:11434/v1`,
`LLM_MODEL=qwen2.5:7b-instruct` (no key). Same reachability caveat as the
extractor — point at Ollama from the self-hosted/local app, not the Workers edge.

## Scheduling

A simple crontab on the box:
```
0 */6 * * *  cd /path/deploy/collector && MARKET_INGEST_SECRET=… INGEST_URL=… node olx-crawlee.mjs >> olx.log 2>&1
30 */6 * * * cd /path/deploy/collector && TG_SESSION=… TG_CHANNELS=… MARKET_INGEST_SECRET=… INGEST_URL=… node telegram-collector.mjs >> tg.log 2>&1
@reboot      cd /path/deploy/collector && EXTRACTOR_SECRET=… node extractor.mjs >> extractor.log 2>&1
```
