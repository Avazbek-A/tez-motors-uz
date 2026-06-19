-- Migration: Fix the crm_tasks auto_source upsert (generate-tasks cron 42P10).
--
-- /api/cron/generate-tasks upserts with ON CONFLICT (auto_source), but 042 created
-- the unique index as PARTIAL (WHERE auto_source IS NOT NULL). Postgres cannot use
-- a partial index as an ON CONFLICT arbiter unless the index predicate is restated
-- in the conflict target, and supabase-js cannot emit that predicate — so every run
-- threw "42P10: there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" and created 0 tasks (silently, behind fail-soft).
--
-- Replace it with a FULL unique index on auto_source. NULLs remain distinct
-- (Postgres default NULLS DISTINCT), so manually-created tasks (auto_source NULL)
-- are unaffected; only the auto-generated dedupe keys are constrained — same intent
-- as 042, but now usable as the ON CONFLICT arbiter.
DROP INDEX IF EXISTS public.uniq_crm_tasks_auto_source;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_crm_tasks_auto_source
  ON public.crm_tasks (auto_source);
