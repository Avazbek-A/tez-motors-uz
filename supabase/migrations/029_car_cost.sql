-- Phase: per-car profit ledger.
--
-- Purchase cost (USD) the dealer paid, kept in a SEPARATE service-role-only
-- table — never a column on public.cars, because the public car routes select
-- '*' on the anon client and a cost column would leak the dealer's margins to
-- anyone. Mirrors the locked-down inquiries/orders/payments pattern: RLS on,
-- no policies, so only the service-role client can read or write it.
CREATE TABLE IF NOT EXISTS public.car_costs (
  car_id UUID PRIMARY KEY REFERENCES public.cars(id) ON DELETE CASCADE,
  cost_usd NUMERIC NOT NULL CHECK (cost_usd >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.car_costs ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.
