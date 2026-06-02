-- Phase: autonomous AI sales closer.
--
-- Conversation-level memory on top of assistant_messages (which stores the raw
-- turns). One row per thread accumulates the qualification profile, the sales
-- stage, a lead score, captured contact, and a handoff flag so the dealer can
-- see live AI conversations and take over the hot ones. Service-role only
-- (the assistant route and admin views are all server-side), mirroring the
-- locked-down inquiries/assistant_messages pattern: RLS on, no policies.
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  thread_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'web',
  locale TEXT NOT NULL DEFAULT 'ru',
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  stage TEXT NOT NULL DEFAULT 'greeting',
  lead_score INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  phone TEXT,
  email TEXT,
  handoff BOOLEAN NOT NULL DEFAULT false,
  handoff_reason TEXT,
  inquiry_id UUID,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dealer oversight lists hot/handoff conversations first, newest activity first.
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_activity
  ON public.assistant_conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_handoff
  ON public.assistant_conversations (handoff, lead_score DESC) WHERE handoff;

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.
