-- Phase V3: collapse the cars.is_available / cars.inventory_status duplication.
--
-- Two columns described the same fact and could diverge:
--   * is_available  BOOLEAN  (legacy, migration 001)
--   * inventory_status TEXT  CHECK (available|reserved|sold) (migration 008)
--
-- inventory_status becomes the SINGLE SOURCE OF TRUTH. is_available is rebuilt as
-- a STORED GENERATED column derived from it, so all existing READ sites (~26 files,
-- the public RLS SELECT policy, the partial index, JSON-LD availability, exports)
-- keep working unchanged — while it becomes impossible to WRITE the two out of sync
-- (Postgres rejects any INSERT/UPDATE that targets a generated column). The handful
-- of write sites were updated in the same change to set inventory_status only.
--
-- Conversion requires dropping the dependents first (you cannot ALTER an existing
-- plain column into a generated one), then recreating them against the new column.

-- 1. Drop the public SELECT policy and the partial index that reference is_available.
DROP POLICY IF EXISTS "Anyone can view available cars" ON public.cars;
DROP INDEX IF EXISTS idx_cars_available;

-- 2. Replace the plain boolean with a generated column. STORED so it can be indexed
--    and used in RLS USING clauses. Existing rows are recomputed from inventory_status.
ALTER TABLE public.cars DROP COLUMN IF EXISTS is_available;
ALTER TABLE public.cars
  ADD COLUMN is_available BOOLEAN
  GENERATED ALWAYS AS (inventory_status = 'available') STORED;

-- 3. Recreate the partial index (unchanged shape — public catalog hot path).
CREATE INDEX IF NOT EXISTS idx_cars_available
  ON public.cars (is_available) WHERE is_available = true;

-- 4. Recreate the public SELECT policy. Semantics are identical to before: anon can
--    read only cars whose inventory_status = 'available' (reserved/sold stay hidden).
CREATE POLICY "Anyone can view available cars" ON public.cars
  FOR SELECT USING (is_available = true);
