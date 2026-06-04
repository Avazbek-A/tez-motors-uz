# Tez Motors — Vostro Deployment Guide (detailed)

A complete, beginner-friendly walkthrough to put the site **live on your own
Ubuntu machine (the "Vostro")**, with **`git push` → automatic deploy**. Free
(no cloud bill), fast for Tashkent visitors (Cloudflare CDN in front), and the
laptop battery doubles as a UPS during power cuts.

You do this **once**. After that you (or anyone) just `git push` and the site
updates itself.

---

## Contents
1. [How it fits together](#1-how-it-fits-together)
2. [Before you start (checklist)](#2-before-you-start-checklist)
3. [Where each secret comes from](#3-where-each-secret-comes-from)
4. [Step A — prepare the Vostro](#4-step-a--prepare-the-vostro)
5. [Step B — clone + bootstrap (one command)](#5-step-b--clone--bootstrap-one-command)
6. [Step C — go public with a Cloudflare Tunnel](#6-step-c--go-public-with-a-cloudflare-tunnel)
7. [Step D — turn on `git push` auto-deploy (GitHub webhook)](#7-step-d--turn-on-git-push-auto-deploy-github-webhook)
8. [Step E — verify everything](#8-step-e--verify-everything)
9. [Step F — free local AI (Ollama)](#9-step-f--free-local-ai-ollama)
10. [Step G — scheduled jobs + health alerts](#10-step-g--scheduled-jobs--health-alerts)
11. [Step H — database backups](#11-step-h--database-backups)
12. [Day-2 operations](#12-day-2-operations)
13. [Troubleshooting](#13-troubleshooting)
14. [Security checklist](#14-security-checklist)

---

## 1. How it fits together

```
 you ──git push──▶ GitHub ──webhook──▶  ┌─────────────── Vostro (Ubuntu) ───────────────┐
                                        │  cloudflared  ◀── public HTTPS (tezmotors.uz)  │
 visitor ─▶ Cloudflare CDN ─tunnel────▶ │     │                                          │
                                        │     ├─▶ tez-motors.service   :3000  (the app)  │
                                        │     └─▶ tez-motors-webhook    :9090  (deploys)  │
                                        │              │ runs update.sh on push           │
                                        │  Ollama :11434 (free AI)   Supabase (cloud DB)  │
                                        └────────────────────────────────────────────────┘
```

- **The app** runs as a systemd service (`tez-motors`) on `localhost:3000` — the
  standard Node production server (no Cloudflare Workers 3 MiB limit).
- **Cloudflared** opens an outbound tunnel to Cloudflare, so `tezmotors.uz`
  serves from your machine over HTTPS **with no open ports and no public IP**.
- **The webhook** (`tez-motors-webhook` on `localhost:9090`) receives GitHub
  push events through that same tunnel and runs `update.sh` (pull → build →
  restart → health-check, with automatic rollback if the build fails).
- **The database stays on Supabase** (cloud) — the Vostro holds no customer data
  at rest beyond logs.

---

## 2. Before you start (checklist)

- [ ] An Ubuntu 22.04 machine (the Vostro), **plugged into power** and on
  **wired Ethernet** (the RTL8821CE Wi-Fi is flaky for 24/7 use).
- [ ] A Cloudflare account with your domain (`tezmotors.uz`) added to it.
- [ ] The GitHub repo (`Avazbek-A/tez-motors-uz`) with admin access (to add a webhook).
- [ ] Your Supabase project keys (see §3).
- [ ] ~30 minutes.

You do **not** need: a public IP, port-forwarding, Docker, or a paid plan.

---

## 3. Where each secret comes from

You'll paste these into `.env.local` in Step B. **Required** (the build fails
without them); everything else is optional and fails open (the feature just
stays off until you add its key).

| Key | Required? | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → API → `service_role` key (server-only — keep secret) |
| `ADMIN_PASSWORD` | ✅ | You choose it. This logs you into `/admin`. Use a strong one. |
| `UPDATE_WEBHOOK_SECRET` | auto | The bootstrap generates it; you paste it into GitHub in Step D |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | optional | @BotFather + @userinfobot — enables lead alerts, deploy ✅/❌ pings, downtime alerts |
| `CRON_SECRET` | optional | You choose it — needed only if you run scheduled jobs (§10) |
| `LLM_API_URL` / `LLM_PROVIDER` / `LLM_MODEL` | optional | Set to local Ollama (§9) for free AI |
| `RESEND_API_KEY` / `EMAIL_FROM` / `DEALER_EMAIL` | optional | resend.com — customer/dealer email |
| `MARKET_INGEST_SECRET`, `EXTRACTOR_URL` | optional | For the OLX/Telegram collectors + AutoHome extractor (§ collectors) |

> Everything is documented inline in `.env.example` — the bootstrap copies it to
> `.env.local` for you to edit.

---

## 4. Step A — prepare the Vostro

Open a terminal on the Vostro.

**Stop it sleeping when the lid closes** (a closed lid must not take the site down):
```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
sudo sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
```

(Node + git are installed automatically by the bootstrap if missing — you don't
need to install them yourself.)

---

## 5. Step B — clone + bootstrap (one command)

```bash
cd ~
git clone https://github.com/Avazbek-A/tez-motors-uz.git tez-motors
cd tez-motors

# First run: creates .env.local from the template and tells you which keys to fill, then exits.
bash deploy/selfhost/bootstrap.sh

# Fill the 4 required keys (see §3):
nano .env.local
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=...
#   ADMIN_PASSWORD=...
# Save: Ctrl-O, Enter, Ctrl-X

# Second run: does everything automatable.
bash deploy/selfhost/bootstrap.sh
```

**What the second run does** (all idempotent — safe to re-run any time):
1. Installs **Node 20** if it's missing.
2. Verifies the 4 required keys are set; **auto-generates `UPDATE_WEBHOOK_SECRET`**
   and sets `DEPLOY_BRANCH=main` in `.env.local`; `chmod 600` it.
3. `npm ci` then `npm run selfhost:build` (builds the standalone server).
4. Installs two **systemd services**, templated to *your* Linux user and the
   real checkout path:
   - `tez-motors` — the app on `:3000`
   - `tez-motors-webhook` — the auto-deploy listener on `:9090`
5. Grants the webhook **passwordless `systemctl restart tez-motors`** (only that
   one command, via a validated `/etc/sudoers.d/tez-motors`).
6. Enables + starts both services and **health-checks** the app.

When it finishes it prints the **two remaining manual steps** (C and D below)
and echoes your `UPDATE_WEBHOOK_SECRET`. Copy that secret — you need it in Step D.

At this point the app is already running locally:
```bash
curl -I http://localhost:3000        # → HTTP/1.1 200 or 307
```

---

## 6. Step C — go public with a Cloudflare Tunnel

This gives `tezmotors.uz` HTTPS from your machine — no open ports.

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
sudo install cloudflared /usr/local/bin/ && rm cloudflared

# Authenticate (opens a browser — pick your domain) and create the tunnel
cloudflared tunnel login
cloudflared tunnel create tez-motors

# Route both the site and the deploy endpoint to this tunnel
cloudflared tunnel route dns tez-motors tezmotors.uz
cloudflared tunnel route dns tez-motors www.tezmotors.uz
cloudflared tunnel route dns tez-motors deploy.tezmotors.uz
```

Create `~/.cloudflared/config.yml` (replace `<UUID>` with the file in
`~/.cloudflared/`, and `YOUR_USER`):
```yaml
tunnel: tez-motors
credentials-file: /home/YOUR_USER/.cloudflared/<UUID>.json
ingress:
  - hostname: tezmotors.uz
    service: http://localhost:3000
  - hostname: www.tezmotors.uz
    service: http://localhost:3000
  - hostname: deploy.tezmotors.uz      # the GitHub webhook endpoint
    service: http://localhost:9090
  - service: http_status:404
```

Run it as a service:
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Visit **https://tezmotors.uz** — it should load from your machine.

---

## 7. Step D — turn on `git push` auto-deploy (GitHub webhook)

1. Get your secret (printed by the bootstrap, or read it back):
   ```bash
   grep '^UPDATE_WEBHOOK_SECRET=' ~/tez-motors/.env.local
   ```
2. GitHub → your repo → **Settings → Webhooks → Add webhook**:
   - **Payload URL:** `https://deploy.tezmotors.uz/webhook`
   - **Content type:** `application/json`
   - **Secret:** *(paste the `UPDATE_WEBHOOK_SECRET` value)*
   - **Which events:** "Just the `push` event"
   - **Active:** ✓ → **Add webhook**
3. GitHub immediately sends a "ping". In the webhook's **Recent Deliveries** tab
   you should see a `200` response (`pong`).

**Done.** From now on, every `git push` to `main` triggers: GitHub → webhook →
`update.sh` → pull → `npm ci` → build → restart → health-check. If the build
fails, the running site is left untouched and the tree rolls back. You get a
Telegram ✅/❌ if you set the bot token.

---

## 8. Step E — verify everything

```bash
# Services are active?
systemctl status tez-motors tez-motors-webhook cloudflared --no-pager | grep -E "Active:|●"

# App healthy locally?
curl -fsS http://localhost:3000/api/cars?limit=1 >/dev/null && echo "app OK"

# Webhook listening?
curl -fsS http://localhost:9090/health && echo " webhook OK"

# Public site loads?
curl -I https://tezmotors.uz
```

**End-to-end auto-deploy test** — from your laptop, make a trivial change and push:
```bash
git commit --allow-empty -m "deploy test" && git push origin main
```
Within ~1–2 minutes the webhook runs `update.sh`. Watch it on the Vostro:
```bash
journalctl -u tez-motors-webhook -f
```
You should see `→ deploy … ✓ deploy … ok` (and a Telegram ping if configured).

Log into the admin to confirm: **https://tezmotors.uz/admin** with your `ADMIN_PASSWORD`.

---

## 9. Step F — free local AI (Ollama)

The platform's AI (operator briefings, the Dealer Copilot, marketing copy,
"Find my car", AutoHome spec vision) runs **free** on the Vostro via Ollama.

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:7b-instruct      # text — strong Russian/Uzbek (3b is faster)
ollama pull qwen2.5-vl               # vision — reads obfuscated AutoHome CN specs
sudo systemctl enable --now ollama
```
Add to `.env.local`, then `bash deploy/selfhost/bootstrap.sh` (or
`sudo systemctl restart tez-motors`):
```
LLM_PROVIDER=openai
LLM_API_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:7b-instruct
LLM_VISION_MODEL=qwen2.5-vl
# LLM_API_KEY=    (leave empty for local Ollama)
```
Verify in admin: **Setup → AI brain → Test connection**.

---

## 10. Step G — scheduled jobs + health alerts

The app's automation (FX rate refresh, lead digests, follow-ups, marketing
autopilot, price-watch sweeps, etc.) lives at `/api/cron/*`, guarded by
`CRON_SECRET`. The simplest fully-offline option is the host crontab.

1. Set `CRON_SECRET` in `.env.local` (any strong value) and restart:
   `bash deploy/selfhost/bootstrap.sh`.
2. Edit your crontab — `crontab -e` — sourcing the secret and mirroring the
   schedule in `cron-worker/wrangler.toml` (or `deploy/selfhost/crontab`). The
   helper `deploy/selfhost/fire-cron.sh` fires one route; set `APP_URL` +
   `CRON_SECRET` in the crontab environment. Example:
   ```
   APP_URL=http://localhost:3000
   CRON_SECRET=your-cron-secret
   0 1 * * *    /home/YOUR_USER/tez-motors/deploy/selfhost/fire-cron.sh /api/cron/rates
   0 3 * * *    /home/YOUR_USER/tez-motors/deploy/selfhost/fire-cron.sh /api/cron/ops-digest
   20 */2 * * * /home/YOUR_USER/tez-motors/deploy/selfhost/fire-cron.sh /api/cron/reservation-recovery
   # …copy the rest from cron-worker/wrangler.toml
   ```
3. **Downtime alerts** — add a liveness probe (needs `TELEGRAM_BOT_TOKEN` +
   `TELEGRAM_CHAT_ID` exported in the crontab env):
   ```
   */5 * * * *  /home/YOUR_USER/tez-motors/deploy/selfhost/healthcheck.sh
   ```
   It pings the app every 5 min and Telegrams you on DOWN → and again on recovery.

---

## 11. Step H — database backups

Supabase backs up your data, but keep your own copy too (you take deposits):
```bash
sudo apt-get install -y postgresql-client
mkdir -p ~/backups
# SUPABASE_DB_URL = Supabase → Settings → Database → Connection string (URI)
pg_dump "$SUPABASE_DB_URL" -Fc -f ~/backups/tez-$(date +%F).dump
```
Add to cron (nightly) and copy `~/backups` to an external drive periodically.

---

## 12. Day-2 operations

| Task | Command (on the Vostro) |
|---|---|
| **Deploy now** (manual) | `./deploy/selfhost/update.sh` |
| Deploy + run new migrations | `./deploy/selfhost/update.sh --migrate` |
| Deploy a different branch | `./deploy/selfhost/update.sh --branch=hotfix` |
| **Roll back** a bad deploy | `./deploy/selfhost/rollback.sh HEAD~1` (or a full SHA) |
| App logs (live) | `journalctl -u tez-motors -f` |
| Deploy logs (live) | `journalctl -u tez-motors-webhook -f` |
| Restart the app | `sudo systemctl restart tez-motors` |
| Change a secret | edit `.env.local` → `sudo systemctl restart tez-motors` |
| Re-run full setup | `bash deploy/selfhost/bootstrap.sh` (idempotent) |

> **Migrations:** a `git push` runs `update.sh` *without* `--migrate`, so schema
> changes are NOT auto-applied (safer). When a deploy includes a new
> `supabase/migrations/*.sql`, run `./deploy/selfhost/update.sh --migrate` once,
> or apply it via the Supabase SQL editor.

---

## 13. Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| `bootstrap.sh` exits saying a key is empty | Fill `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_PASSWORD` in `.env.local`, re-run. |
| `npm run selfhost:build` fails | Usually a missing `NEXT_PUBLIC_*` value (baked at build time). Check `.env.local`, re-run. |
| App not 200 on `:3000` | `journalctl -u tez-motors -n 80` — most often a wrong Supabase key. |
| `https://tezmotors.uz` doesn't load | `systemctl status cloudflared`; check `~/.cloudflared/config.yml` ingress + that DNS routes point to the tunnel. |
| Push doesn't deploy | GitHub → Webhook → Recent Deliveries: non-200? Check the **Secret** matches `UPDATE_WEBHOOK_SECRET`, Payload URL is `…/webhook`, and `deploy.tezmotors.uz` ingress + DNS exist. Then `journalctl -u tez-motors-webhook -n 80`. |
| Deploy fails at restart (password prompt) | The sudoers drop-in didn't match. Re-run `bootstrap.sh`; verify `sudo -n systemctl restart tez-motors` works without a password. |
| Build fails on a deploy | The site keeps running on the old build (by design). Fix the code, push again; or `rollback.sh`. |
| AI features inert | Ollama not running or `.env.local` LLM vars unset — see §9; everything fails open to templates. |

---

## 14. Security checklist

- `.env.local` is `chmod 600` (the bootstrap enforces it) — never commit it.
- The `service_role` key and `ADMIN_PASSWORD` are server-only; never expose them.
- The webhook user has passwordless sudo for **exactly one** command
  (`systemctl restart tez-motors`) — nothing else.
- **Rotate `ADMIN_PASSWORD` before handing over to the client** and deliver the
  new value via **1Password or a signed PDF — never Telegram/SMS**.
- Keep the Vostro updated: `sudo apt-get update && sudo apt-get upgrade -y`.
- The GitHub webhook is HMAC-verified (`X-Hub-Signature-256`); a wrong/missing
  signature is rejected with 401.

---

That's the whole job. Once Steps A–D are done, your operational loop is just:
**`git push` → site updates itself → Telegram confirms ✅.**
