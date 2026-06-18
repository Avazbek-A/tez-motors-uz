-- Migration: Add metadata JSONB column to calls table to store AI intelligence (entities, compliance, sentiment).
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS metadata jsonb;
