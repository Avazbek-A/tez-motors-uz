-- Phase X1: a second online-deposit rail (Click.uz) alongside Payme.
--
-- The payments table (020) was Payme-only: one NOT NULL UNIQUE payme_transaction_id
-- per row, which was the idempotency guard. To add Click without forking the
-- table we generalise:
--   * `provider` tags each row ('payme' | 'click' | 'uzum').
--   * `provider_transaction_id` holds the rail's own transaction id; a per-provider
--     UNIQUE index on (provider, provider_transaction_id) is the new idempotency
--     guard, so a re-sent Click callback resolves to the same row.
-- payme_transaction_id is kept (its existing UNIQUE still backstops the live Payme
-- route, which is left untouched); we only drop its NOT NULL so Click rows — which
-- have no Payme id — can be inserted. Postgres treats NULLs as distinct in a UNIQUE
-- index, so neither index conflicts.
--
-- SERVICE-ROLE-ONLY: payments keeps RLS-enabled / no-policies from 020.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'payme';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

-- Backfill the generic id from the historical Payme-only column.
UPDATE public.payments
  SET provider_transaction_id = payme_transaction_id
  WHERE provider_transaction_id IS NULL AND payme_transaction_id IS NOT NULL;

-- Click rows carry no Payme id — relax the NOT NULL (the UNIQUE stays; multiple
-- NULLs are allowed and don't collide).
ALTER TABLE public.payments
  ALTER COLUMN payme_transaction_id DROP NOT NULL;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_provider_check CHECK (provider IN ('payme', 'click', 'uzum'));

-- Per-provider idempotency guard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_tx
  ON public.payments (provider, provider_transaction_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments (provider);
