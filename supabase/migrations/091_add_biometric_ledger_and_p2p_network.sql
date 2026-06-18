-- Migration: Add biometric ledger and P2P dealer inventory cooperative network.
CREATE TABLE IF NOT EXISTS public.biometric_ledger (
  id             uuid primary key default gen_random_uuid(),
  inquiry_id     uuid references public.inquiries(id) on delete set null,
  caller_phone   text not null,
  cryptographic_signature text not null,
  amount_usd     numeric not null,
  verified_at    timestamptz not null default now(),
  status         text not null default 'signed' check (status in ('pending', 'signed', 'completed'))
);

CREATE TABLE IF NOT EXISTS public.p2p_dealer_inventory (
  id             uuid primary key default gen_random_uuid(),
  dealer_name    text not null,
  vehicle_model  text not null,
  color          text not null,
  wholesale_price numeric not null,
  commission_usd numeric not null,
  eta_days       integer not null default 30,
  available      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Enable RLS (service-role only)
ALTER TABLE public.biometric_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2p_dealer_inventory ENABLE ROW LEVEL SECURITY;
