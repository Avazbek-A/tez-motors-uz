-- Fix: cron/generate-tasks upsert failed with
--   42P10 "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- 042 created uniq_crm_tasks_auto_source as a PARTIAL index (WHERE auto_source
-- IS NOT NULL). PostgREST's on_conflict=auto_source emits a bare
-- ON CONFLICT (auto_source), which cannot infer a partial index, so every run
-- of the task generator errored and alerted the dealer.
--
-- A plain unique index behaves the same for our purposes: NULL auto_source rows
-- (hand-created tasks) never conflict with each other in Postgres.
DROP INDEX IF EXISTS public.uniq_crm_tasks_auto_source;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_crm_tasks_auto_source
  ON public.crm_tasks (auto_source);
