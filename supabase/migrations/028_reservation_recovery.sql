-- Phase: abandoned-reservation recovery.
--
-- A stock reservation flips a car to 'reserved' and opens an order at 'ordered'
-- (unpaid). If the customer never pays the deposit, the car stays locked
-- forever, the sale dies silently, and live inventory is hidden from everyone
-- else. These columns let a cron (api/cron/reservation-recovery) nudge the
-- customer once after a delay, then auto-release the car back to 'available'
-- and lapse the order if still unpaid.
--
-- We deliberately do NOT add a 'cancelled' order status (which would mean
-- touching the 7-status CHECK, the order-status state machine, and the /track
-- timeline). released_at is a terminal stamp the recovery scan filters on.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- Keeps the recovery scan cheap: only unpaid, not-yet-released reservations.
CREATE INDEX IF NOT EXISTS idx_orders_recovery
  ON public.orders (created_at)
  WHERE status = 'ordered' AND released_at IS NULL;
