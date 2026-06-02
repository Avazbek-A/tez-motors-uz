-- Phase: dormant-customer win-back.
--
-- Dedupe stamp so a past buyer gets a single re-engagement email a year or so
-- after delivery (repeat purchase / trade-in / referral). Service-role table.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS winback_sent_at TIMESTAMPTZ;
