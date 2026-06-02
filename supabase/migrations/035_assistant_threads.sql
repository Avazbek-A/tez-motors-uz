-- Phase: multi-turn AI sales agent.
--
-- Conversation memory for the "Find my car" assistant. Each turn stores the
-- user message and the assistant reply under a client-supplied thread_id, so a
-- follow-up ("and cheaper?", "what about a 7-seater?") is answered with the
-- prior context. Service-role only (the assistant route is server-side).
CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_assistant_messages_thread
  ON public.assistant_messages (thread_id, created_at);
