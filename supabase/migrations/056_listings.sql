-- Phase AJ — off-site listing syndication queue.
--
-- OLX.uz / avtoelon.uz have no open per-seller publish API, so v1 is
-- "manual-assisted": the app drafts a per-channel listing (AI or template) the
-- dealer copy-pastes, then records the published external URL for attribution.
-- (OLX business accounts can also autoload via /api/feed/olx.xml.) Telegram/IG/FB
-- are handled by the marketing poster; this table is the cross-channel record.
--
-- Service-role only (RLS enabled, no policies) — reached through requireAdmin.

create table if not exists public.listings (
  id           uuid primary key default gen_random_uuid(),
  car_id       uuid references public.cars(id) on delete cascade,
  channel      text not null check (channel in ('olx','avtoelon','telegram','instagram','facebook')),
  status       text not null default 'draft' check (status in ('draft','published','removed')),
  title        text,
  body         text,
  external_id  text,
  external_url text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists listings_car_idx on public.listings (car_id);
create index if not exists listings_channel_status_idx on public.listings (channel, status);

alter table public.listings enable row level security;
-- No policies: service-role only.
