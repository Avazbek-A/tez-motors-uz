-- Used-car selling section. Big dealers run a New + a Used (pre-owned) catalog.
-- New and used cars share ~95% of their shape (brand/model/year/price/images/
-- specs), so rather than a parallel table we add a `listing_type` discriminator
-- to `cars` plus the fields a used listing needs. `/catalog` stays "all"; the new
-- `/used` section filters listing_type='used'. mileage already exists on cars.

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS listing_type   TEXT NOT NULL DEFAULT 'new'
    CHECK (listing_type IN ('new', 'used')),
  ADD COLUMN IF NOT EXISTS vin            TEXT,
  ADD COLUMN IF NOT EXISTS owners_count   INTEGER CHECK (owners_count IS NULL OR owners_count >= 0),
  ADD COLUMN IF NOT EXISTS accident_free  BOOLEAN,
  ADD COLUMN IF NOT EXISTS condition_grade TEXT
    CHECK (condition_grade IS NULL OR condition_grade IN ('excellent', 'good', 'fair'));

-- Browsing the used section filters on listing_type a lot.
CREATE INDEX IF NOT EXISTS cars_listing_type_idx ON public.cars (listing_type);

-- All new columns are public-readable marketing data (no PII). RLS on `cars` is
-- unchanged: anon SELECT of published rows, service-role writes.
