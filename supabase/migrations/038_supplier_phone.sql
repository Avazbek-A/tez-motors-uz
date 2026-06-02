-- Phase: supplier WhatsApp messaging.
--
-- Supplier WhatsApp number on the purchase order, so the AI-drafted RFQ /
-- follow-up can be sent with a one-tap wa.me link. Service-role table.
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_phone TEXT;
