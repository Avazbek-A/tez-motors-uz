-- Listing lifecycle: track when each listing was LAST seen, so we can derive
-- days-on-market (an asking price that lingers unsold = overpriced; one that sells
-- fast = a true clearing price) and infer sold/removed listings (stale last_seen).
-- observed_at stays = first seen; ingest now upserts last_seen_at on every re-scrape.
ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows: best we can do retroactively is last_seen = first seen.
UPDATE public.market_listings SET last_seen_at = observed_at
  WHERE last_seen_at IS NULL OR last_seen_at < observed_at;

CREATE INDEX IF NOT EXISTS idx_market_listings_last_seen ON public.market_listings (last_seen_at DESC);
