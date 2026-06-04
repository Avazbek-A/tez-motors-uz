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

## ⚡ Quick start — one command (recommended)

Most of the steps below are automated by a single bootstrap script. On the
Vostro:

```bash
# 1. Clone + enter
git clone https://github.com/Avazbek-A/tez-motors-uz.git tez-motors && cd tez-motors

# 2. First run creates .env.local from the template — fill the 4 required keys:
bash deploy/selfhost/bootstrap.sh        # prints which keys to set, then exits
nano .env.local                          # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
                                         # SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD

# 3. Run it again — installs Node, builds, installs+starts the app and the
#    auto-deploy webhook as systemd services, health-checks, prints what's left:
bash deploy/selfhost/bootstrap.sh
```

That leaves only the **two human-only steps** the script prints at the end: the
Cloudflare Tunnel login (§5) and pasting the webhook into GitHub (§13). After
those, **every `git push` to `main` deploys live automatically.** The numbered
sections below are the manual breakdown / reference if you want to do it by hand
or troubleshoot.

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
ollama pull qwen2.5:7b-instruct      # text: great RU/UZ; qwen2.5:3b-instruct is faster
ollama pull qwen2.5-vl               # VISION: reads obfuscated AutoHome CN spec screenshots
sudo systemctl enable --now ollama   # serves http://localhost:11434
```
Add to `.env.local`, then `sudo systemctl restart tez-motors`:
```
LLM_PROVIDER=openai
LLM_API_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:7b-instruct
LLM_VISION_MODEL=qwen2.5-vl          # for the AutoHome CN spec-sheet scrape
# LLM_API_KEY=   (leave empty for local Ollama)
```
The spec extractor (deploy/collector/extractor.mjs) renders obfuscated
car.autohome.com.cn config pages and screenshots them; the vision model reads the
parameter table into a clean spec sheet (the global.autohome.com EN site needs no
vision — it's parsed directly).
Verify in the admin: **Setup → AI brain → Test connection** (should reply OK).

## 11. Market collectors + media extractor (run on this box)

These can't run on Workers either (anti-bot, a headless browser, Telegram
MTProto). The crawlers are built on **Crawlee** (Node/TS — no Python runtime to
maintain) for managed retries, session rotation, proxy support, and
fingerprints. Full setup in `deploy/collector/README.md`. In short:
```bash
cd ~/tez-motors/deploy/collector && npm install && npx playwright install chromium
# set INGEST_URL=https://tezmotors.uz/api/admin/market/ingest + MARKET_INGEST_SECRET
node olx-crawlee.mjs              # car price intel (Crawlee) → market/ingest; cron every 6h
node olx-parts-crawlee.mjs        # parts sourcing (OLX API, no proxies) → draft CSV → Parts→Import
node alibaba-crawlee.mjs          # parts sourcing (needs residential PROXY_URLS) → draft CSV
node telegram-collector.mjs --login   # once → TG_SESSION, then schedule
node extractor.mjs &              # headless media extractor for AutoHome etc.
```
The parts crawlers write a reviewable DRAFT CSV (is_published=false) — upload it
in **Admin → Parts → Import** (dry-run first) and publish after review; scraped
data never auto-publishes. Set `PROXY_URLS` (residential) only for Alibaba.
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

## 13. Remote update & auto-deploy (Pages-grade ergonomics)

Turns `git push` into a live deploy on this box from anywhere — no SSH typing
required. Three parts: a remote-access tunnel, a one-command deploy script, and
a GitHub webhook listener.

### 13.1 Remote access without opening ports — Tailscale (recommended)

Free for personal use, gives you `ssh vostro` from any of your devices over an
encrypted mesh. No public IP, no port forwarding.
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up                    # opens a URL; sign in once
tailscale ip -4                      # note the 100.x.y.z address
# On your laptop: install Tailscale too, then `ssh YOUR_USER@<100.x.y.z>` works.
```
Alternative (no extra service): `cloudflared` already runs here for the public
site. Add an SSH route to the same tunnel — see `cloudflared access ssh` docs —
and `ssh -o ProxyCommand='cloudflared access ssh --hostname ssh.tezmotors.uz' …`.

