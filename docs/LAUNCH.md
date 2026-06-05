# Go-live runbook

The ordered checklist to take Tez Motors from "built" to "live and taking
business." Do the steps in order. `HANDOFF.md` is the reference for *why* /
details; this is the *do-this-now* sequence.

Owner decisions you must make up front:
- **Hosting:** Path A (Cloudflare Workers Paid, $5/mo) **or** Path B (self-host
  on the Vostro / a VPS, ~free). See step 4.
- **Which integrations to turn on at launch** (payments, SMS, AI). Each ships
  dark until its keys are set — you can launch with just the required set and
  enable the rest later, no redeploy of code needed (just add secrets).

---

## 1. Database (Supabase)
- [ ] Create a Supabase project (region close to UZ, e.g. Frankfurt).
- [ ] `npm run migrations:bundle` → paste `supabase/ALL_MIGRATIONS.sql` into the
      SQL editor once (fresh project). Confirm no errors.
- [ ] `npm run verify:migrations` locally (sequential, well-formed).
- [ ] Spot-check RLS: anon `select` on `inquiries` / `orders` / `payments`
      returns **0 rows / denied**; `cars` (published) returns rows.
- [ ] Seed the first **owner** admin (SQL in HANDOFF §3).
- [ ] Database → Backups: enable daily backups / PITR.

## 2. Storage
- [ ] Create public buckets `car-images` and `part-images` (public read).

## 3. Secrets & config
- [ ] Fill the **required** group (HANDOFF §1): `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
      `ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`.
- [ ] Add **recommended**: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`,
      `CRON_SECRET`, `RESEND_API_KEY` + `EMAIL_FROM` + `DEALER_EMAIL`,
      Turnstile keys.
- [ ] `npm run check:env .env.local` → all required ✓ **and the INTEGRITY
      section clean** before deploying. It now fails on half-configured
      integrations — e.g. a Payme/Click public merchant id set without its
      secret (the deposit button renders but checkout 401s), a VAPID public key
      with no signing keypair, a Resend key with no verified sender, or an
      `LLM_API_URL` pointing at localhost (unreachable from the Workers edge).
      A group either fully set ("live") or fully unset ("dark") is fine; the
      half-set middle is what breaks for real users.

## 4. Deploy (pick ONE)
**Path A — Workers (Paid plan required — free tier rejects the >3 MiB Worker):**
- [ ] Upgrade to Workers Paid.
- [ ] `wrangler kv namespace create RATE_LIMIT_KV` → put the id in `wrangler.toml`.
- [ ] `wrangler secret put …` for each server secret.
- [ ] `npm run deploy`.

**Path B — Self-host (no size cap; ~free on the Vostro or a VPS):**
- [ ] **Easiest — Docker:** `cp .env.example .env` (fill required values) →
      `docker compose up -d --build`. App serves on `:3000` with a healthcheck.
- [ ] **Or bare Node:** follow `deploy/selfhost/SETUP.md` (install Node, `npm ci`,
      `npm run selfhost:build`, install `tez-motors.service` + `cloudflared.service`).
- [ ] Point a free Cloudflare Tunnel at `http://localhost:3000`; map `tezmotors.uz`
      to it (no open ports needed).

## 5. Scheduled jobs (cron Worker)
- [ ] `cd cron-worker && wrangler secret put CRON_SECRET` (SAME value as the app).
- [ ] Set `APP_BASE_URL` in `cron-worker/wrangler.toml` if the domain differs.
- [ ] `wrangler deploy`. **Docker self-host needs no separate step** — the
      `cron` sidecar in `docker-compose.yml` already fires every `/api/cron/*`
      on the canonical schedule (set `CRON_SECRET` in `.env`). Bare-Node alt: add
      `deploy/selfhost/crontab` to the host crontab.

## 6. Verify the live site
- [ ] `npm run smoke https://tezmotors.uz` → public 200s, admin/cron guards 401.
- [ ] Log into `/admin`, create a test car, confirm it appears on `/ru/catalog`.
- [ ] Submit a test inquiry → Telegram/email alert arrives → shows in
      `/admin/inquiries` and the customer appears in `/admin/customers`.

## 7. Real data (replaces demo seed)
- [ ] Remove demo seed rows (HANDOFF §7) OR import the dealer's real inventory
      CSV (upserts on slug, so it overwrites cleanly).
- [ ] Load real photos via the admin car/part forms or the media importer
      (`docs/MEDIA_SOURCING.md`).
- [ ] Set the live USD/UZS + CNY rate by running the rates cron once
      (`/run?path=/api/cron/rates` on the cron Worker, or wait for the schedule).

## 8. Integrations to enable when ready (no code redeploy — just secrets)
- [ ] **Payments:** Payme / Click onboarding → set merchant secrets + the
      `NEXT_PUBLIC_*_MERCHANT_ID` (reveals the deposit button). Run each
      provider's **sandbox** suite first (HANDOFF §2.7).
- [ ] **SMS OTP:** Eskiz creds + approved sender.
- [ ] **AI assistant:** `LLM_API_KEY`.
- [ ] **WhatsApp / Telegram inbound bots:** webhook + secret (HANDOFF §2.5–2.6).
- [ ] **Market-intel collector:** `MARKET_INGEST_SECRET` + run the collector on
      the Vostro (`docs/MARKET_INTEL.md`).
- [ ] **Analytics:** `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`; connect Google Search Console.

## 9. Handoff hygiene
- [ ] Rotate `ADMIN_PASSWORD`; deliver all secrets via 1Password / signed PDF —
      never chat (HANDOFF §4).
- [ ] Confirm ops alerts fire (break a cron secret → dealer gets an alert).

---

### Minimum viable launch
You can go live with just **steps 1–7** (required + Telegram + email). Everything
in step 8 is additive and can be switched on afterward by adding secrets.
