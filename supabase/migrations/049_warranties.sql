-- Phase: after-sales / warranty tracking.
--
-- Per-delivered-car warranty + service history, closing the lifecycle
-- (lead → sale → delivery → warranty → service → repeat). Service records are a
-- jsonb array (a solo dealer logs a handful). Service-role only.
CREATE TABLE IF NOT EXISTS public.warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  car_label TEXT NOT NULL,
  vin TEXT,
  delivered_at DATE,
  warranty_months INTEGER NOT NULL DEFAULT 12,
  warranty_until DATE,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warranties_until ON public.warranties (warranty_until);
CREATE INDEX IF NOT EXISTS idx_warranties_phone ON public.warranties (customer_phone);

ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.
