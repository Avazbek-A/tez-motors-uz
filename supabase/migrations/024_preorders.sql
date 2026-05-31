-- Phase W: made-to-order / pre-orders.
--
-- The dealer is an importer: most demand is for configurations that are NOT
-- physically in stock ("bring me a white BYD Song Plus, top trim, 6–8 weeks").
-- `model_catalog` is the MENU of importable models — distinct from the physical
-- `cars` table (which only holds units the dealer actually has). A pre-order
-- reuses the existing orders + order_events timeline and the Payme deposit, so
-- the customer tracks an import exactly like a stock reservation.
--
-- Pre-orders start at status 'ordered' (same as a reservation), so the whole
-- 7-step /track timeline and the Payme deposit→deposit_paid advance work
-- unchanged. We intentionally do NOT add an `incoming` cars.inventory_status:
-- surfacing en-route physical units in the public catalog would mean relaxing
-- the anon SELECT policy (migration 022 pins it to is_available = true), and
-- pre-orders don't need it — they're driven entirely by model_catalog. Stock
-- semantics stay untouched.

-- 1. model_catalog: what the dealer can import. Public read only when orderable
--    (mirrors the cars available-only policy); writes are service-role only.
CREATE TABLE IF NOT EXISTS public.model_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  trims TEXT[] NOT NULL DEFAULT '{}',
  body_type TEXT,
  fuel_type TEXT,
  year INTEGER,
  base_price_usd NUMERIC(12, 2),
  lead_time_weeks_min INTEGER NOT NULL DEFAULT 6,
  lead_time_weeks_max INTEGER NOT NULL DEFAULT 8,
  available_colors TEXT[] NOT NULL DEFAULT '{}',
  thumbnail TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  description_ru TEXT,
  description_uz TEXT,
  description_en TEXT,
  is_orderable BOOLEAN NOT NULL DEFAULT false,
  order_position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.model_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view orderable models" ON public.model_catalog;
CREATE POLICY "Anyone can view orderable models" ON public.model_catalog
  FOR SELECT USING (is_orderable = true);
-- No INSERT/UPDATE/DELETE policy: only the service-role client may write.

CREATE INDEX IF NOT EXISTS idx_model_catalog_orderable
  ON public.model_catalog (is_orderable, order_position) WHERE is_orderable = true;
CREATE INDEX IF NOT EXISTS idx_model_catalog_brand ON public.model_catalog (brand);

-- 2. orders: pre-order columns. model_id links the chosen menu entry; config
--    captures trim/color/options as jsonb; quoted_lead_time_weeks pins the ETA
--    shown at order time so a later catalog edit can't silently change the
--    promise the customer was given.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES public.model_catalog(id) ON DELETE SET NULL;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quoted_lead_time_weeks TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_model_id ON public.orders (model_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_preorder
  ON public.orders (is_preorder) WHERE is_preorder = true;
