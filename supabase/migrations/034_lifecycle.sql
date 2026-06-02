-- Phase: lifecycle automation (service reminders + multi-step nurture).
--
-- service_reminded_at: dedupe stamp so a delivered customer gets a single
--   maintenance/cross-sell reminder, months after delivery.
-- nurture_step: which step of the cold-lead drip a lead has received (0 = none),
--   so the nurture cron can send an escalating 3-touch sequence instead of one.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_reminded_at TIMESTAMPTZ;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS nurture_step INTEGER NOT NULL DEFAULT 0;
