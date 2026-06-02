-- Phase: marketing scheduling.
--
-- Schedule a saved draft to auto-publish to the Telegram channel at a future
-- time. The marketing-poster cron publishes drafts whose scheduled_at has
-- passed and that are still in 'draft' status.
ALTER TABLE public.content_drafts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_content_drafts_schedule
  ON public.content_drafts (scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'draft';
