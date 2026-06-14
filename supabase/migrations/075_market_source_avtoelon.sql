-- Allow 'avtoelon' as a market_listings source (the dedicated UZ car marketplace,
-- added as a price-intelligence collector alongside OLX/Telegram). Until this runs,
-- the avtoelon collector's ingest is rejected by the CHECK constraint (fail-safe).
ALTER TABLE public.market_listings DROP CONSTRAINT IF EXISTS market_listings_source_check;
ALTER TABLE public.market_listings ADD CONSTRAINT market_listings_source_check
  CHECK (source IN ('olx', 'avtoelon', 'telegram', 'manual', 'other'));
