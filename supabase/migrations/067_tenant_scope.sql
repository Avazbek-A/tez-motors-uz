-- Phase AV — multi-tenant increment 2: scope the data plane (schema side).
--
-- Adds `tenant_id` (NOT NULL, defaulted to the default tenant, FK) to every
-- tenant-scoped table. The constant DEFAULT backfills existing rows to the
-- default tenant (metadata-only ADD COLUMN in PG11+, no table rewrite), so the
-- live single-dealer deployment is unchanged. NO query filters by it until the
-- app layer opts in via scopeToTenant (storefront reads are wired in this same
-- phase; the rest follow with the flag still off).
--
-- GLOBAL tables deliberately excluded (shared infra/ops, not per-dealer):
--   tenants, admin_users, admin_sessions, admin_audit, error_events, cron_runs.
-- cars + parts already got tenant_id in migration 066.

do $$
declare
  t text;
  scoped text[] := array[
    'scooters','model_catalog','warranties','listings',
    'orders','order_events','payments','car_costs','invoices','expenses',
    'inquiries','customers','customer_sessions','otp_codes','push_subscriptions',
    'newsletter_subscribers','notification_log',
    'reviews','faqs','posts','promotions','campaigns','content_drafts',
    'saved_searches','favorites','price_watches','document_signatures',
    'financing_applications','insurance_leads','service_bookings','referrals',
    'calls','commissions','crm_tasks',
    'purchase_orders','shipments','shipment_events','shipment_documents',
    'suppliers','source_prices','market_listings',
    'assistant_conversations','assistant_messages',
    'copilot_messages','copilot_pending_actions',
    'site_settings','web_vitals'
  ];
begin
  foreach t in array scoped loop
    execute format(
      'alter table public.%I add column if not exists tenant_id uuid not null default ''00000000-0000-0000-0000-000000000001'' references public.tenants(id)',
      t
    );
  end loop;
end $$;

-- Indexes on the tables whose reads actually scope by tenant now (storefront +
-- lead/order capture). Back-office tables get theirs when their queries are
-- scoped in a later increment.
create index if not exists scooters_tenant_idx       on public.scooters (tenant_id);
create index if not exists reviews_tenant_idx        on public.reviews (tenant_id);
create index if not exists faqs_tenant_idx           on public.faqs (tenant_id);
create index if not exists posts_tenant_idx          on public.posts (tenant_id);
create index if not exists promotions_tenant_idx     on public.promotions (tenant_id);
create index if not exists model_catalog_tenant_idx  on public.model_catalog (tenant_id);
create index if not exists inquiries_tenant_idx      on public.inquiries (tenant_id);
create index if not exists orders_tenant_idx         on public.orders (tenant_id);
create index if not exists customers_tenant_idx      on public.customers (tenant_id);
