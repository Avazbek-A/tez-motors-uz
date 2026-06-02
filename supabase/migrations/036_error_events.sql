-- Phase: observability — in-house error log.
--
-- Server errors are fail-open by design (they never break the request) and
-- alert the dealer via Telegram/email, but they were otherwise only a console
-- line nobody re-reads on a Worker. logEvent now also persists every error-level
-- event here, giving an in-house, queryable error feed (admin → Errors) without
-- a third-party APM. Service-role only.
CREATE TABLE IF NOT EXISTS public.error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_error_events_created_at ON public.error_events (created_at DESC);
