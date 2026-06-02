# Security review

A working review of the controls that matter for a site that captures PII and
takes deposits. Re-run before each major release.

## Data isolation (RLS)
- Public tables (`cars`, `parts`, `reviews`, `posts`, `model_catalog`) expose
  **SELECT-on-published only** via the anon key; all writes go through the
  service-role client behind `requireAdmin`.
- **PII / money / internal tables are RLS-enabled with NO policies** — the anon
  key can neither read nor write them. Covers: `inquiries`, `orders`,
  `order_events`, `payments`, `customers`, `customer_sessions`, `otp_codes`,
  `newsletter_subscribers`, `admin_audit`, `car_costs`, `purchase_orders`,
  `cron_runs`, `error_events`, `assistant_messages`.
- Purchase cost lives in `car_costs` (not on `cars`) specifically because the
  public car routes `select('*')` on the anon client — a cost column would leak
  margins.
- Order/track lookups are service-role and gated on **reference_code + phone**
  (constant "not found" on mismatch) so orders can't be enumerated by code.

## Auth
- Admin + customer sessions: opaque random token in an httpOnly cookie, SHA-256
  hash stored server-side with a TTL; logout deletes the row (revocable). PBKDF2
  for the admin password. OTP has an attempt cap + short TTL + a cleanup cron.
- `requireAdmin` gates every `/api/admin/**` route and admin pages.

## Payments (idempotency)
- Payme + Click are protected by a per-provider **UNIQUE (provider,
  provider_transaction_id)** constraint — the idempotency guard the sandboxes
  assert. Orders advance **only on the perform/complete step**, never on create.
- Sign/auth verification fails **closed** when keys are unset (endpoints inert
  until onboarded). Covered by the Payme/Click route + state-machine tests.

## Abuse surface (public POSTs)
- Every public form/POST stacks: KV-backed rate limiter (+ in-memory fallback),
  Cloudflare Turnstile (fail-open if unconfigured), a honeypot `website` field,
  and zod validation. Applies to inquiry, reservation, assistant, OTP, etc.

## Transport / headers
- HTTPS everywhere (Cloudflare). Security headers + CSP are set in
  `next.config.ts`; keep `script-src` pinned to self + Supabase + Turnstile +
  Plausible/Tawk when enabled.

## Dependency audit
- `npm audit --omit=dev` is clean for the **runtime** dependency tree.
- Outstanding advisories are confined to the **dev-only** `wrangler →
  miniflare → ws` chain (the Cloudflare deploy CLI / local emulator). They do
  **not** ship in the production bundle. Resolve by upgrading wrangler in a
  dedicated change (verify the OpenNext build still passes) rather than
  `npm audit fix --force`, which can bump wrangler across a major and break the
  deploy.

## Handoff
- Rotate `ADMIN_PASSWORD` before handover; deliver secrets via 1Password / a
  signed PDF — never Telegram. Never deliver Payme/Click/Eskiz/VAPID keys over a
  chat channel.
