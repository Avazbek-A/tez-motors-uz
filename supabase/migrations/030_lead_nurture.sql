-- Phase: cold-lead nurture automation.
--
-- Dedupe stamp so the nurture cron (api/cron/lead-nurture) follows up with an
-- unworked lead exactly once, after a delay, instead of re-mailing every run.
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS nurtured_at TIMESTAMPTZ;

-- Cheap scan for the nurture cron: new, not-yet-nurtured leads.
CREATE INDEX IF NOT EXISTS idx_inquiries_nurture
  ON public.inquiries (created_at)
  WHERE status = 'new' AND nurtured_at IS NULL;
