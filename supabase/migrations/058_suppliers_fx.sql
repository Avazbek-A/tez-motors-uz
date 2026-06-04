-- Phase AK — supplier master + FX exposure tracking.
--
-- `suppliers`: a real supplier master (the PO `supplier` field was free text, so
-- duplicate names fragmented price/reliability history). `purchase_orders` gets
-- a nullable supplier_id FK (legacy text kept) plus FX columns so we can track
-- CNY exposure between order and settlement.
--
-- Service-role only (RLS enabled, no policies) — reached through requireAdmin.

create table if not exists public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  contact         text,
  whatsapp        text,
  country         text default 'CN',
  lead_time_days  integer,
  moq             integer,
  payment_terms   text,
  reliability_score integer,           -- 0-100, computed/curated
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- Normalized-name uniqueness so "BYD", "byd", " BYD " don't fragment.
create unique index if not exists suppliers_name_norm_idx on public.suppliers (lower(btrim(name)));

alter table public.purchase_orders
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists quote_currency text check (quote_currency is null or quote_currency in ('USD','CNY')),
  add column if not exists quote_amount numeric check (quote_amount is null or quote_amount >= 0),
  add column if not exists fx_cny_per_usd_at_order numeric check (fx_cny_per_usd_at_order is null or fx_cny_per_usd_at_order > 0),
  add column if not exists order_date date;

alter table public.suppliers enable row level security;
-- No policies: service-role only.
