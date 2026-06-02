-- Phase: market price intelligence.
--
-- Observed competitor/market listings (from OLX, Telegram car channels, or
-- manual/AI-parsed entry) used to (a) quote competitively and (b) rank which
-- models are most profitable to import (market price − landed cost). Prices are
-- normalized to USD on ingest (raw kept for audit). Internal pricing data —
-- service-role only (RLS on, no policies), mirroring car_costs/inquiries.
CREATE TABLE IF NOT EXISTS public.market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('olx', 'telegram', 'manual', 'other')),
  source_ref TEXT,                       -- listing URL / channel:msg id
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  mileage_km INTEGER,
  price_usd NUMERIC,                     -- normalized
  price_raw NUMERIC,                     -- as observed
  currency_raw TEXT,                     -- 'UZS' | 'USD' | …
  condition TEXT,                        -- 'new' | 'used'
  city TEXT,
  posted_at TIMESTAMPTZ,                 -- when the listing was posted (if known)
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_text TEXT,
  fingerprint TEXT UNIQUE,               -- dedupe across re-scrapes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_listings_model ON public.market_listings (brand, model, year);
CREATE INDEX IF NOT EXISTS idx_market_listings_observed ON public.market_listings (observed_at DESC);

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.
