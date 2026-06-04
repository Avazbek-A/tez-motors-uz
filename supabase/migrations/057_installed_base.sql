-- Phase AL — installed-base revenue: service bookings + referrals.
--
-- service_bookings: a real booking (the services page was contact-only).
-- referrals: a per-customer referral code + the leads it brings (attributed via
-- the `ref` param the attribution cookie already captures).
--
-- Both service-role only (RLS enabled, no policies) — public writes go through
-- the hardened /api/service-booking route; the account portal reads via
-- service-role endpoints. Mirrors orders (017) / inquiries lockdown.

create table if not exists public.service_bookings (
  id             uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  customer_name  text,
  car_id         uuid references public.cars(id) on delete set null,
  order_id       uuid references public.orders(id) on delete set null,
  service_type   text not null,
  preferred_date date,
  status         text not null default 'new' check (status in ('new','confirmed','done','cancelled')),
  notes          text,
  locale         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists service_bookings_status_idx on public.service_bookings (status, created_at desc);
create index if not exists service_bookings_phone_idx on public.service_bookings (customer_phone);

create table if not exists public.referrals (
  id                  uuid primary key default gen_random_uuid(),
  referrer_customer_id uuid references public.customers(id) on delete set null,
  code                text unique not null,
  referred_phone      text,
  referred_inquiry_id uuid references public.inquiries(id) on delete set null,
  status              text not null default 'pending' check (status in ('pending','converted','rewarded','void')),
  reward_note         text,
  created_at          timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_customer_id);

alter table public.service_bookings enable row level security;
alter table public.referrals        enable row level security;
-- No policies: service-role only.
