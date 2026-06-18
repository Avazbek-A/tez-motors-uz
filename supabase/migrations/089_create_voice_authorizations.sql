-- Migration: Create voice_authorizations table for logging cryptographic voice signature transaction approvals.
CREATE TABLE IF NOT EXISTS public.voice_authorizations (
  id             uuid primary key default gen_random_uuid(),
  call_id        uuid references public.calls(id) on delete set null,
  inquiry_id     uuid references public.inquiries(id) on delete set null,
  phone          text not null,
  verification_phrase text not null,
  verification_token text not null,
  similarity_score numeric not null,
  created_at     timestamptz not null default now()
);

-- Enable Row Level Security (RLS) - service-role only
ALTER TABLE public.voice_authorizations ENABLE ROW LEVEL SECURITY;
