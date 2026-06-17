-- Multi-provider failover (2026-06-17): the LLM tier chains now fail over ACROSS
-- providers (OpenRouter / Groq / NVIDIA NIM / Gemini / SiliconFlow), each with
-- its own per-key rate limit. Record WHICH provider answered (or null when the
-- whole cross-provider chain fell through to the template) so the admin "AI
-- Models" dashboard can show per-provider health, not just per-model.
ALTER TABLE public.llm_call_log ADD COLUMN IF NOT EXISTS provider TEXT;
