-- Phase O: import-order tracking portal.
--
-- A reservation becomes a trackable order with a status timeline that mirrors
-- the importer's real workflow (order placed in China -> deposit -> sourcing ->
-- shipping -> customs -> ready -> delivered). The customer looks it up on the
-- public /track page by reference code + phone (no login). The dealer advances
-- status from /admin/orders, and each advance emails/Telegrams the customer.
--
-- Both tables are SERVICE-ROLE-ONLY: RLS is enabled with no policies, so the
-- anon key can neither read nor write them. The /api/track route uses the
-- service-role client and gates every lookup on reference_code + phone, so no
-- order data ever leaks to an unauthenticated reader. Mirrors the locked-down
-- inquiries table (migrations 002/004).

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (
    status IN (
      'ordered',
      'deposit_paid',
      'sourcing',
      'in_transit',
      'at_customs',
      'ready_for_pickup',
      'delivered'
    )
  ),
  car_id UUID REFERENCES public.cars(id) ON DELETE SET NULL,
  inquiry_id UUID REFERENCES public.inquiries(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  locale TEXT NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru', 'uz', 'en')),
  amount_usd NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service-role client may touch this table.

CREATE INDEX IF NOT EXISTS idx_orders_reference_code ON public.orders (reference_code);
CREATE INDEX IF NOT EXISTS idx_orders_car_id ON public.orders (car_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- Append-only audit log of every status change (and free-text notes the dealer
-- adds along the way). Never updated or deleted in normal operation.
CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON public.order_events (order_id, created_at);
