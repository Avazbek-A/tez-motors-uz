# Self-hosting Tez Motors on Ubuntu (offline / free)

Run the site on your own Linux machine (e.g. a Dell Vostro on Ubuntu 22.04) and
expose it through a **Cloudflare Tunnel** — no public IP, no port-forwarding, no
cloud bill. Cloudflare's CDN sits in front (fast for visitors near Tashkent);
only dynamic requests reach your machine. The database stays on Supabase.

This path uses the **standard Node server** (`next start`), not the Cloudflare
Workers/OpenNext build — so there is **no 3 MiB bundle limit**, and the KV rate
limiter correctly falls back to the in-memory limiter (valid on a single
always-on server).

---

## 0. Prerequisites
- Ubuntu 22.04, **plugged in** and on **wired Ethernet** (the RTL8821CE Wi-Fi
  driver is flaky for 24/7 use — use the Gigabit port).
- A Cloudflare account with `tezmotors.uz` (or your domain) added.
- Your Supabase project URL + keys, and any other secrets (see `.env.example`).

## 1. Install Node 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # v20.x
```

## 2. Get the code + secrets
```bash
cd ~
git clone https://github.com/Avazbek-A/tez-motors-uz.git tez-motors
cd tez-motors
git checkout design/cinematic-showroom   # or main, once merged
cp .env.example .env.local
nano .env.local        # fill REQUIRED keys (Supabase URL/anon/service, ADMIN_PASSWORD)
chmod 600 .env.local   # keep secrets readable only by you
```

## 3. Build + smoke-test
```bash
npm ci
npm run selfhost:build        # next build + copies static/public beside the standalone server
# smoke test — load env, then run the standalone server (it doesn't auto-read .env.local):
set -a; source .env.local; set +a
npm run selfhost:start        # http://localhost:3000 — Ctrl-C after you confirm it loads
```

## 4. Run it as a service (auto-restart, survives reboot)
The unit runs the standalone server and injects secrets via
`EnvironmentFile=.env.local` (the standalone server, unlike `next start`, does
not auto-load it). Replace **both** `YOUR_USER` placeholders and the paths.
```bash
sudo cp deploy/selfhost/tez-motors.service /etc/systemd/system/
sudo nano /etc/systemd/system/tez-motors.service   # set YOUR_USER in User=, WorkingDirectory=, EnvironmentFile=, ExecStart=
sudo systemctl daemon-reload
sudo systemctl enable --now tez-motors
systemctl status tez-motors        # should be "active (running)"
curl -I http://localhost:3000      # 200 / 307
```

## 5. Expose it with Cloudflare Tunnel (free, HTTPS, no open ports)
```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
sudo install cloudflared /usr/local/bin/ && rm cloudflared

cloudflared tunnel login                     # opens browser, pick your domain
cloudflared tunnel create tez-motors          # creates ~/.cloudflared/<UUID>.json
cloudflared tunnel route dns tez-motors tezmotors.uz
cloudflared tunnel route dns tez-motors www.tezmotors.uz
```
Create `~/.cloudflared/config.yml`:
```yaml
tunnel: tez-motors
credentials-file: /home/YOUR_USER/.cloudflared/<UUID>.json
ingress:
  - hostname: tezmotors.uz
    service: http://localhost:3000
  - hostname: www.tezmotors.uz
    service: http://localhost:3000
  - service: http_status:404
```
Install it as a service:
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```
Visit `https://tezmotors.uz` — it should serve from your machine through Cloudflare.

> The included `cloudflared.service` is a manual fallback; `cloudflared service
> install` is preferred (it wires credentials + config for you).

## 6. Never sleep (a closed lid must not take the site down)
```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
# Lid close = ignore (GNOME/logind):
sudo sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
```
The laptop battery doubles as a UPS for short power cuts — a real plus in Tashkent.

## 7. Cron jobs (scheduled automation)
The app's scheduled jobs live at `/api/cron/*` and are guarded by `CRON_SECRET`.
Two options:
- **Local cron (simplest, fully offline):** add to `crontab -e`, calling the
  routes with the secret. Example (FX rate at 06:00, ops digest at 08:00,
  reservation recovery every 2h):
  ```
  0 1 * * *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/rates
  0 3 * * *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ops-digest
  20 */2 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reservation-recovery
  ```
  (Mirror the full schedule from `cron-worker/wrangler.toml`. Put `CRON_SECRET`
  in the crontab or a sourced file.)
