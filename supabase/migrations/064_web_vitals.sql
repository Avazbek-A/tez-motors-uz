-- Phase AT — real-user Core Web Vitals (RUM).
--
-- AQ added synthetic + health checks; this captures REAL field metrics (LCP,
-- CLS, INP, FCP, TTFB) from actual visitors so regressions in the experience
-- people actually get are visible — not just synthetic uptime. Service-role
-- only (RLS enabled, no policies); the public /api/rum route writes via the
-- service client. Anonymous + non-PII (no IP, no user id) — just metric values
-- + a coarse path bucket.

create table if not exists public.web_vitals (
  id         uuid primary key default gen_random_uuid(),
  metric     text not null,                 -- LCP | CLS | INP | FCP | TTFB
  value      double precision not null,
  rating     text,                          -- good | needs-improvement | poor
  path       text,                          -- coarse route (query stripped)
  created_at timestamptz not null default now()
);
create index if not exists web_vitals_metric_idx on public.web_vitals (metric, created_at desc);

alter table public.web_vitals enable row level security;
-- No policies: service-role only.
