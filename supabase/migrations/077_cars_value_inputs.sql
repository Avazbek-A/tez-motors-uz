-- New value inputs (pricing-engine Phase 5). Attributes that materially move a
-- car's worth but weren't captured:
--   in_service_date  — when it was first registered → warranty remaining.
--   battery_soh_pct  — EV/PHEV battery state-of-health (the dominant value driver
--                      for electrics; mileage/age don't capture it).
--   import_channel    — 'official' | 'gray' | null; official commands a premium.
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS in_service_date date,
  ADD COLUMN IF NOT EXISTS battery_soh_pct smallint,
  ADD COLUMN IF NOT EXISTS import_channel text;
