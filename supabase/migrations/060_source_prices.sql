-- Phase AK polish — live Chinese source prices from RFQ quotes.
--
-- The Buying Brain costed models from PO history only (backward-looking). This
-- captures forward supplier quotes (pasted from WhatsApp/email, parsed into
-- structure) so "what to import, at what margin" reflects current source cost.
-- Service-role only (RLS enabled, no policies) — reached through requireAdmin.

create table if not exists public.source_prices (
  id             uuid primary key default gen_random_uuid(),
  brand          text not null,
  model          text not null,
  price_usd      numeric,            -- normalized
  price_cny      numeric,            -- as quoted, if CNY
  lead_time_days integer,
  moq            integer,
  supplier       text,
  raw            text,               -- original pasted quote (audit)
  observed_at    timestamptz not null default now()
);
create index if not exists source_prices_model_idx on public.source_prices (lower(brand), lower(model), observed_at desc);

alter table public.source_prices enable row level security;
-- No policies: service-role only.
