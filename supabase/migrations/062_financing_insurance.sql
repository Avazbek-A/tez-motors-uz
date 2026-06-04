-- Phase AP — point-of-sale revenue add-ons: financing applications + insurance leads.
--
-- Both are LEAD-CAPTURE + handoff (no live underwriting/binding): the dealer or
-- a bank/insurer partner closes offline. Service-role only (RLS enabled, no
-- policies) — they hold customer PII; public writes go through the hardened
-- /api/financing/apply and /api/insurance/lead routes.

create table if not exists public.financing_applications (
  id                uuid primary key default gen_random_uuid(),
  customer_name     text not null,
  customer_phone    text not null,
  car_id            uuid references public.cars(id) on delete set null,
  order_id          uuid references public.orders(id) on delete set null,
  down_pct          numeric,
  term_months       integer,
  estimated_monthly numeric,
  employment        text,
  income_band       text,
  documents         jsonb not null default '[]',
  status            text not null default 'new' check (status in ('new','submitted','approved','declined')),
  partner           text,
  notes             text,
  locale            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists financing_status_idx on public.financing_applications (status, created_at desc);

create table if not exists public.insurance_leads (
  id                uuid primary key default gen_random_uuid(),
  customer_name     text,
  customer_phone    text not null,
  car_id            uuid references public.cars(id) on delete set null,
  order_id          uuid references public.orders(id) on delete set null,
  type              text not null check (type in ('osago','kasko')),
  estimated_premium_usd numeric,
  status            text not null default 'new' check (status in ('new','contacted','bound','lost')),
  notes             text,
  created_at        timestamptz not null default now()
);
create index if not exists insurance_leads_status_idx on public.insurance_leads (status, created_at desc);

alter table public.financing_applications enable row level security;
alter table public.insurance_leads        enable row level security;
-- No policies: service-role only.
