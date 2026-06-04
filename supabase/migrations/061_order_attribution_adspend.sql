-- Phase AN — attribution ROI / channel economics.
--
-- Two additive columns close the channel → revenue loop:
--  - orders.attribution: the acquisition attribution (utm/referrer/ref) copied
--    from the originating lead at order creation, so deposits + margin trace to
--    a channel without a fragile phone-only join.
--  - expenses.channel: tags a marketing-category expense to a channel
--    (olx/google/meta/telegram/instagram/facebook/other) so CPA/ROAS can be
--    computed per channel.
-- Additive only; no RLS change (orders/expenses already service-role only).

ALTER TABLE public.orders   ADD COLUMN IF NOT EXISTS attribution jsonb;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS channel text;
