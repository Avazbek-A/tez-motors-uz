-- Phase AW (Leap 1) — marketing suppression / unsubscribe list.
--
-- A contact (phone or email) on this list is NEVER sent automated marketing —
-- the journey runner + sendToCustomer skip them. This is the compliance +
-- deliverability backbone: without an honoured opt-out, scaling automated
-- outbound burns the list and trips spam filters.
--
-- Service-role only (RLS enabled, no policies). Tenant-aware.

create table if not exists public.marketing_suppressions (
  id         uuid primary key default gen_random_uuid(),
  contact    text not null,                 -- normalized phone (digits) or lowercased email
  channel    text,                          -- null = all channels; else email|sms|telegram|push
  reason     text not null default 'unsubscribe' check (reason in ('unsubscribe','bounce','complaint','manual')),
  tenant_id  uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  created_at timestamptz not null default now()
);
-- One row per (contact, channel-bucket): "all" or a specific channel.
create unique index if not exists marketing_suppressions_uniq
  on public.marketing_suppressions (lower(contact), coalesce(channel, 'all'));

alter table public.marketing_suppressions enable row level security;
-- No policies: service-role only.
