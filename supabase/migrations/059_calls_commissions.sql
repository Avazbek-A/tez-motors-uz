-- Phase AM — call intelligence + team commissions.
--
-- calls: most UZ car deals close on a phone call, but the call channel was
-- invisible. Logs a call (optional recording/transcript) with an AI summary +
-- lead score, linked to the customer by phone for the customer-360 timeline.
-- commissions: per-rep payout accrued on closed orders, for team scaling.
--
-- Both service-role only (RLS enabled, no policies). Recordings/transcripts are
-- sensitive PII — never exposed publicly.

create table if not exists public.calls (
  id             uuid primary key default gen_random_uuid(),
  customer_phone text,
  direction      text not null default 'inbound' check (direction in ('inbound','outbound')),
  duration_sec   integer,
  recording_url  text,
  transcript     text,
  summary        text,
  lead_score     integer,            -- 0-100
  admin_user_id  uuid references public.admin_users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists calls_phone_idx on public.calls (customer_phone, created_at desc);

create table if not exists public.commissions (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid references public.admin_users(id) on delete set null,
  order_id       uuid references public.orders(id) on delete set null,
  amount_usd     numeric not null default 0,
  status         text not null default 'accrued' check (status in ('accrued','paid','void')),
  note           text,
  created_at     timestamptz not null default now()
);
create unique index if not exists commissions_order_idx on public.commissions (order_id);
create index if not exists commissions_admin_idx on public.commissions (admin_user_id, status);

alter table public.calls       enable row level security;
alter table public.commissions enable row level security;
-- No policies: service-role only.
