-- Bot funnel analytics: a lightweight event log for the Telegram bot funnel
-- (start → recommend → car_view → reserve → lead). Lets us see where users drop.
-- Written fire-and-forget by the bot webhook via the service client; read via
-- the Management API or an admin query. Service-role only.
CREATE TABLE IF NOT EXISTS public.bot_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id BIGINT,
  event TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_events_event_created ON public.bot_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_events_created ON public.bot_events (created_at DESC);

ALTER TABLE public.bot_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service-role client writes/reads this table.
