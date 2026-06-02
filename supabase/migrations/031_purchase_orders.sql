-- Phase: procurement / buy-side tracking.
--
-- The supplier side of the importer the system was missing: when demand says
-- "import these", the dealer records a purchase order to a Chinese supplier and
-- tracks it from draft → ordered → in_production → shipped → arrived. Distinct
-- from public.orders (which is the CUSTOMER's order). Service-role only — this
-- is internal procurement + cost data, never public.
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  year INTEGER,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty >= 1),
  unit_cost_usd NUMERIC CHECK (unit_cost_usd IS NULL OR unit_cost_usd >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'ordered', 'in_production', 'shipped', 'arrived', 'cancelled')
  ),
  eta_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON public.purchase_orders (created_at DESC);
