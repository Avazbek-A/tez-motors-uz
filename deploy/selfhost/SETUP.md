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
npm run build
npm run start          # serves on http://localhost:3000 — Ctrl-C after you confirm it loads
```

## 4. Run it as a service (auto-restart, survives reboot)
```bash
sudo cp deploy/selfhost/tez-motors.service /etc/systemd/system/
sudo nano /etc/systemd/system/tez-motors.service   # set YOUR_USER + WorkingDirectory
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
npm run build
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

---

### Reality check
- **Uptime is on you:** ISP outage / kernel panic / long power cut = site down,
  no failover. Fine for launch/staging; move to a $5 always-on host if uptime
  becomes critical.
- **Speed:** static assets are cached at Cloudflare's edge (fast); dynamic
  renders are limited by your home upload + the tunnel hop.
- **Security:** the tunnel opens no inbound ports; still, run the app as a
  non-root user and keep `.env.local` at `chmod 600`.
