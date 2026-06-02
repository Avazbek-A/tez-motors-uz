-- Phase: CRM segments & targeted outreach.
--
-- A record of each targeted campaign sent to a segment (audience) via email or
-- SMS, with delivery counts. The segments themselves are computed live from
-- existing data — only the send record is stored here. Service-role only.
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject TEXT,
  body TEXT NOT NULL,
  targeted INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_created ON public.campaigns (created_at DESC);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.
