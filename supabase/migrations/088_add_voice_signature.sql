-- Migration: Add voice_signature double precision[] column to calls table to store biometric voice print profiles.
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS voice_signature double precision[];

-- Index for querying calls by voice signature
CREATE INDEX IF NOT EXISTS calls_voice_signature_idx ON public.calls USING gin (voice_signature);
