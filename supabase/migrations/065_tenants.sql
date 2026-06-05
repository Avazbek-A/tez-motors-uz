-- Phase AV — multi-tenant foundation (increment 1 of N: model + seam + proof).
--
-- The app is a complete single-dealer operating system. This lays the FOUNDATION
-- to host multiple dealers without changing current behavior:
--  - a `tenants` registry,
--  - a well-known DEFAULT tenant that the existing single dealer maps to,
--  - `tenant_id` on the storefront-content tables as a proof-of-pattern,
--    nullable-safe via a constant DEFAULT so existing rows backfill to the
--    default tenant and NO query filters by it yet.
--
-- Query scoping, RLS policies, onboarding, and billing are later increments
-- (see docs/MULTI_TENANT.md). With the MULTI_TENANT flag off (default), every
-- request resolves to the default tenant — behavior is byte-identical.

create table if not exists public.tenants (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  primary_host text,
  status       text not null default 'active' check (status in ('active','suspended')),
  settings     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

-- The single existing dealer = the default tenant (fixed, well-known id so app
-- code can reference it as a constant).
insert into public.tenants (id, slug, name, primary_host)
values ('00000000-0000-0000-0000-000000000001', 'default', 'Tez Motors', 'tezmotors.uz')
on conflict (id) do nothing;

-- Proof-of-pattern on the storefront-content tables. NOT NULL + constant DEFAULT
-- means Postgres backfills existing rows to the default tenant on ADD COLUMN
-- (metadata-only in PG11+, no table rewrite); the FK validates trivially since
-- every backfilled row points at the default tenant that already exists above.
alter table public.cars  add column if not exists tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id);
alter table public.parts add column if not exists tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id);
create index if not exists cars_tenant_idx  on public.cars  (tenant_id);
create index if not exists parts_tenant_idx on public.parts (tenant_id);

alter table public.tenants enable row level security;
-- No policies: service-role only (tenant management is an admin/ops concern).