- **Cloudflare cron-worker:** deploy `cron-worker/` as before, pointing
  `APP_BASE_URL` at `https://tezmotors.uz`.

## 8. Updating after a new commit
```bash
cd ~/tez-motors
git pull
npm ci
npm run selfhost:build
sudo systemctl restart tez-motors
```

## 9. Database backups (do this — you take deposits)
Supabase holds the data, but enable backups and also keep your own:
```bash
# Nightly logical backup to the laptop (install postgresql-client for pg_dump):
pg_dump "$SUPABASE_DB_URL" -Fc -f ~/backups/tez-$(date +\%F).dump
```
Add to cron; copy `~/backups` to an external drive periodically. Apply pending
SQL migrations from `supabase/migrations/` via the Supabase SQL editor in order.

## 10. Free local AI (Ollama) — the big self-host win

Self-hosting is the ONLY way the platform's AI runs for free (a Cloudflare
Workers edge can't reach a local model). With Ollama on this same box, the
operator briefings, marketing copy, lead/supplier draft replies, the "Find my
car" assistant and market-text parsing all work at $0/token.
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:7b-instruct      # great RU/UZ; qwen2.5:3b-instruct is faster
sudo systemctl enable --now ollama   # serves http://localhost:11434
```
Add to `.env.local`, then `sudo systemctl restart tez-motors`:
```
LLM_PROVIDER=openai
LLM_API_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:7b-instruct
# LLM_API_KEY=   (leave empty for local Ollama)
```
Verify in the admin: **Setup → AI brain → Test connection** (should reply OK).

## 11. Market collectors + media extractor (run on this box)

These can't run on Workers either (anti-bot, a headless browser, Telegram
MTProto). Full setup in `deploy/collector/README.md`. In short:
```bash
cd ~/tez-motors/deploy/collector && npm install && npx playwright install chromium
# set INGEST_URL=https://tezmotors.uz/api/admin/market/ingest + MARKET_INGEST_SECRET
node olx-collector.mjs            # + schedule in cron (every 6h)
node telegram-collector.mjs --login   # once → TG_SESSION, then schedule
node extractor.mjs &              # headless media extractor for AutoHome etc.
```
Set `MARKET_INGEST_SECRET` (and `EXTRACTOR_URL=http://localhost:8789`,
`EXTRACTOR_SECRET`) in the app's `.env.local` so ingest + the AutoHome
"Import from URL" button work. Car photos are already populated; to refresh:
`node scripts/fill-missing-car-photos.mjs && node scripts/mirror-car-images.mjs`.

## 12. Later: cut over to Cloudflare Workers (optional, paid)

To move the public site to Cloudflare's global edge (faster worldwide, no box to
keep up): upgrade the Cloudflare account to **Workers Paid** (~$5/mo → 10 MiB
limit; the free 3 MiB limit is too small for this app), then from a dev machine:
```bash
# (optional, recommended) Enable R2 in the dashboard, then restore the R2 cache:
#   open-next.config.ts → incrementalCache: r2IncrementalCache
#   wrangler.toml       → uncomment the [[r2_buckets]] binding
npx wrangler kv namespace create RATE_LIMIT_KV   # if not already (id is in wrangler.toml)
# set server secrets once: wrangler secret put SUPABASE_SERVICE_ROLE_KEY (etc.)
npm run deploy            # opennextjs-cloudflare build && deploy → tezmotors.uz
```
The Vostro then becomes the AI/scraper backend: keep Ollama + the collectors
running here; they POST market data to the Workers site via `MARKET_INGEST_SECRET`.
(LLM features on the Workers site need a hosted `LLM_API_KEY`, since Workers
can't reach this box's Ollama.)

---

### Reality check
- **Uptime is on you:** ISP outage / kernel panic / long power cut = site down,
  no failover. Fine for launch/staging; move to a $5 always-on host if uptime
  becomes critical.
- **Speed:** static assets are cached at Cloudflare's edge (fast); dynamic
  renders are limited by your home upload + the tunnel hop.
- **Security:** the tunnel opens no inbound ports; still, run the app as a
  non-root user and keep `.env.local` at `chmod 600`.
