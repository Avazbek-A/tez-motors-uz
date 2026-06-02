-- Phase: automation observability (autopilot command-center).
--
-- One row per scheduled-job completion so the dealer can see the automation's
-- heartbeat — which jobs ran, when, and with what result. Written best-effort
-- by logEvent() on any "cron.*" event. Service-role only.
CREATE TABLE IF NOT EXISTS public.cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON public.cron_runs (job, created_at DESC);
