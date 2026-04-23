-- 003_index_inquiries_car_id.sql
-- Covers inquiries.car_id FK for joins and filtering by car.
-- Partial to keep index small (most inquiries have no car_id).

CREATE INDEX IF NOT EXISTS idx_inquiries_car_id
  ON public.inquiries (car_id)
  WHERE car_id IS NOT NULL;
