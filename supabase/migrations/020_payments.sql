-- Phase T: online refundable deposits via Payme (Paycom) merchant API.
--
-- The dealer takes a deposit on an import order. Payme drives the flow by
-- calling our JSON-RPC merchant endpoint (/api/payments/payme); every call is
-- authenticated with the merchant key. We persist one row per Payme
-- transaction, keyed by the Payme transaction id (UNIQUE) — that uniqueness is
-- the idempotency guard the protocol requires: a re-sent CreateTransaction must
-- resolve to the same row, and a re-sent PerformTransaction must never apply the
-- deposit twice.
--
-- The expected deposit amount is pinned on the order (deposit_amount_tiyin) when
-- the checkout link is generated, so CheckPerformTransaction can validate the
-- amount deterministically even though the USD→UZS rate drifts daily.
--
-- SERVICE-ROLE-ONLY: RLS enabled, no policies. The anon key can neither read nor
-- write payments. Mirrors orders (017) and inquiries (002/004).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deposit_amount_tiyin BIGINT;

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payme_transaction_id TEXT NOT NULL UNIQUE,
  amount_tiyin BIGINT NOT NULL,
  -- Payme transaction states: 1 created, 2 performed (paid),
  -- -1 cancelled (was created), -2 cancelled (was performed / refunded).
  state SMALLINT NOT NULL DEFAULT 1,
  reason SMALLINT,
  -- All *_time columns are Payme's millisecond epoch (0 = not yet set).
  create_time BIGINT NOT NULL DEFAULT 0,
  perform_time BIGINT NOT NULL DEFAULT 0,
  cancel_time BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service-role client may touch this table.

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payme_tx ON public.payments (payme_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_state ON public.payments (state);
CREATE INDEX IF NOT EXISTS idx_payments_create_time ON public.payments (create_time);
