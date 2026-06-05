# Multi-tenancy

Turning the single-dealer operating system into a product multiple importers can
subscribe to. This is a **staged** pivot — each increment is independently
shippable and leaves the live single-dealer deployment byte-identical until the
final flip. **Increment 1 (the foundation) is done; the rest is planned below.**

## Model

- **`tenants`** registry (migration 065): `id, slug, name, primary_host, status,
  settings, created_at`. Service-role only.
- **Default tenant** — a fixed, well-known id `00000000-0000-0000-0000-000000000001`
  (`DEFAULT_TENANT_ID` in `src/lib/tenant.ts`) representing the existing dealer.
  Every existing row backfills to it.
- **Resolution seam** — `src/lib/tenant.ts` (pure: `tenantSlugFromHost`,
  `tenantsEnabled`, the default-id constant) + `src/lib/tenant-context.ts`
  (`resolveTenantId(host)`, `scopeToTenant(query, id)`). Host → tenant:
  `{slug}.tezmotors.uz` → tenant `slug`; apex / www / unknown → default.
- **Feature flag** — `MULTI_TENANT` (env, default off). While off, `resolveTenantId`
  always returns the default and `scopeToTenant` is a no-op, so wiring it into
  queries changes nothing.

## Increment 1 — foundation ✅ (done)

- `tenants` table + seeded default tenant.
- `tenant_id` (NOT NULL, defaulted to the default tenant, FK + index) on the
  storefront-content proof tables: `cars`, `parts`. Existing rows backfilled by
  the column DEFAULT; no query filters by it yet.
- Pure resolution lib + server resolver + `scopeToTenant` no-op helper, unit-tested.
- Flag + env documented. **Behavior unchanged.**

## Increment 2 — scope the data plane (not started)

1. Add `tenant_id` (same pattern) to every remaining tenant-scoped table:
   `scooters, orders, order_events, inquiries, customers, reviews, faqs, posts,
   purchase_orders, shipments, expenses, invoices, payments, financing_applications,
   insurance_leads, service_bookings, referrals, calls, commissions, suppliers,
   source_prices, market_listings, content_drafts, promotions, saved_searches,
   favorites, price_watches, document_signatures, web_vitals, site_settings`
   (site_settings becomes per-tenant). Leave genuinely-global tables alone
   (`admin_audit`, `error_events`, `cron_runs`, `tenants`).
2. Resolve the tenant once per request (middleware sets an `x-tenant-id` header
   from `resolveTenantId`) and thread it into the data layer.
3. Wrap every read/write through `scopeToTenant` (reads) and stamp `tenant_id` on
   inserts. Centralize in the query helpers (`cars-query.ts`, etc.) so it's a few
   edit sites, not 172.
4. Flip `MULTI_TENANT=1` in staging; verify a second seeded tenant sees only its
   own data.

## Increment 3 — isolation hardening (not started)

- RLS policies keyed on a request-scoped `tenant_id` (via a Postgres session GUC
  or a per-tenant service token) so isolation is enforced at the DB, not just in
  app code — defense in depth, mirroring the existing service-role posture.
- Per-tenant storage prefixes for uploads.
- Per-tenant secrets (each dealer's own Payme/Telegram/Resend) in
  `tenants.settings` (encrypted) instead of global env.

## Increment 4 — productize (not started)

- **Onboarding**: self-serve tenant creation (slug, branding, domain), seeded
  with empty catalog + the dealer's first admin user.
- **Custom domains**: map `dealer.com` → tenant via `primary_host` + Cloudflare
  for SaaS / SSL.
- **Billing**: subscription tiers (Stripe/Payme), usage metering, suspend on
  non-payment (`tenants.status='suspended'` already gates resolution).
- **Tenant admin**: a super-admin console across tenants (health, revenue, churn).

## Risks

- **Cross-tenant leakage** is the cardinal sin — increment 2 must land app-level
  scoping AND increment 3's RLS before any real second tenant. Don't flip the
  flag in production with only app-level scoping.
- **The flag is a one-way-ish door**: once a second tenant has data, you can't go
  back to single-tenant semantics. Keep it off until increments 2–3 are verified.
- **Global vs scoped tables**: misclassifying a global table as tenant-scoped (or
  vice-versa) breaks either isolation or shared ops. The list above is the
  contract — review it before adding columns.
