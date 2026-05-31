-- Phase X3: saved-search match alerts.
--
-- Until now the retention loop only fired on price drops (price_watches). A
-- customer who saved a search ("BYD SUV under $30k") was never told when a NEW
-- car matching it arrived. This adds the bookkeeping column the cron sweep uses
-- to remember when each saved search was last alerted, so a daily job can notify
-- the customer about cars created since then — exactly once per arrival.
--
-- last_alerted_at NULL means "never alerted"; the sweep treats the search's own
-- created_at as the watermark on the first run so it doesn't blast the customer
-- with the entire back-catalogue.

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ;

-- The sweep scans every saved search and orders by oldest-alerted first so a
-- per-run cap is fair (no search is starved). A plain index on the watermark
-- keeps that ordering cheap as the table grows.
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_alerted_at
  ON public.saved_searches (last_alerted_at NULLS FIRST);
