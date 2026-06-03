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
| `olx-collector.mjs` | Scrapes OLX (olx.uz) car listings — API-first, Playwright fallback. | POSTs to `/api/admin/market/ingest`. |
| `telegram-collector.mjs` | Reads car-sales Telegram channels (MTProto / your account via gramJS). | POSTs to `/api/admin/market/ingest`. |

All POSTs authenticate with `MARKET_INGEST_SECRET` (set the same value as a Worker
secret on the app). The extractor uses an optional `EXTRACTOR_SECRET`.

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

## 2. OLX collector

```bash
export INGEST_URL="https://tezmotors.uz/api/admin/market/ingest"   # or http://localhost:3000/...
export MARKET_INGEST_SECRET="…same value as the app secret…"
# optional: a JSON file of [{ "q":"byd song plus","brand":"BYD","model":"Song Plus" }, …]
export OLX_SEARCHES_FILE=./searches.json
node olx-collector.mjs
```
Schedule with cron, e.g. `0 */6 * * *`. Respect OLX ToS/robots; run gently.

## 3. Telegram collector

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
0 */6 * * *  cd /path/deploy/collector && MARKET_INGEST_SECRET=… INGEST_URL=… node olx-collector.mjs >> olx.log 2>&1
30 */6 * * * cd /path/deploy/collector && TG_SESSION=… TG_CHANNELS=… MARKET_INGEST_SECRET=… INGEST_URL=… node telegram-collector.mjs >> tg.log 2>&1
@reboot      cd /path/deploy/collector && EXTRACTOR_SECRET=… node extractor.mjs >> extractor.log 2>&1
```
