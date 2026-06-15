-- Allow a site_settings('llm_models') row so the per-tier LLM model picks
-- (chat / reason / vision, each with a fallback) can be stored at runtime and
-- swapped live by the weekly auto-refresh job (/api/cron/llm-refresh) without a
-- redeploy. Extends the existing id allowlist (last set in 039_import_config).
ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_id_check;
ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_id_check
  CHECK (id IN ('singleton', 'fx_rate', 'import_config', 'llm_models'));
