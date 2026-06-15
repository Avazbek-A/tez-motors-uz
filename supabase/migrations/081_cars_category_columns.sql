-- Materialize two derived categorization attributes as real columns so the catalog
-- can FILTER + paginate on them (seat count + electric range live in spec_data, not
-- queryable directly). Backfilled from categorizeCar() via /api/admin/cars/recategorize.
-- drivetrain already exists (was null) and is backfilled by the same job. year /
-- transmission / mileage / engine_power are existing columns — no schema change, just
-- wired into the query + sidebar.
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS seats integer;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS range_km integer;

CREATE INDEX IF NOT EXISTS cars_seats_idx ON public.cars (seats) WHERE seats IS NOT NULL;
CREATE INDEX IF NOT EXISTS cars_range_km_idx ON public.cars (range_km) WHERE range_km IS NOT NULL;

-- Public read: additive column grant (see 079 — column GRANTs accumulate, so this
-- adds seats/range_km to the existing public set without re-listing it). KEEP IN SYNC
-- with PUBLIC_CAR_COLUMNS (src/lib/car-columns.ts).
GRANT SELECT (seats, range_km) ON public.cars TO anon, authenticated;
