-- Phase AW (Leap 2) — behavioral event spine + triggers.
--
-- `marketing_events` is a lightweight behavioral log (car views, etc.) keyed to
-- a contact when we know one. The behavioral-triggers cron derives conditions
-- from it (+ orders/price_watches) and enrolls contacts into journeys. Also
-- widens the journey trigger set with the behavioral kinds.
--
-- Service-role only. Tenant-aware.

create table if not exists public.marketing_events (
  id             uuid primary key default gen_random_uuid(),
  type           text not null,                 -- 'car_view' | 'favorite' | ...
  contact_phone  text,
  customer_id    uuid references public.customers(id) on delete set null,
  car_id         uuid references public.cars(id) on delete set null,
  metadata       jsonb not null default '{}',
  tenant_id      uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  created_at     timestamptz not null default now()
);
create index if not exists marketing_events_contact_idx on public.marketing_events (contact_phone, type, created_at desc);
create index if not exists marketing_events_type_idx on public.marketing_events (type, created_at desc);

alter table public.marketing_events enable row level security;
-- No policies: service-role only.

-- Widen the journey trigger set with behavioral kinds.
alter table public.automation_journeys drop constraint if exists automation_journeys_trigger_event_check;
alter table public.automation_journeys
  add constraint automation_journeys_trigger_event_check
  check (trigger_event in ('new_lead','reservation_abandoned','delivered','manual','browsed_no_inquiry','price_drop'));
