-- Phase: promotions / offers engine.
--
-- Time-limited price promotions on a car. Activating snapshots the pre-promo
-- price (so it can be reverted exactly) and lowers cars.price_usd while setting
-- cars.original_price_usd to the snapshot — which the storefront already renders
-- as a strikethrough. The promotions-apply cron activates/ends them on schedule.
-- Service-role only (RLS on, no policies).
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  label TEXT,
  sale_price_usd INTEGER NOT NULL,
  pre_promo_price_usd INTEGER,           -- snapshot taken at activation
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
  announced BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_status ON public.promotions (status, starts_at, ends_at);
-- At most one live (scheduled/active) promo per car.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_promotions_live_car
  ON public.promotions (car_id) WHERE status IN ('scheduled', 'active');

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.
