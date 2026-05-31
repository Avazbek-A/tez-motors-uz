-- Phase V4: data hygiene — indexes for hot list queries + housekeeping notes.
--
-- These back queries that grew real over Phases S/Y:
--   * the customer garage lists favorites / saved searches per customer, newest
--     first → composite (customer_id, created_at DESC) beats the single-column
--     idx that only helps the equality, not the ORDER BY.
--   * the admin dashboard + pipeline filter inquiries to the OPEN set (status
--     <> 'closed') ordered by recency → a partial index keeps it small (closed
--     rows accumulate forever and don't belong in the hot path).
--
-- All IF NOT EXISTS so this is safe to re-apply. The single-column predecessors
-- (idx_favorites_customer_id, idx_saved_searches_customer_id from 019) are left
-- in place — Postgres picks whichever is cheaper and they're tiny.

CREATE INDEX IF NOT EXISTS idx_favorites_customer_created
  ON public.favorites (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_searches_customer_created
  ON public.saved_searches (customer_id, created_at DESC);

-- Open-inquiry hot path (dashboard "needs attention", pipeline kanban).
CREATE INDEX IF NOT EXISTS idx_inquiries_open_status
  ON public.inquiries (status, created_at DESC)
  WHERE status <> 'closed';

-- reviews.car_id backfill: intentionally NOT automated. The only signal is the
-- free-text `car_description`, which is too noisy to map to a car_id reliably
-- (e.g. "BYD" vs "BYD Song Plus 2024"). The column stays NULL until an admin
-- links a review to a car in /admin/reviews (migration 015 added the FK + the
-- dropdown). Per-car AggregateRating (Phase Y4) simply ignores unlinked reviews.

-- otp_codes cleanup is handled by the scheduled job /api/cron/otp-cleanup
-- (deletes consumed or expired rows) rather than a DB trigger, so it stays
-- observable and rate-bounded like the other cron sweeps.
