# Tez Motors — Operations & Handoff Guide

This document is what a new engineer (or the dealer's IT contact) needs to run
the site without the original author. It covers: which secrets are required vs.
optional, the one-time setup runbook, how to seed the first admin, credential
rotation, backups, and removing demo data before go-live.

The app is a Next.js (App Router) site deployed to **Cloudflare Workers via
OpenNext**, backed by **Supabase** (Postgres + Storage + RLS). A separate tiny
**cron Worker** (`cron-worker/`) fires the scheduled jobs.

> **Design note:** the visual design is intentionally a separate track — the
> owner plans a full redesign. Everything here is functional/operational.

---

## 1. Environment & secrets

Every external integration is **fail-open and env-gated**: if a key is unset,
that feature degrades gracefully (logs / no-ops / hides a button) and the site
keeps running. Only the **REQUIRED** group below must be set for a working
deployment. `.env.example` is the canonical, annotated list — this table is the
summary.

Secrets are set as **Cloudflare Worker secrets** in production
(`wrangler secret put NAME`), not committed. `NEXT_PUBLIC_*` values are build-time
public and may live in `wrangler.toml` `[vars]` or the dashboard.

> **See it in-product:** the admin **Setup** page (`/admin/setup`, System group)
> shows which integrations are connected vs not, what each unlocks, and the exact
> env vars to set for each — booleans only, never the secret values. Use it after
> any deploy to confirm what's live.

### Required (site is broken without these)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (RLS-gated reads only) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Privileged writes + all PII/money tables. Never expose to the browser. |
| `ADMIN_PASSWORD` | Admin panel login. Rotate before handoff (see §4). |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin (e.g. `https://tezmotors.uz`) |

### Recommended (core operations, fail-open if unset)

| Variable | Feature | If unset |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | New-lead notifications to dealer | No Telegram alerts |
| `TELEGRAM_ERROR_CHAT_ID` | Routes **ops alerts** (cron/payment/notify failures) to a separate channel | Falls back to `TELEGRAM_CHAT_ID` |
| `RESEND_API_KEY`, `EMAIL_FROM`, `DEALER_EMAIL` | Transactional email + dealer lead-email fallback + ops alerts | Telegram-only; customer confirmations skipped |
| `CRON_SECRET` | Shared bearer secret for `/api/cron/*` (set on BOTH app and cron Worker) | Cron routes allow unauthenticated manual runs (dev only) — **set in prod** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | Cloudflare Turnstile bot protection on public forms | Honeypot + rate limiter remain the gate |
| `RATE_LIMIT_KV` (binding, not env) | Durable cross-isolate rate limiting | Falls back to per-isolate in-memory (weaker). **Fix in prod — see §2.1** |

### Optional integrations (each ships dark until provisioned)

| Variable(s) | Feature |
|---|---|
| `LLM_API_KEY` (`LLM_API_URL`, `LLM_MODEL`) | AI "Find my car" assistant (else retrieval-only) |
| `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM` | Customer phone-OTP SMS (else OTP logged server-side) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push (else toggle hidden) |
| `PAYME_MERCHANT_ID`, `PAYME_MERCHANT_KEY`, `NEXT_PUBLIC_PAYME_MERCHANT_ID` | Payme online deposits |
| `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `NEXT_PUBLIC_CLICK_MERCHANT_ID` | Click.uz deposits (second rail) |
| `TELEGRAM_WEBHOOK_SECRET` | Inbound Telegram bot (reuses `TELEGRAM_BOT_TOKEN`) |
| `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | Inbound WhatsApp bot (Meta Cloud API) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_TAWK_ID` | Analytics + live chat |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_VERIFICATION`, `NEXT_PUBLIC_YANDEX_VERIFICATION` | Search-engine verification meta tags |

---

## 2. One-time setup runbook

### 2.0 Database

1. Create a Supabase project. Copy the URL, anon key, and service-role key.
2. Apply migrations **in numeric order** from `supabase/migrations/` (001 →
   043) via the Supabase SQL editor or CLI. They are ordered and must be applied
   in sequence; some depend on earlier ones (e.g. trigram RPCs, the
   `inventory_status` GENERATED column, the `inquiries.type` CHECK).
   - **Fresh project shortcut:** run `npm run migrations:bundle` to generate
     `supabase/ALL_MIGRATIONS.sql` (all 43 concatenated in order) and paste it
     once into the SQL editor. For an *existing* DB, apply only the new files.
   - `npm run verify:migrations` confirms numbering is sequential and well-formed.
3. Verify RLS is enabled on PII/money/internal tables (service-role only, **no
   policies**): `inquiries`, `orders`, `order_events`, `payments`, `customers`,
   `customer_sessions`, `otp_codes`, `newsletter_subscribers`, `admin_audit`,
   `car_costs`, `purchase_orders`, `cron_runs`, `error_events`,
   `assistant_messages`, `assistant_conversations`, `market_listings`,
   `crm_tasks`, `campaigns`, `shipments`, `shipment_events`,
   `shipment_documents`, `invoices`, `expenses`, `content_drafts`,
   `promotions`, `warranties`. Public tables (`cars`,
   `parts`, `reviews`, `posts`)
   expose SELECT-on-published only; `site_settings` (incl. `fx_rate`,
   `import_config`) is public-read, service-role write.

### 2.1 Rate-limit KV namespace (fixes the in-memory fallback)

The durable rate limiter needs a KV binding. Until bound, it silently falls
back to per-isolate in-memory counters (weaker across Workers isolates).

```bash
wrangler kv namespace create RATE_LIMIT_KV
# paste the returned id into wrangler.toml, replacing REPLACE_WITH_KV_NAMESPACE_ID
```

`wrangler.toml` already declares the binding; only the `id` needs to be real.

### 2.2 Deploy the app

First, set the required secrets and confirm readiness:

```bash
npm install
npm run check:env            # ✓/✗ for every required + recommended var
npm run test && npm run build  # gates: must be green
```

Then pick **one** deploy path:

**Path A — Cloudflare Workers (OpenNext).** The intended target, but the
**free plan caps a Worker at 3 MiB gzipped and the OpenNext handler exceeds it**
— so this path needs a **Workers Paid plan ($5/mo, 10 MiB limit)**. After
upgrading:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ADMIN_PASSWORD           # …and the rest of §1
npm run deploy                                # opennextjs build && deploy
```

**Path B — Self-host (no size limit, ~free).** `next.config` already emits
`output: "standalone"`. Run the Node server on any always-on box (the dealer's
Vostro, or a $5 VPS) and expose it with a free Cloudflare Tunnel. Full steps and
the systemd units are in **`deploy/selfhost/SETUP.md`** (`tez-motors.service` +
`cloudflared.service`). In short: `npm run selfhost:build` then
`npm run selfhost:start` behind the tunnel.

After either path, verify the live site:

```bash
npm run smoke https://tezmotors.uz   # public 200s + admin/cron guards return 401
```

### 2.3 Cron Worker (scheduled jobs)

OpenNext's generated Worker exports only `fetch` — it has **no `scheduled()`
handler** — so Cron Triggers cannot call the Next app directly. The standalone
`cron-worker/` owns the triggers and hits the app's guarded `/api/cron/*`
routes with the shared bearer secret.

```bash
cd cron-worker
wrangler secret put CRON_SECRET   # SAME value the app has as CRON_SECRET
wrangler deploy
```

The app and the cron Worker **must share the same `CRON_SECRET`**
(`src/lib/cron/guard.ts` does a constant-time compare). Set `APP_BASE_URL` in
`cron-worker/wrangler.toml` `[vars]` if the prod domain differs.

> Fallback if you prefer zero extra Workers: any external uptime-cron service
> can `POST` the same `/api/cron/*` routes with the `Authorization: Bearer
> <CRON_SECRET>` header on the schedules in `cron-worker/wrangler.toml`.

### 2.4 Email (Resend)

Verify the sending domain (`tezmotors.uz`) in Resend (SPF/DKIM) before relying
on `EMAIL_FROM`. Until verified, mail may land in spam; fail-open keeps the site
working regardless.

### 2.5 Telegram inbound bot (optional)

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d url="https://tezmotors.uz/api/bot/telegram" \
  -d secret_token="<TELEGRAM_WEBHOOK_SECRET>"
```

### 2.5b Telegram Mini App (optional)

The catalog/find-a-car flow also runs inside Telegram as a Mini App at
`/{locale}/app` (e.g. `https://tezmotors.uz/ru/app`), authenticated by Telegram
identity (no OTP). The bot's `/start` already shows an "Open the app" button.
One-time setup in **@BotFather**:
1. `/setdomain` → set the bot's domain to `tezmotors.uz` (required for `web_app`
   buttons + initData to work).
2. Optionally `/setmenubutton` → set the persistent menu button to the Web App
   URL `https://tezmotors.uz/ru/app`.

Reuses `TELEGRAM_BOT_TOKEN` (validates initData HMAC) — no new secret. Sign-in
upserts a `customers` row by `telegram_id` (phone stays null until shared) and
issues the standard `customer_session` cookie.

### 2.6 WhatsApp inbound bot (optional)

In the Meta app dashboard set the callback URL to
`https://<domain>/api/bot/whatsapp`, verify with `WHATSAPP_VERIFY_TOKEN`, then
subscribe the WABA to the `messages` field.

### 2.7 Payments (optional, ship dark until onboarded)

- **Payme:** after merchant onboarding, set the cabinet account field to
  `order_id` and the endpoint to `https://<domain>/api/payments/payme`. Run the
  Payme **sandbox** suite before going live (it asserts exact JSON-RPC codes +
  idempotency).
- **Click:** set Prepare/Complete URLs to `https://<domain>/api/payments/click`,
  param name `order_id`. Run the Click sandbox Prepare/Complete flow.

The "Pay deposit" buttons only render when the corresponding
`NEXT_PUBLIC_*_MERCHANT_ID` is set, so payments are invisible until ready.

---

## 3. Seeding the first admin user

After migration `009` (admin_users) and the PBKDF2 auth in `src/lib/auth.ts`,
seed the first **owner** account directly via the Supabase SQL editor. Roles:
`owner` (full + user management), `manager`, `rep`.

```sql
insert into public.admin_users (email, role, disabled)
values ('owner@tezmotors.uz', 'owner', false)
on conflict (email) do nothing;
```

Login uses `ADMIN_PASSWORD` (set as a secret). Additional users are managed from
`/admin/users` (owner-only). Every privileged admin action is recorded in
`admin_audit` (viewable at `/admin/audit`).

---

## 4. Credential rotation & delivery (handoff)

Before walking away:

1. **Rotate `ADMIN_PASSWORD`** to a fresh strong value:
   `wrangler secret put ADMIN_PASSWORD`.
2. **Deliver credentials via 1Password or a signed PDF — NEVER via Telegram,
   email, or chat.** This applies to `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`,
   and the Payme/Click/Eskiz/VAPID secrets.
3. Rotate any secret that was ever shared in plaintext during development.
4. Customer/admin sessions are server-side (hashed token + TTL in
   `customer_sessions` / `admin_sessions`); a leaked cookie can be revoked by
   deleting the session row.

---

## 5. Observability & failure alerting

- **Structured logs:** `logEvent(event, fields, level)` emits one greppable JSON
  line per call to Cloudflare Workers Logs (filter by the `event` tag).
- **Critical alerts:** `reportServerError(context, err)` and `alertDealer(title,
  lines)` (in `src/lib/error-report.ts`) fan out to Telegram (`TELEGRAM_ERROR_CHAT_ID`
  → `TELEGRAM_CHAT_ID`) **and** dealer email. These now fire on:
  - cron route failures (`reportServerError` in each `/api/cron/*` handler),
  - **payment-callback errors** (Payme/Click catch blocks),
  - **notify fan-out failures** — when a lead is saved but every configured
    alert channel failed (`notify.fanout_failed`).
- Alerts are **throttled per-key (5 min)** so a looping failure can't storm the
  dealer. The request path stays fail-open; the alert is the only added effect.

---

## 6. Backups & restore (Z3)

- **Supabase Point-in-Time Recovery (PITR):** enable daily backups / PITR in the
  Supabase dashboard (Database → Backups). The free tier keeps recent backups;
  upgrade if the dealer wants a longer retention window. Storage objects
  (`car-images`, `part-images` buckets) are not covered by DB PITR — Supabase
  Storage is durable, but keep the original processed images in the repo's
  seed/processed folder or an external drive as a master copy.
- **Restore drill:** before go-live, confirm you can restore a backup into a
  staging project and that the app boots against it (migrations already applied
  in the backup).
- **Schema as code:** every schema change lives in `supabase/migrations/`. To
  rebuild from scratch, create a fresh project and replay migrations in order.

---

## 7. Removing demo / seed data before go-live (Z3)

The catalog, parts, reviews, and blog are pre-populated with **mock seed data**
so every page renders convincingly during the demo. Remove or replace it before
the dealer's real inventory goes live.

There is **no `data_source` column** — seeded rows are identified by their
**known slugs** defined in the seed sources:

- **Cars:** `scripts/seed/cars.json` (35 entries). Each car's description ends
  with an import line mentioning Tez Motors. Delete by slug list, or re-import
  the dealer's real CSV which upserts on slug.
- **Parts:** `scripts/seed-parts.mjs` (OEM/category rows, idempotent on slug).
- **Reviews + blog posts:** `scripts/seed-reviews-and-posts.mjs` — fixed blog
  slugs (`kak-import-iz-kitaya`, `byd-song-plus-2024-review`,
  `rastamozhka-uzbekistan-2026`) and 8 seeded reviews linked to seed car slugs.

To remove (run in the Supabase SQL editor, after confirming the slug lists):

```sql
-- Example: delete seeded blog posts by their known slugs
delete from public.posts
where slug in ('kak-import-iz-kitaya','byd-song-plus-2024-review','rastamozhka-uzbekistan-2026');

-- Seeded reviews are mock; clear them once real reviews start arriving:
-- (inspect first) select id, client_name, car_id from public.reviews;
```

Re-running a seed script is idempotent (upsert on slug), so accidental
double-seeding won't duplicate rows. The dealer's real data uses the admin UI
or the CSV import, both of which also upsert on slug.

---

## 8. Routine maintenance

- **`npm run test`** (vitest) — money/auth/parsing coverage; wired as a CI gate.
- **`npx tsc --noEmit`** + **`npm run build`** before every deploy.
- The cron jobs handle: USD/UZS rate refresh, lead digest, follow-up reminders,
  price-watch sweep, OTP cleanup, saved-search alerts, post-delivery review
  requests, the **AI Operator morning briefing** (`/api/cron/operator-briefing`,
  daily 08:20 Tashkent), the **Marketing Autopilot** weekly content drafts
  (`/api/cron/marketing-autopilot`, Mon 11:30 Tashkent), and the **weekly market
  digest** (`/api/cron/market-digest`, Fri 13:00 Tashkent — OLX/Telegram pricing
  intel from `deploy/collector/`). Verify they run (Workers
  Logs show `cron <path> -> 200`). All schedules live in `cron-worker/wrangler.toml`
  and route in `cron-worker/src/index.js` (keyed by the exact cron expression —
  duplicate keys overwrite, so each new job needs a unique expression).
- **Storage quota:** monitor the Supabase Storage usage; ~500 KB/image. Plan a
  paid upgrade before the dealer's inventory photos approach the tier limit.
