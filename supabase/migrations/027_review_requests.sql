-- Phase Y4: post-delivery review requests.
--
-- When an order reaches 'delivered', a cron (src/app/api/cron/review-requests)
-- waits N days and then emails/SMSes the customer a one-tap review link
-- prefilled with the car they bought (closes migration 015's reviews.car_id —
-- the per-car AggregateRating that lights up ★ stars in search results).
--
-- review_requested_at is the dedupe stamp: NULL means "delivered but not yet
-- asked"; once set, the customer is never asked again for that order.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;

-- The cron scans delivered orders that haven't been asked yet; a partial index
-- keeps that scan cheap as the orders table grows.
CREATE INDEX IF NOT EXISTS idx_orders_review_pending
  ON public.orders (status)
  WHERE review_requested_at IS NULL;
