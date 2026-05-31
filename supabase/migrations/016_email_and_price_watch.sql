-- Phase N: move price-drop notifications from a DB trigger to the app layer,
-- and give newsletter subscribers a real home (instead of fake inquiry rows).
--
-- Why drop the trigger: plpgsql cannot call the Resend HTTP API, so the old
-- trg_notify_price_watch_buyers (migration 009) could only insert an internal
-- "price_drop" inquiry the BUYER never saw. Price-drop detection now lives in
-- the car-update route (src/app/api/cars/[id]/route.ts), which emails watchers
-- and sets price_watches.notified_at. That column already exists (009), so no
-- schema change is needed there.

DROP TRIGGER IF EXISTS trg_notify_price_watch_buyers ON public.cars;
DROP FUNCTION IF EXISTS public.notify_price_watch_buyers();

-- Newsletter subscribers — service-role-only (no public policies; the service
-- key bypasses RLS). Mirrors the locked-down inquiries table (migrations 002/004).
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru', 'uz', 'en')),
  source_page TEXT,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT policies on purpose: only the service-role client may touch this.
