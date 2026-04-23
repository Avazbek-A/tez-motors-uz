-- Revenue and CRM-lite fields for Tez Motors.

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS original_price_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS inventory_status TEXT NOT NULL DEFAULT 'available';

ALTER TABLE public.cars
  ADD CONSTRAINT cars_inventory_status_check
  CHECK (inventory_status IN ('available', 'reserved', 'sold'));

UPDATE public.cars
SET inventory_status = CASE WHEN is_available THEN 'available' ELSE 'sold' END
WHERE inventory_status = 'available' AND is_available = false;

CREATE INDEX IF NOT EXISTS idx_cars_inventory_status
  ON public.cars (inventory_status);

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS assigned_to UUID;

