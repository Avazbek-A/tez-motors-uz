-- Phase AW — marketing automation: configurable journeys (drip sequences).
--
-- Generalizes the hard-coded one-off marketing crons (lead-nurture, win-back,
-- review-requests, …) into a trigger-based, multi-step, admin-editable engine
-- that delivers through the existing omnichannel layer (sendToCustomer:
-- Telegram DM → push → email → SMS). Each step is a timed message; enrollment
-- tracks a contact's progress through a journey.
--
-- Service-role only (RLS enabled, no policies) — it touches customer PII; the
-- runner + admin reach it through the service client. Tenant-aware from day one.

create table if not exists public.automation_journeys (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  trigger_event text not null check (trigger_event in ('new_lead','reservation_abandoned','delivered','manual')),
  status        text not null default 'active' check (status in ('active','paused')),
  -- steps: [{ delayHours, channel, subject, body, url, buttonLabel }]
  steps         jsonb not null default '[]',
  tenant_id     uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists automation_journeys_trigger_idx on public.automation_journeys (trigger_event, status);

create table if not exists public.journey_enrollments (
  id             uuid primary key default gen_random_uuid(),
  journey_id     uuid not null references public.automation_journeys(id) on delete cascade,
  contact_phone  text not null,
  contact_name   text,
  contact_email  text,
  contact_locale text not null default 'ru',
  customer_id    uuid references public.customers(id) on delete set null,
  car_id         uuid references public.cars(id) on delete set null,
  current_step   integer not null default 0,   -- index of the NEXT step to send
  status         text not null default 'active' check (status in ('active','completed','exited')),
  next_run_at    timestamptz not null,
  context        jsonb not null default '{}',
  tenant_id      uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  enrolled_at    timestamptz not null default now()
);
-- Runner scan: due active enrollments.
create index if not exists journey_enrollments_due_idx on public.journey_enrollments (status, next_run_at);
-- One active enrollment per (journey, contact) — no double-drip.
create unique index if not exists journey_enrollments_active_uniq
  on public.journey_enrollments (journey_id, lower(contact_phone)) where status = 'active';

alter table public.automation_journeys enable row level security;
alter table public.journey_enrollments enable row level security;
-- No policies: service-role only.