### 13.2 One-command deploy script

Already in the repo at `deploy/selfhost/update.sh`. Atomic-ish: a failed `npm ci`
or build leaves the running service untouched and resets the working tree.
```bash
# From your laptop, anywhere:
ssh vostro 'cd ~/tez-motors && ./deploy/selfhost/update.sh'
# Schema bump? add --migrate (runs `supabase db push` after a green build):
ssh vostro 'cd ~/tez-motors && ./deploy/selfhost/update.sh --migrate'
# Bad deploy? roll back to any previous commit:
ssh vostro 'cd ~/tez-motors && ./deploy/selfhost/rollback.sh <sha>'
```
The script needs **passwordless `systemctl restart tez-motors`** for the unit
user. One line in `sudoers` makes that safe:
```bash
sudo visudo
# Add (replace YOUR_USER):
YOUR_USER ALL=(root) NOPASSWD: /bin/systemctl restart tez-motors
```

### 13.3 Auto-deploy on `git push` — GitHub webhook

Optional, but this is what makes Vostro feel like Cloudflare Pages.
```bash
# 1. Mint a strong webhook secret and put it in .env.local
echo "UPDATE_WEBHOOK_SECRET=$(openssl rand -hex 32)" >> .env.local
echo "DEPLOY_BRANCH=main" >> .env.local

# 2. Install the webhook listener as a systemd service
sudo cp deploy/selfhost/tez-motors-webhook.service /etc/systemd/system/
sudo nano /etc/systemd/system/tez-motors-webhook.service   # set YOUR_USER + paths
sudo systemctl daemon-reload
sudo systemctl enable --now tez-motors-webhook
systemctl status tez-motors-webhook

# 3. Expose 127.0.0.1:9090 → public HTTPS via the SAME cloudflared tunnel.
#    Add this ingress rule to ~/.cloudflared/config.yml (above the http_status:404):
#      - hostname: deploy.tezmotors.uz
#        service: http://localhost:9090
#    Route it: `cloudflared tunnel route dns tez-motors deploy.tezmotors.uz`,
#    then `sudo systemctl restart cloudflared`.

# 4. In GitHub: repo → Settings → Webhooks → Add webhook
#      Payload URL:  https://deploy.tezmotors.uz/webhook
#      Content type: application/json
#      Secret:       (the value of UPDATE_WEBHOOK_SECRET)
#      Events:       Just the push event
#    Save → GitHub sends a `ping`; check `journalctl -u tez-motors-webhook -n 5`
#    — you should see "pong".
```
Now every `git push origin main` triggers `update.sh` here. The dealer gets a
Telegram ping on success/failure (uses the existing `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_CHAT_ID`). At most one deploy runs at a time; rapid pushes coalesce.

## 14. Liveness check (alert if the box drops offline)

`deploy/selfhost/healthcheck.sh` pings `/api/cars?limit=1` and sends a Telegram
alert on UP→DOWN transitions (and another on the recovery), so a closed lid or
ISP outage doesn't go unnoticed. Run it from cron:
```bash
crontab -e
# Every 5 minutes; sources secrets from .env.local for the Telegram alert.
*/5 * * * *  set -a; . ~/tez-motors/.env.local; set +a; ~/tez-motors/deploy/selfhost/healthcheck.sh >> ~/tez-motors/healthcheck.log 2>&1
```

---

### Reality check
- **Uptime is on you:** ISP outage / kernel panic / long power cut = site down,
  no failover. Fine for launch/staging; move to a $5 always-on host if uptime
  becomes critical.
- **Speed:** static assets are cached at Cloudflare's edge (fast); dynamic
  renders are limited by your home upload + the tunnel hop.
- **Security:** the tunnel opens no inbound ports; still, run the app as a
  non-root user and keep `.env.local` at `chmod 600`.
