-- Phase AA: Telegram Mini App identity.
--
-- Customers can now authenticate via their Telegram account (inside the Mini
-- App) instead of phone + OTP. Telegram's initData gives a user id, name and
-- username — but NOT a phone — so we make `phone` nullable and add a unique
-- `telegram_id`. A customer may have either or both (a phone-OTP customer who
-- later opens the Mini App can be linked by phone share; v1 keys on telegram_id).
--
-- Service-role only (RLS already enabled on customers, no policies) — unchanged.
ALTER TABLE public.customers ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_customers_telegram_id
  ON public.customers (telegram_id) WHERE telegram_id IS NOT NULL;
