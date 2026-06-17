-- Observability: free-model health + model-switch telemetry.
--
-- The buyer assistant / form auto-reply / parsers run on OpenRouter FREE models,
-- which rotate (transient 404 / 429), so a call often has to fall back from the
-- primary pick to a later model in the tier chain. Nobody could see how often
-- that happened or which model was actually carrying the load. llm.ts now writes
-- ONE summary row per completed call here, so the admin "AI models" dashboard can
-- show: switch rate (how many calls needed a fallback), per-model success/fail
-- counts, and which model answered. Service-role only; fire-and-forget, fail-open
-- (telemetry must never break a reply).
--
--   tier           chat | reason | vision
--   answered_model the model that ultimately replied; NULL = whole chain failed
--                  (caller fell back to the deterministic template)
--   attempts       how many models in the chain were tried (1 = primary worked)
--   switched       attempts > 1 — i.e. the primary (or an earlier model) failed
--   failures       [{ model, reason, status }] for each model that didn't answer
--                  (reason: non_ok | empty | timeout | error)
--   latency_ms     wall-clock of the whole call (all attempts)
CREATE TABLE IF NOT EXISTS public.llm_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL,
  answered_model TEXT,
  attempts SMALLINT NOT NULL DEFAULT 1,
  switched BOOLEAN NOT NULL DEFAULT false,
  failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.llm_call_log ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_llm_call_log_created_at ON public.llm_call_log (created_at DESC);

-- Allow a site_settings('llm_catalog') row so the weekly llm-refresh scan can
-- persist the ranked free-model catalog + upgrade suggestions for the dashboard.
-- (Extends the id allowlist last set in 082_site_settings_autopilot.)
ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_id_check;
ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_id_check
  CHECK (id IN ('singleton', 'fx_rate', 'import_config', 'llm_models', 'autopilot', 'llm_catalog'));
