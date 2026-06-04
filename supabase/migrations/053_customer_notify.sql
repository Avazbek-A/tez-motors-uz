-- Phase AI — chat-first customer outbound.
--
-- `notify_channel` lets a customer pin a preferred channel; null/'auto' uses the
-- smart fan-out in src/lib/customer-messaging.ts (Telegram DM first, then the
-- push+email fallback). `notification_log` is a lightweight delivery record for
-- observability and future cross-channel de-dupe.
--
-- Both are service-role only (RLS enabled, NO policies) — customers never read
-- these directly; the app writes them through requireCustomer / service-role
-- jobs, mirroring orders (017) / payments (020).

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS notify_channel text
  CHECK (notify_channel IS NULL OR notify_channel IN ('auto', 'telegram', 'push', 'email'));

CREATE TABLE IF NOT EXISTS public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  kind        text,
  channel     text not null,
  created_at  timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS notification_log_customer_idx
  ON public.notification_log (customer_id, created_at desc);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only.
