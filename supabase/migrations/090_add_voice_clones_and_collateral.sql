-- Migration: Add voice clone ID to admin users and collateral fields to inquiries.
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS voice_clone_id TEXT;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS collateral_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_auth_status TEXT DEFAULT 'pending' CHECK (voice_auth_status IN ('pending', 'approved', 'rejected', 'failed'));
