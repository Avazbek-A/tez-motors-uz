-- Leap 4: calibrate the customs model against the dealer's REAL cleared imports.
--
-- Every car the dealer actually clears, log the real assessed customs alongside
-- what our model (customs-uz) predicted for the same inputs. The admin view then
-- shows predicted-vs-actual divergence + a suggested correction factor — turning
-- the calculator into a learning system grounded in the dealer's own receipts,
-- not a competitor's bot. Service-role only (written via /api/admin/customs-actuals).
CREATE TABLE IF NOT EXISTS public.customs_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID,                          -- optional link to cars
  label TEXT,                           -- "BYD Han 2024", free text
  category TEXT NOT NULL DEFAULT 'car', -- car|moto|engine|truck|bus|fura
  kind TEXT,                            -- fuel/vehicle kind
  age TEXT,                             -- new|used1to3|used3plus
  origin TEXT,                          -- fta|certified|uncertified
  engine_cc INTEGER,
  price_usd NUMERIC NOT NULL,           -- customs value used (car + freight)
  predicted_customs_usd NUMERIC NOT NULL, -- our model at log time
  actual_customs_usd NUMERIC NOT NULL,    -- what was really cleared
  cleared_at DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customs_actuals ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_customs_actuals_created_at ON public.customs_actuals (created_at DESC);
