-- Allow a site_settings('autopilot') row so the Autopilot control plane
-- (master switch + auto-markdown / auto-source-draft bounds) can be persisted
-- by /api/admin/autopilot-config (PUT) and read by the cron jobs
-- (/api/cron/auto-markdown, /api/cron/auto-source).
--
-- BUG: the id allowlist (last set in 080_site_settings_llm_models) never
-- included 'autopilot', so saving the Autopilot Rules page failed with
-- "new row for relation \"site_settings\" violates check constraint
-- \"site_settings_id_check\"". This extends the allowlist to fix it.
ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_id_check;
ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_id_check
  CHECK (id IN ('singleton', 'fx_rate', 'import_config', 'llm_models', 'autopilot'));
