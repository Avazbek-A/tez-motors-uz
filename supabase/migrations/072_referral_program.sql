-- Phase AW — referral / viral loop program.
--
-- The existing `referrals` table had a UNIQUE NOT NULL `code`, which models one
-- code = one referral. A real program needs ONE shareable code per customer →
-- MANY referred leads. So: a `referral_codes` table holds the per-customer
-- shareable code, and `referrals` becomes the per-referred-lead ledger (the
-- referrer's code repeated, no longer unique/required).

create table if not exists public.referral_codes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  code        text not null unique,
  tenant_id   uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  created_at  timestamptz not null default now()
);

-- Relax referrals.code so it can record many leads under one referrer's code.
alter table public.referrals drop constraint if exists referrals_code_key;
alter table public.referrals alter column code drop not null;
create index if not exists referrals_code_idx on public.referrals (code);
create index if not exists referrals_referred_phone_idx on public.referrals (referred_phone);

alter table public.referral_codes enable row level security;
-- No policies: service-role only.
