-- Migration: Add Next-Gen CRM VoIP & AI Call Center tables (Leaps 10-19)

-- 1. Computer Vision Showroom Analytics
CREATE TABLE IF NOT EXISTS public.showroom_cv_logs (
  id             uuid primary key default gen_random_uuid(),
  visitor_id     uuid not null default gen_random_uuid(),
  car_id         uuid references public.cars(id) on delete set null,
  entry_time     timestamptz not null default now(),
  exit_time      timestamptz,
  attention_duration_seconds integer not null default 0,
  face_match_score numeric not null default 0.0,
  matched_inquiry_id uuid references public.inquiries(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- 2. Regional Dialect Configurations
CREATE TABLE IF NOT EXISTS public.regional_dialect_configs (
  id             uuid primary key default gen_random_uuid(),
  region_name    text not null unique,
  local_greeting text not null,
  polite_suffix  text not null,
  dialect_keywords text[] not null default '{}',
  created_at     timestamptz not null default now()
);

-- Seed regional dialects for Uzbekistan
INSERT INTO public.regional_dialect_configs (region_name, local_greeting, polite_suffix, dialect_keywords)
VALUES 
  ('Tashkent', 'Salom, aka! Qaleysiz?', 'hop bo''ladi, aka', ARRAY['qaleysiz', 'aka', 'hop']),
  ('Fergana', 'Assalomu alaykum, yaxshimisiz?', 'bo''pti, ukam', ARRAY['yaxshimisiz', 'akam', 'aka']),
  ('Samarkand', 'Salom, baxtlimisiz?', 'bo''ladi, jo''ra', ARRAY['jo''ra', 'aka', 'salom'])
ON CONFLICT (region_name) DO NOTHING;

-- 3. Generative Video Collateral
CREATE TABLE IF NOT EXISTS public.generative_video_collateral (
  id             uuid primary key default gen_random_uuid(),
  inquiry_id     uuid references public.inquiries(id) on delete set null,
  video_url      text not null,
  avatar_name    text not null default 'Timur',
  status         text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  generated_at   timestamptz not null default now()
);

-- 4. Voice logistics cargo orders
CREATE TABLE IF NOT EXISTS public.logistics_voice_orders (
  id             uuid primary key default gen_random_uuid(),
  cargo_qty      integer not null default 1,
  vehicle_model  text not null,
  source_city    text not null,
  destination_city text not null,
  carrier_company text not null,
  quote_usd      numeric not null,
  status         text not null default 'draft' check (status in ('draft', 'dispatched', 'delivered')),
  created_at     timestamptz not null default now()
);

-- 5. Multimedia trade-in inspections
CREATE TABLE IF NOT EXISTS public.trade_in_evaluations (
  id             uuid primary key default gen_random_uuid(),
  customer_name  text not null,
  vehicle_details text not null,
  engine_health_status text not null default 'unknown',
  body_damage_details text not null default 'none',
  computed_value_usd numeric not null default 0,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at     timestamptz not null default now()
);

-- Enable RLS (service-role only)
ALTER TABLE public.showroom_cv_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_dialect_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generative_video_collateral ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_voice_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_in_evaluations ENABLE ROW LEVEL SECURITY;
