-- ============================================================
-- Tez Motors — consolidated schema (ALL migrations, in order)
-- Generated from 45 files in supabase/migrations/
-- FRESH DATABASE ONLY: paste this once into the Supabase SQL editor.
-- For an existing DB, apply only the new individual migration files.
-- ============================================================

-- ─── 001_create_cars.sql ───────────────────────────────────────────
-- Cars table
CREATE TABLE IF NOT EXISTS cars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  price_usd INTEGER NOT NULL,
  price_uzs BIGINT,
  body_type TEXT NOT NULL DEFAULT 'suv',
  fuel_type TEXT NOT NULL DEFAULT 'petrol',
  engine_volume NUMERIC(3,1),
  engine_power INTEGER,
  transmission TEXT NOT NULL DEFAULT 'automatic',
  drivetrain TEXT,
  mileage INTEGER DEFAULT 0,
  color TEXT,
  description_ru TEXT,
  description_uz TEXT,
  description_en TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  thumbnail TEXT,
  is_hot_offer BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  order_position INTEGER DEFAULT 0,
  specs JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cars_brand ON cars(brand);
CREATE INDEX IF NOT EXISTS idx_cars_body_type ON cars(body_type);
CREATE INDEX IF NOT EXISTS idx_cars_fuel_type ON cars(fuel_type);
CREATE INDEX IF NOT EXISTS idx_cars_price ON cars(price_usd);
CREATE INDEX IF NOT EXISTS idx_cars_is_hot ON cars(is_hot_offer) WHERE is_hot_offer = true;
CREATE INDEX IF NOT EXISTS idx_cars_available ON cars(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_cars_slug ON cars(slug);

-- Enable RLS
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;

-- Anonymous can read available cars
CREATE POLICY "Anyone can view available cars" ON cars
  FOR SELECT USING (is_available = true);

-- Inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'general',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT,
  car_id UUID REFERENCES cars(id),
  source_page TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an inquiry
CREATE POLICY "Anyone can submit inquiries" ON inquiries
  FOR INSERT WITH CHECK (true);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  car_description TEXT,
  review_text_ru TEXT,
  review_text_uz TEXT,
  review_text_en TEXT,
  photo_url TEXT,
  video_url TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_published BOOLEAN DEFAULT false,
  order_position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published reviews" ON reviews
  FOR SELECT USING (is_published = true);

-- FAQs table
CREATE TABLE IF NOT EXISTS faqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_ru TEXT NOT NULL,
  question_uz TEXT NOT NULL,
  question_en TEXT NOT NULL,
  answer_ru TEXT NOT NULL,
  answer_uz TEXT NOT NULL,
  answer_en TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  order_position INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published faqs" ON faqs
  FOR SELECT USING (is_published = true);

-- ─── 002_tighten_rls.sql ───────────────────────────────────────────
-- 002_tighten_rls.sql
-- Lock down RLS so the public anon key (exposed in the JS bundle) cannot
-- read PII or mutate core tables. Admin routes use service_role, which
-- bypasses RLS entirely, so no explicit admin policies are needed.

-- Drop permissive policies that currently allow anyone with the anon key
-- to insert/update/delete core content and read every inquiry.

DROP POLICY IF EXISTS "Allow delete cars" ON public.cars;
DROP POLICY IF EXISTS "Allow insert cars" ON public.cars;
DROP POLICY IF EXISTS "Allow update cars" ON public.cars;
DROP POLICY IF EXISTS "Allow read all cars admin" ON public.cars;

DROP POLICY IF EXISTS "Allow delete faqs" ON public.faqs;
DROP POLICY IF EXISTS "Allow insert faqs" ON public.faqs;
DROP POLICY IF EXISTS "Allow update faqs" ON public.faqs;
DROP POLICY IF EXISTS "Allow read all faqs" ON public.faqs;

DROP POLICY IF EXISTS "Allow delete reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow read all reviews" ON public.reviews;

DROP POLICY IF EXISTS "Allow delete inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow read inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow update inquiries" ON public.inquiries;

-- Public SELECT policies are retained as-is:
--   cars:    "Anyone can view available cars"  (is_available = true)
--   faqs:    "Anyone can view published faqs"  (is_published = true)
--   reviews: "Anyone can view published reviews" (is_published = true)
--
-- Public INSERT policies retained so forms continue to work:
--   inquiries: "Anyone can submit inquiries" (WITH CHECK true)
--   reviews:   "Allow insert reviews"        (WITH CHECK true)
--
-- Public review INSERTs are force-moderated at the API layer
-- (src/app/api/reviews/route.ts overrides is_published=false).

-- ─── 003_index_inquiries_car_id.sql ───────────────────────────────────────────
-- 003_index_inquiries_car_id.sql
-- Covers inquiries.car_id FK for joins and filtering by car.
-- Partial to keep index small (most inquiries have no car_id).

CREATE INDEX IF NOT EXISTS idx_inquiries_car_id
  ON public.inquiries (car_id)
  WHERE car_id IS NOT NULL;

-- ─── 004_drop_public_insert_policies.sql ───────────────────────────────────────────
-- 004_drop_public_insert_policies.sql
-- All writes route through Next.js API endpoints using the service role key,
-- which bypasses RLS. The public anon role no longer needs ANY direct-write
-- access, including inquiry / review submission.
--
-- After this migration:
--   public role       -> SELECT only, limited to published/available rows
--   service_role      -> full access (used by server-side API routes only)

DROP POLICY IF EXISTS "Anyone can submit inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow insert reviews" ON public.reviews;

-- ─── 005_site_settings.sql ───────────────────────────────────────────
-- Site settings singleton. Holds client-editable public site configuration
-- (phone, email, social links, etc). Public reads; writes only via service-role.

CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings_public_read" ON public.site_settings;
CREATE POLICY "site_settings_public_read"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Seed the singleton row if missing.
INSERT INTO public.site_settings (id, values)
VALUES ('singleton', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ─── 006_admin_sessions.sql ───────────────────────────────────────────
-- Admin session store for hashed opaque cookies.

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON public.admin_sessions (expires_at);

-- Service role bypasses RLS; no public policies are created on purpose.

-- ─── 007_car_images_storage.sql ───────────────────────────────────────────
-- Public storage bucket for car images.

INSERT INTO storage.buckets (id, name, public)
VALUES ('car-images', 'car-images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    name = EXCLUDED.name;

DROP POLICY IF EXISTS "Public can view car images" ON storage.objects;
CREATE POLICY "Public can view car images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'car-images');

-- ─── 008_car_revenue_and_crm.sql ───────────────────────────────────────────
-- Revenue and CRM-lite fields for Tez Motors.

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS original_price_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS inventory_status TEXT NOT NULL DEFAULT 'available';

ALTER TABLE public.cars
  ADD CONSTRAINT cars_inventory_status_check
  CHECK (inventory_status IN ('available', 'reserved', 'sold'));

UPDATE public.cars
SET inventory_status = CASE WHEN is_available THEN 'available' ELSE 'sold' END
WHERE inventory_status = 'available' AND is_available = false;

CREATE INDEX IF NOT EXISTS idx_cars_inventory_status
  ON public.cars (inventory_status);

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- ─── 009_admin_users_blog_favorites.sql ───────────────────────────────────────────
-- Admin users and session linkage
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'rep' CHECK (role IN ('owner', 'manager', 'rep')),
  disabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE public.admin_sessions
      ADD CONSTRAINT admin_sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS assigned_to UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inquiries_assigned_to_fkey'
  ) THEN
    ALTER TABLE public.inquiries
      ADD CONSTRAINT inquiries_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES public.admin_users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Price watch alerts for buyers
CREATE TABLE IF NOT EXISTS public.price_watches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  target_price_usd NUMERIC(12,2) NOT NULL,
  notified_at TIMESTAMPTZ,
  notified_price_usd NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_watches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_watches_public_insert" ON public.price_watches;
CREATE POLICY "price_watches_public_insert"
  ON public.price_watches FOR INSERT
  WITH CHECK (true);

-- Blog posts
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_ru TEXT NOT NULL,
  title_uz TEXT,
  title_en TEXT,
  body_ru TEXT NOT NULL,
  body_uz TEXT,
  body_en TEXT,
  cover_image TEXT,
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_public_read" ON public.posts;
CREATE POLICY "posts_public_read"
  ON public.posts FOR SELECT
  USING (is_published = true);

CREATE INDEX IF NOT EXISTS idx_posts_published_at ON public.posts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_watches_car_id ON public.price_watches (car_id);

CREATE OR REPLACE FUNCTION public.notify_price_watch_buyers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  watch RECORD;
BEGIN
  IF NEW.price_usd >= OLD.price_usd THEN
    RETURN NEW;
  END IF;

  FOR watch IN
    SELECT *
    FROM public.price_watches
    WHERE car_id = NEW.id
      AND notified_at IS NULL
      AND target_price_usd >= NEW.price_usd
  LOOP
    INSERT INTO public.inquiries (
      type,
      name,
      phone,
      email,
      message,
      car_id,
      source_page,
      metadata,
      status
    ) VALUES (
      'price_drop',
      'Price watch',
      watch.email,
      watch.email,
      format('Target reached for %s. Current price: %s', NEW.slug, NEW.price_usd),
      NEW.id,
      format('/catalog/%s', NEW.slug),
      jsonb_build_object(
        'email', watch.email,
        'target_price_usd', watch.target_price_usd,
        'current_price_usd', NEW.price_usd
      ),
      'new'
    );

    UPDATE public.price_watches
      SET notified_at = now(),
          notified_price_usd = NEW.price_usd
      WHERE id = watch.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_price_watch_buyers ON public.cars;
CREATE TRIGGER trg_notify_price_watch_buyers
AFTER UPDATE OF price_usd ON public.cars
FOR EACH ROW
EXECUTE FUNCTION public.notify_price_watch_buyers();

-- ─── 010_cars_trigram_search.sql ───────────────────────────────────────────
-- Fuzzy search for cars + foundation for parts catalog (Phase J).
-- Enables Postgres trigram similarity so that "byd" matches "BYD Song Plus"
-- and typos like "tiggo" still find "Tiggo 8 Pro".

create extension if not exists pg_trgm;

-- Functional GIN index on brand+model+description used by /api/cars search.
create index if not exists cars_search_trgm_idx
  on public.cars
  using gin (
    (
      coalesce(brand, '') || ' ' ||
      coalesce(model, '') || ' ' ||
      coalesce(description_ru, '')
    ) gin_trgm_ops
  );

-- Optional: set a lower default similarity threshold for this schema so
-- short queries like "byd" still match. The API uses the `%` operator which
-- honors this threshold.
-- pg_trgm default is 0.3; 0.2 lets 3-letter prefixes work.
-- This is a session-level setting normally; the API sets it explicitly.

-- ─── 011_parts_catalog.sql ───────────────────────────────────────────
-- Phase J: Spare parts catalog — second product vertical alongside cars.
-- Reuses pg_trgm extension from 010. Not polymorphic with cars: schemas differ.

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  oem_number text,
  name_ru text not null,
  name_uz text,
  name_en text,
  description_ru text,
  description_uz text,
  description_en text,
  category text not null check (category in (
    'engine','body','electrical','suspension','brakes','interior','other'
  )),
  brand text,
  price_usd numeric,
  original_price_usd numeric,
  stock_qty integer not null default 0,
  images text[] not null default '{}',
  is_published boolean not null default false,
  fits_brands text[] not null default '{}',
  fits_models text[] not null default '{}',
  fits_year_from integer,
  fits_year_to integer,
  order_position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parts_category_idx on public.parts (category);
create index if not exists parts_published_idx on public.parts (is_published) where is_published;
create index if not exists parts_fits_brands_gin on public.parts using gin (fits_brands);
create index if not exists parts_fits_models_gin on public.parts using gin (fits_models);
create index if not exists parts_oem_idx on public.parts (oem_number) where oem_number is not null;
create index if not exists parts_search_trgm_idx on public.parts
  using gin (
    (
      coalesce(oem_number, '') || ' ' ||
      coalesce(name_ru, '') || ' ' ||
      coalesce(name_en, '') || ' ' ||
      coalesce(brand, '')
    ) gin_trgm_ops
  );

-- Keep updated_at fresh on writes.
create or replace function public.parts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists parts_updated_at on public.parts;
create trigger parts_updated_at
  before update on public.parts
  for each row execute function public.parts_set_updated_at();

-- RLS: public can read published only; writes via service role only.
alter table public.parts enable row level security;

drop policy if exists "parts public read" on public.parts;
create policy "parts public read"
  on public.parts
  for select
  to anon, authenticated
  using (is_published);

-- No insert/update/delete policies → service-role-only writes.

-- Extend inquiries.type check constraint to allow part_inquiry.
-- The existing constraint was created with a name we don't know; drop-by-find.
do $$
declare
  cn text;
begin
  select conname into cn
    from pg_constraint
   where conrelid = 'public.inquiries'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%type%in%';
  if cn is not null then
    execute format('alter table public.inquiries drop constraint %I', cn);
  end if;
end$$;

alter table public.inquiries
  add constraint inquiries_type_check
  check (type in (
    'general','car_inquiry','callback','calculator','reservation',
    'test_drive','trade_in','newsletter','price_drop','service','part_inquiry'
  ));

-- ─── 012_part_images_storage.sql ───────────────────────────────────────────
-- Public storage bucket for part images. Mirrors car-images (007).

INSERT INTO storage.buckets (id, name, public)
VALUES ('part-images', 'part-images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    name = EXCLUDED.name;

DROP POLICY IF EXISTS "Public can view part images" ON storage.objects;
CREATE POLICY "Public can view part images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'part-images');

-- ─── 013_parts_wholesale.sql ───────────────────────────────────────────
-- Wholesale pricing tier on parts catalog.
-- Dealer works with two audiences: walk-in retail buyers and garages that
-- reorder in bulk. The retail (price_usd) column already exists; this adds
-- a separate wholesale price plus a minimum-order quantity gate so the
-- public site only reveals the bulk price to logged-in or flagged
-- wholesale visitors.
alter table public.parts
  add column if not exists wholesale_price_usd numeric,
  add column if not exists min_order_qty integer not null default 1;

alter table public.parts
  add constraint parts_min_order_qty_positive check (min_order_qty >= 1);

-- ─── 014_trigram_search_rpcs.sql ───────────────────────────────────────────
-- Typo-tolerant search via pg_trgm similarity.
-- ILIKE already uses trigram GIN indexes for '%q%' patterns, but doesn't
-- tolerate typos ("biyd" → "BYD"). These RPCs use the `%` operator which
-- does — threshold 0.2 for short queries.
--
-- The API calls these to collect matching IDs, then filters the main
-- query by `id in (...)`. This keeps the existing filter composition
-- (brand, price range, category, etc.) working unchanged.

create or replace function public.search_cars_ids(q text, max_results int default 200)
returns table (id uuid, score real)
language sql
stable
as $$
  select
    c.id,
    similarity(
      coalesce(c.brand,'') || ' ' ||
      coalesce(c.model,'') || ' ' ||
      coalesce(c.description_ru,''),
      q
    ) as score
  from public.cars c
  where (
    coalesce(c.brand,'') || ' ' ||
    coalesce(c.model,'') || ' ' ||
    coalesce(c.description_ru,'')
  ) % q
  order by score desc
  limit max_results;
$$;

create or replace function public.search_parts_ids(q text, max_results int default 200)
returns table (id uuid, score real)
language sql
stable
as $$
  select
    p.id,
    greatest(
      similarity(coalesce(p.oem_number,''), q),
      similarity(
        coalesce(p.oem_number,'') || ' ' ||
        p.name_ru || ' ' ||
        coalesce(p.name_en,'') || ' ' ||
        coalesce(p.brand,''),
        q
      )
    ) as score
  from public.parts p
  where
    p.oem_number = q
    or (
      coalesce(p.oem_number,'') || ' ' ||
      p.name_ru || ' ' ||
      coalesce(p.name_en,'') || ' ' ||
      coalesce(p.brand,'')
    ) % q
  order by score desc
  limit max_results;
$$;

-- Allow anon + authenticated to call these read-only.
grant execute on function public.search_cars_ids(text, int) to anon, authenticated;
grant execute on function public.search_parts_ids(text, int) to anon, authenticated;

-- ─── 015_reviews_link_car.sql ───────────────────────────────────────────
-- Link reviews to a specific car so each car detail page can show an
-- AggregateRating in its Product schema (rich snippets boost CTR).
-- Existing reviews stay un-linked; admin can backfill via the form.
alter table public.reviews
  add column if not exists car_id uuid references public.cars(id) on delete set null;

create index if not exists idx_reviews_car_id
  on public.reviews(car_id)
  where car_id is not null;

-- ─── 016_email_and_price_watch.sql ───────────────────────────────────────────
-- Phase N: move price-drop notifications from a DB trigger to the app layer,
-- and give newsletter subscribers a real home (instead of fake inquiry rows).
--
-- Why drop the trigger: plpgsql cannot call the Resend HTTP API, so the old
-- trg_notify_price_watch_buyers (migration 009) could only insert an internal
-- "price_drop" inquiry the BUYER never saw. Price-drop detection now lives in
-- the car-update route (src/app/api/cars/[id]/route.ts), which emails watchers
-- and sets price_watches.notified_at. That column already exists (009), so no
-- schema change is needed there.

DROP TRIGGER IF EXISTS trg_notify_price_watch_buyers ON public.cars;
DROP FUNCTION IF EXISTS public.notify_price_watch_buyers();

-- Newsletter subscribers — service-role-only (no public policies; the service
-- key bypasses RLS). Mirrors the locked-down inquiries table (migrations 002/004).
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru', 'uz', 'en')),
  source_page TEXT,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT policies on purpose: only the service-role client may touch this.

-- ─── 017_orders.sql ───────────────────────────────────────────
-- Phase O: import-order tracking portal.
--
-- A reservation becomes a trackable order with a status timeline that mirrors
-- the importer's real workflow (order placed in China -> deposit -> sourcing ->
-- shipping -> customs -> ready -> delivered). The customer looks it up on the
-- public /track page by reference code + phone (no login). The dealer advances
-- status from /admin/orders, and each advance emails/Telegrams the customer.
--
-- Both tables are SERVICE-ROLE-ONLY: RLS is enabled with no policies, so the
-- anon key can neither read nor write them. The /api/track route uses the
-- service-role client and gates every lookup on reference_code + phone, so no
-- order data ever leaks to an unauthenticated reader. Mirrors the locked-down
-- inquiries table (migrations 002/004).

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (
    status IN (
      'ordered',
      'deposit_paid',
      'sourcing',
      'in_transit',
      'at_customs',
      'ready_for_pickup',
      'delivered'
    )
  ),
  car_id UUID REFERENCES public.cars(id) ON DELETE SET NULL,
  inquiry_id UUID REFERENCES public.inquiries(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  locale TEXT NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru', 'uz', 'en')),
  amount_usd NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service-role client may touch this table.

CREATE INDEX IF NOT EXISTS idx_orders_reference_code ON public.orders (reference_code);
CREATE INDEX IF NOT EXISTS idx_orders_car_id ON public.orders (car_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- Append-only audit log of every status change (and free-text notes the dealer
-- adds along the way). Never updated or deleted in normal operation.
CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON public.order_events (order_id, created_at);

-- ─── 018_fx_rate.sql ───────────────────────────────────────────
-- Phase R: store the USD/UZS exchange rate as its own site_settings row.
--
-- The singleton row is replaced wholesale by /api/admin/settings (it upserts the
-- validated contact fields), so stashing the rate inside it would be wiped on
-- the next "Save settings". Instead we keep the rate in a separate 'fx_rate' row
-- refreshed by the /api/cron/rates job (pulled from cbu.uz). Public read is fine
-- (an exchange rate is not sensitive); writes are service-role only.

ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_id_check;
ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_id_check CHECK (id IN ('singleton', 'fx_rate'));

INSERT INTO public.site_settings (id, values)
VALUES ('fx_rate', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ─── 019_customer_accounts.sql ───────────────────────────────────────────
-- Phase S: customer accounts & retention.
--
-- Phone-first identity (OTP over SMS), a persistent garage (favorites +
-- saved searches that survive across devices), and Web Push subscriptions for
-- re-engagement. Mirrors the admin auth model exactly: an opaque session token
-- lives in an httpOnly cookie, only its SHA-256 hash is stored server-side, and
-- the OTP itself is stored hashed with an attempt cap + short TTL.
--
-- Every table here holds PII (phones, emails, push endpoints) and is therefore
-- SERVICE-ROLE-ONLY: RLS enabled, NO policies, so the anon key can neither read
-- nor write. All access goes through the service-role client in the
-- /api/account/* routes, gated by the customer session. Mirrors the locked-down
-- inquiries (002/004) and orders (017) tables.

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  locale TEXT NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru', 'uz', 'en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

-- Sessions: opaque token hashed (mirrors admin_sessions).
CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_customer_sessions_token_hash ON public.customer_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_id ON public.customer_sessions (customer_id);

-- One-time passwords: hashed code, short TTL, attempt cap.
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON public.otp_codes (phone, created_at DESC);

-- ---------------------------------------------------------------------------
-- The garage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favorites (
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, car_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_favorites_customer_id ON public.favorites (customer_id);

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saved_searches_customer_id ON public.saved_searches (customer_id);

-- ---------------------------------------------------------------------------
-- Web Push
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru', 'uz', 'en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer_id ON public.push_subscriptions (customer_id);

-- ---------------------------------------------------------------------------
-- Link existing email-only price watches to an account when one logs in.
-- Existing anonymous (email-only) watches keep working with a NULL customer_id.
-- ---------------------------------------------------------------------------
ALTER TABLE public.price_watches
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_price_watches_customer_id ON public.price_watches (customer_id);

-- ─── 020_payments.sql ───────────────────────────────────────────
-- Phase T: online refundable deposits via Payme (Paycom) merchant API.
--
-- The dealer takes a deposit on an import order. Payme drives the flow by
-- calling our JSON-RPC merchant endpoint (/api/payments/payme); every call is
-- authenticated with the merchant key. We persist one row per Payme
-- transaction, keyed by the Payme transaction id (UNIQUE) — that uniqueness is
-- the idempotency guard the protocol requires: a re-sent CreateTransaction must
-- resolve to the same row, and a re-sent PerformTransaction must never apply the
-- deposit twice.
--
-- The expected deposit amount is pinned on the order (deposit_amount_tiyin) when
-- the checkout link is generated, so CheckPerformTransaction can validate the
-- amount deterministically even though the USD→UZS rate drifts daily.
--
-- SERVICE-ROLE-ONLY: RLS enabled, no policies. The anon key can neither read nor
-- write payments. Mirrors orders (017) and inquiries (002/004).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deposit_amount_tiyin BIGINT;

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payme_transaction_id TEXT NOT NULL UNIQUE,
  amount_tiyin BIGINT NOT NULL,
  -- Payme transaction states: 1 created, 2 performed (paid),
  -- -1 cancelled (was created), -2 cancelled (was performed / refunded).
  state SMALLINT NOT NULL DEFAULT 1,
  reason SMALLINT,
  -- All *_time columns are Payme's millisecond epoch (0 = not yet set).
  create_time BIGINT NOT NULL DEFAULT 0,
  perform_time BIGINT NOT NULL DEFAULT 0,
  cancel_time BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service-role client may touch this table.

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payme_tx ON public.payments (payme_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_state ON public.payments (state);
CREATE INDEX IF NOT EXISTS idx_payments_create_time ON public.payments (create_time);

-- ─── 021_admin_audit.sql ───────────────────────────────────────────
-- Phase V2: admin audit log.
--
-- A multi-user dealer now edits inventory, advances orders, and configures the
-- site — and since Phase T it takes deposits. There was no record of who
-- changed what, when. This table is an append-only trail: every privileged
-- write (create / update / delete / status change) writes one compact row with
-- a JSONB `diff` (changed fields only — never full rows, to keep it bounded).
--
-- SERVICE-ROLE-ONLY: RLS enabled, no policies. The anon key can neither read
-- nor write. The admin panel reads it through the service-role API route
-- (/api/admin/audit), gated by requireAdmin. Mirrors orders (017) / payments
-- (020) / customers (019).

CREATE TABLE IF NOT EXISTS public.admin_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Who. actor_admin_id is null for legacy sessions with no linked user.
  actor_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  actor_email TEXT,
  -- What. action: create | update | delete | status_change | restock | ...
  action TEXT NOT NULL,
  -- Which kind of thing: car | part | order | review | faq | post | user | settings | ...
  entity TEXT NOT NULL,
  entity_id TEXT,
  -- Changed fields only (compact), or the notable payload of the action.
  diff JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON public.admin_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON public.admin_audit (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit (actor_admin_id);

-- ─── 022_inventory_status_single_source.sql ───────────────────────────────────────────
-- Phase V3: collapse the cars.is_available / cars.inventory_status duplication.
--
-- Two columns described the same fact and could diverge:
--   * is_available  BOOLEAN  (legacy, migration 001)
--   * inventory_status TEXT  CHECK (available|reserved|sold) (migration 008)
--
-- inventory_status becomes the SINGLE SOURCE OF TRUTH. is_available is rebuilt as
-- a STORED GENERATED column derived from it, so all existing READ sites (~26 files,
-- the public RLS SELECT policy, the partial index, JSON-LD availability, exports)
-- keep working unchanged — while it becomes impossible to WRITE the two out of sync
-- (Postgres rejects any INSERT/UPDATE that targets a generated column). The handful
-- of write sites were updated in the same change to set inventory_status only.
--
-- Conversion requires dropping the dependents first (you cannot ALTER an existing
-- plain column into a generated one), then recreating them against the new column.

-- 1. Drop the public SELECT policy and the partial index that reference is_available.
DROP POLICY IF EXISTS "Anyone can view available cars" ON public.cars;
DROP INDEX IF EXISTS idx_cars_available;

-- 2. Replace the plain boolean with a generated column. STORED so it can be indexed
--    and used in RLS USING clauses. Existing rows are recomputed from inventory_status.
ALTER TABLE public.cars DROP COLUMN IF EXISTS is_available;
ALTER TABLE public.cars
  ADD COLUMN is_available BOOLEAN
  GENERATED ALWAYS AS (inventory_status = 'available') STORED;

-- 3. Recreate the partial index (unchanged shape — public catalog hot path).
CREATE INDEX IF NOT EXISTS idx_cars_available
  ON public.cars (is_available) WHERE is_available = true;

-- 4. Recreate the public SELECT policy. Semantics are identical to before: anon can
--    read only cars whose inventory_status = 'available' (reserved/sold stay hidden).
CREATE POLICY "Anyone can view available cars" ON public.cars
  FOR SELECT USING (is_available = true);

-- ─── 023_data_hygiene.sql ───────────────────────────────────────────
-- Phase V4: data hygiene — indexes for hot list queries + housekeeping notes.
--
-- These back queries that grew real over Phases S/Y:
--   * the customer garage lists favorites / saved searches per customer, newest
--     first → composite (customer_id, created_at DESC) beats the single-column
--     idx that only helps the equality, not the ORDER BY.
--   * the admin dashboard + pipeline filter inquiries to the OPEN set (status
--     <> 'closed') ordered by recency → a partial index keeps it small (closed
--     rows accumulate forever and don't belong in the hot path).
--
-- All IF NOT EXISTS so this is safe to re-apply. The single-column predecessors
-- (idx_favorites_customer_id, idx_saved_searches_customer_id from 019) are left
-- in place — Postgres picks whichever is cheaper and they're tiny.

CREATE INDEX IF NOT EXISTS idx_favorites_customer_created
  ON public.favorites (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_searches_customer_created
  ON public.saved_searches (customer_id, created_at DESC);

-- Open-inquiry hot path (dashboard "needs attention", pipeline kanban).
CREATE INDEX IF NOT EXISTS idx_inquiries_open_status
  ON public.inquiries (status, created_at DESC)
  WHERE status <> 'closed';

-- reviews.car_id backfill: intentionally NOT automated. The only signal is the
-- free-text `car_description`, which is too noisy to map to a car_id reliably
-- (e.g. "BYD" vs "BYD Song Plus 2024"). The column stays NULL until an admin
-- links a review to a car in /admin/reviews (migration 015 added the FK + the
-- dropdown). Per-car AggregateRating (Phase Y4) simply ignores unlinked reviews.

-- otp_codes cleanup is handled by the scheduled job /api/cron/otp-cleanup
-- (deletes consumed or expired rows) rather than a DB trigger, so it stays
-- observable and rate-bounded like the other cron sweeps.

-- ─── 024_preorders.sql ───────────────────────────────────────────
-- Phase W: made-to-order / pre-orders.
--
-- The dealer is an importer: most demand is for configurations that are NOT
-- physically in stock ("bring me a white BYD Song Plus, top trim, 6–8 weeks").
-- `model_catalog` is the MENU of importable models — distinct from the physical
-- `cars` table (which only holds units the dealer actually has). A pre-order
-- reuses the existing orders + order_events timeline and the Payme deposit, so
-- the customer tracks an import exactly like a stock reservation.
--
-- Pre-orders start at status 'ordered' (same as a reservation), so the whole
-- 7-step /track timeline and the Payme deposit→deposit_paid advance work
-- unchanged. We intentionally do NOT add an `incoming` cars.inventory_status:
-- surfacing en-route physical units in the public catalog would mean relaxing
-- the anon SELECT policy (migration 022 pins it to is_available = true), and
-- pre-orders don't need it — they're driven entirely by model_catalog. Stock
-- semantics stay untouched.

-- 1. model_catalog: what the dealer can import. Public read only when orderable
--    (mirrors the cars available-only policy); writes are service-role only.
CREATE TABLE IF NOT EXISTS public.model_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  trims TEXT[] NOT NULL DEFAULT '{}',
  body_type TEXT,
  fuel_type TEXT,
  year INTEGER,
  base_price_usd NUMERIC(12, 2),
  lead_time_weeks_min INTEGER NOT NULL DEFAULT 6,
  lead_time_weeks_max INTEGER NOT NULL DEFAULT 8,
  available_colors TEXT[] NOT NULL DEFAULT '{}',
  thumbnail TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  description_ru TEXT,
  description_uz TEXT,
  description_en TEXT,
  is_orderable BOOLEAN NOT NULL DEFAULT false,
  order_position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.model_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view orderable models" ON public.model_catalog;
CREATE POLICY "Anyone can view orderable models" ON public.model_catalog
  FOR SELECT USING (is_orderable = true);
-- No INSERT/UPDATE/DELETE policy: only the service-role client may write.

CREATE INDEX IF NOT EXISTS idx_model_catalog_orderable
  ON public.model_catalog (is_orderable, order_position) WHERE is_orderable = true;
CREATE INDEX IF NOT EXISTS idx_model_catalog_brand ON public.model_catalog (brand);

-- 2. orders: pre-order columns. model_id links the chosen menu entry; config
--    captures trim/color/options as jsonb; quoted_lead_time_weeks pins the ETA
--    shown at order time so a later catalog edit can't silently change the
--    promise the customer was given.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES public.model_catalog(id) ON DELETE SET NULL;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quoted_lead_time_weeks TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_model_id ON public.orders (model_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_preorder
  ON public.orders (is_preorder) WHERE is_preorder = true;

-- ─── 025_payment_provider.sql ───────────────────────────────────────────
-- Phase X1: a second online-deposit rail (Click.uz) alongside Payme.
--
-- The payments table (020) was Payme-only: one NOT NULL UNIQUE payme_transaction_id
-- per row, which was the idempotency guard. To add Click without forking the
-- table we generalise:
--   * `provider` tags each row ('payme' | 'click' | 'uzum').
--   * `provider_transaction_id` holds the rail's own transaction id; a per-provider
--     UNIQUE index on (provider, provider_transaction_id) is the new idempotency
--     guard, so a re-sent Click callback resolves to the same row.
-- payme_transaction_id is kept (its existing UNIQUE still backstops the live Payme
-- route, which is left untouched); we only drop its NOT NULL so Click rows — which
-- have no Payme id — can be inserted. Postgres treats NULLs as distinct in a UNIQUE
-- index, so neither index conflicts.
--
-- SERVICE-ROLE-ONLY: payments keeps RLS-enabled / no-policies from 020.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'payme';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

-- Backfill the generic id from the historical Payme-only column.
UPDATE public.payments
  SET provider_transaction_id = payme_transaction_id
  WHERE provider_transaction_id IS NULL AND payme_transaction_id IS NOT NULL;

-- Click rows carry no Payme id — relax the NOT NULL (the UNIQUE stays; multiple
-- NULLs are allowed and don't collide).
ALTER TABLE public.payments
  ALTER COLUMN payme_transaction_id DROP NOT NULL;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_provider_check CHECK (provider IN ('payme', 'click', 'uzum'));

-- Per-provider idempotency guard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_tx
  ON public.payments (provider, provider_transaction_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments (provider);

-- ─── 026_saved_search_alerts.sql ───────────────────────────────────────────
-- Phase X3: saved-search match alerts.
--
-- Until now the retention loop only fired on price drops (price_watches). A
-- customer who saved a search ("BYD SUV under $30k") was never told when a NEW
-- car matching it arrived. This adds the bookkeeping column the cron sweep uses
-- to remember when each saved search was last alerted, so a daily job can notify
-- the customer about cars created since then — exactly once per arrival.
--
-- last_alerted_at NULL means "never alerted"; the sweep treats the search's own
-- created_at as the watermark on the first run so it doesn't blast the customer
-- with the entire back-catalogue.

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ;

-- The sweep scans every saved search and orders by oldest-alerted first so a
-- per-run cap is fair (no search is starved). A plain index on the watermark
-- keeps that ordering cheap as the table grows.
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_alerted_at
  ON public.saved_searches (last_alerted_at NULLS FIRST);

-- ─── 027_review_requests.sql ───────────────────────────────────────────
-- Phase Y4: post-delivery review requests.
--
-- When an order reaches 'delivered', a cron (src/app/api/cron/review-requests)
-- waits N days and then emails/SMSes the customer a one-tap review link
-- prefilled with the car they bought (closes migration 015's reviews.car_id —
-- the per-car AggregateRating that lights up ★ stars in search results).
--
-- review_requested_at is the dedupe stamp: NULL means "delivered but not yet
-- asked"; once set, the customer is never asked again for that order.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;

-- The cron scans delivered orders that haven't been asked yet; a partial index
-- keeps that scan cheap as the orders table grows.
CREATE INDEX IF NOT EXISTS idx_orders_review_pending
  ON public.orders (status)
  WHERE review_requested_at IS NULL;

-- ─── 028_reservation_recovery.sql ───────────────────────────────────────────
-- Phase: abandoned-reservation recovery.
--
-- A stock reservation flips a car to 'reserved' and opens an order at 'ordered'
-- (unpaid). If the customer never pays the deposit, the car stays locked
-- forever, the sale dies silently, and live inventory is hidden from everyone
-- else. These columns let a cron (api/cron/reservation-recovery) nudge the
-- customer once after a delay, then auto-release the car back to 'available'
-- and lapse the order if still unpaid.
--
-- We deliberately do NOT add a 'cancelled' order status (which would mean
-- touching the 7-status CHECK, the order-status state machine, and the /track
-- timeline). released_at is a terminal stamp the recovery scan filters on.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- Keeps the recovery scan cheap: only unpaid, not-yet-released reservations.
CREATE INDEX IF NOT EXISTS idx_orders_recovery
  ON public.orders (created_at)
  WHERE status = 'ordered' AND released_at IS NULL;

-- ─── 029_car_cost.sql ───────────────────────────────────────────
-- Phase: per-car profit ledger.
--
-- Purchase cost (USD) the dealer paid, kept in a SEPARATE service-role-only
-- table — never a column on public.cars, because the public car routes select
-- '*' on the anon client and a cost column would leak the dealer's margins to
-- anyone. Mirrors the locked-down inquiries/orders/payments pattern: RLS on,
-- no policies, so only the service-role client can read or write it.
CREATE TABLE IF NOT EXISTS public.car_costs (
  car_id UUID PRIMARY KEY REFERENCES public.cars(id) ON DELETE CASCADE,
  cost_usd NUMERIC NOT NULL CHECK (cost_usd >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.car_costs ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

-- ─── 030_lead_nurture.sql ───────────────────────────────────────────
-- Phase: cold-lead nurture automation.
--
-- Dedupe stamp so the nurture cron (api/cron/lead-nurture) follows up with an
-- unworked lead exactly once, after a delay, instead of re-mailing every run.
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS nurtured_at TIMESTAMPTZ;

-- Cheap scan for the nurture cron: new, not-yet-nurtured leads.
CREATE INDEX IF NOT EXISTS idx_inquiries_nurture
  ON public.inquiries (created_at)
  WHERE status = 'new' AND nurtured_at IS NULL;

-- ─── 031_purchase_orders.sql ───────────────────────────────────────────
-- Phase: procurement / buy-side tracking.
--
-- The supplier side of the importer the system was missing: when demand says
-- "import these", the dealer records a purchase order to a Chinese supplier and
-- tracks it from draft → ordered → in_production → shipped → arrived. Distinct
-- from public.orders (which is the CUSTOMER's order). Service-role only — this
-- is internal procurement + cost data, never public.
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  year INTEGER,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty >= 1),
  unit_cost_usd NUMERIC CHECK (unit_cost_usd IS NULL OR unit_cost_usd >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'ordered', 'in_production', 'shipped', 'arrived', 'cancelled')
  ),
  eta_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON public.purchase_orders (created_at DESC);

-- ─── 032_cron_runs.sql ───────────────────────────────────────────
-- Phase: automation observability (autopilot command-center).
--
-- One row per scheduled-job completion so the dealer can see the automation's
-- heartbeat — which jobs ran, when, and with what result. Written best-effort
-- by logEvent() on any "cron.*" event. Service-role only.
CREATE TABLE IF NOT EXISTS public.cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON public.cron_runs (job, created_at DESC);

-- ─── 033_resync_uzs.sql ───────────────────────────────────────────
-- Phase: FX-driven UZS auto-reprice.
--
-- The rates cron refreshes USD/UZS daily; this function lets it re-sync every
-- car's stored price_uzs in one bulk statement so the displayed sum prices
-- never drift from the live rate. Called via rpc() by the service-role cron.
CREATE OR REPLACE FUNCTION public.resync_car_uzs(p_rate NUMERIC)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF p_rate IS NULL OR p_rate <= 0 THEN
    RETURN 0;
  END IF;
  UPDATE public.cars
    SET price_uzs = ROUND(price_usd * p_rate), updated_at = now()
    WHERE price_usd IS NOT NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ─── 034_lifecycle.sql ───────────────────────────────────────────
-- Phase: lifecycle automation (service reminders + multi-step nurture).
--
-- service_reminded_at: dedupe stamp so a delivered customer gets a single
--   maintenance/cross-sell reminder, months after delivery.
-- nurture_step: which step of the cold-lead drip a lead has received (0 = none),
--   so the nurture cron can send an escalating 3-touch sequence instead of one.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_reminded_at TIMESTAMPTZ;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS nurture_step INTEGER NOT NULL DEFAULT 0;

-- ─── 035_assistant_threads.sql ───────────────────────────────────────────
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

-- ─── 036_error_events.sql ───────────────────────────────────────────
-- Phase: observability — in-house error log.
--
-- Server errors are fail-open by design (they never break the request) and
-- alert the dealer via Telegram/email, but they were otherwise only a console
-- line nobody re-reads on a Worker. logEvent now also persists every error-level
-- event here, giving an in-house, queryable error feed (admin → Errors) without
-- a third-party APM. Service-role only.
CREATE TABLE IF NOT EXISTS public.error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_error_events_created_at ON public.error_events (created_at DESC);

-- ─── 037_winback.sql ───────────────────────────────────────────
-- Phase: dormant-customer win-back.
--
-- Dedupe stamp so a past buyer gets a single re-engagement email a year or so
-- after delivery (repeat purchase / trade-in / referral). Service-role table.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS winback_sent_at TIMESTAMPTZ;

-- ─── 038_supplier_phone.sql ───────────────────────────────────────────
-- Phase: supplier WhatsApp messaging.
--
-- Supplier WhatsApp number on the purchase order, so the AI-drafted RFQ /
-- follow-up can be sent with a one-tap wa.me link. Service-role table.
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_phone TEXT;

-- ─── 039_import_config.sql ───────────────────────────────────────────
-- Phase: import-economics engine.
--
-- Editable landed-cost assumptions (duty/excise/VAT by fuel, flat fees, target
-- margin) live in their own site_settings row so the admin "Save settings" —
-- which replaces the 'singleton' row — can't clobber them, mirroring 'fx_rate'.
-- These are the dealer's working assumptions, not legal rates; public read is
-- harmless, writes are service-role only.
ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_id_check;
ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_id_check CHECK (id IN ('singleton', 'fx_rate', 'import_config'));

INSERT INTO public.site_settings (id, values)
VALUES ('import_config', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ─── 040_assistant_conversations.sql ───────────────────────────────────────────
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

-- ─── 041_market_listings.sql ───────────────────────────────────────────
-- Phase: market price intelligence.
--
-- Observed competitor/market listings (from OLX, Telegram car channels, or
-- manual/AI-parsed entry) used to (a) quote competitively and (b) rank which
-- models are most profitable to import (market price − landed cost). Prices are
-- normalized to USD on ingest (raw kept for audit). Internal pricing data —
-- service-role only (RLS on, no policies), mirroring car_costs/inquiries.
CREATE TABLE IF NOT EXISTS public.market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('olx', 'telegram', 'manual', 'other')),
  source_ref TEXT,                       -- listing URL / channel:msg id
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  mileage_km INTEGER,
  price_usd NUMERIC,                     -- normalized
  price_raw NUMERIC,                     -- as observed
  currency_raw TEXT,                     -- 'UZS' | 'USD' | …
  condition TEXT,                        -- 'new' | 'used'
  city TEXT,
  posted_at TIMESTAMPTZ,                 -- when the listing was posted (if known)
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_text TEXT,
  fingerprint TEXT UNIQUE,               -- dedupe across re-scrapes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_listings_model ON public.market_listings (brand, model, year);
CREATE INDEX IF NOT EXISTS idx_market_listings_observed ON public.market_listings (observed_at DESC);

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

-- ─── 042_crm_tasks.sql ───────────────────────────────────────────
-- Phase: CRM sales tasks & follow-up engine.
--
-- A per-salesperson task queue. Tasks are created manually OR auto-generated by
-- /api/cron/generate-tasks from signals that need a human touch (stale new
-- leads, abandoned deposits, hot AI handoffs, due follow-up dates). Linked to
-- the Customer 360 by the 9-digit phone core. Service-role only (RLS on, no
-- policies), mirroring inquiries/orders.
CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'manual'
    CHECK (kind IN ('follow_up', 'call', 'message', 'stale_lead', 'abandoned_deposit', 'handoff', 'review', 'manual')),
  customer_key TEXT,            -- 9-digit phone core → Customer 360
  customer_phone TEXT,
  customer_name TEXT,
  inquiry_id UUID,
  order_id UUID,
  thread_id TEXT,
  assigned_to UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'snoozed')),
  notes TEXT,
  auto_source TEXT,             -- dedupe key for auto-generated tasks
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- One open task per auto-source (so the cron is idempotent).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_crm_tasks_auto_source
  ON public.crm_tasks (auto_source) WHERE auto_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_queue ON public.crm_tasks (status, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assignee ON public.crm_tasks (assigned_to, status);

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

-- ─── 043_campaigns.sql ───────────────────────────────────────────
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

-- ─── 044_shipments.sql ───────────────────────────────────────────
-- Phase: shipment & logistics command center.
--
-- Tracks an imported batch from supplier payment → shipping → customs → arrival
-- → delivery, with a milestone timeline and attached documents. Optionally
-- linked to a purchase_order. Service-role only (RLS on, no policies).
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  supplier TEXT,
  mode TEXT NOT NULL DEFAULT 'rail' CHECK (mode IN ('sea', 'rail', 'road', 'air', 'multimodal')),
  container_no TEXT,
  origin TEXT,
  destination TEXT DEFAULT 'Tashkent',
  qty INTEGER,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'supplier_paid', 'in_production', 'shipped',
    'in_transit', 'at_customs', 'cleared', 'arrived', 'delivered'
  )),
  eta_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only milestone timeline (mirrors order_events).
CREATE TABLE IF NOT EXISTS public.shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents attached to a shipment (invoice, customs declaration, etc.).
CREATE TABLE IF NOT EXISTS public.shipment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN (
    'invoice', 'packing_list', 'bill_of_lading', 'customs_declaration', 'certificate', 'other'
  )),
  url TEXT NOT NULL,
  filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments (status, eta_date);
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON public.shipment_events (shipment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_shipment ON public.shipment_documents (shipment_id);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_documents ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

-- ─── 045_finance.sql ───────────────────────────────────────────
-- Phase: financial back-office.
--
-- Customer invoices (with VAT/QQS) and multi-currency expenses (incl. CNY
-- supplier payments, normalized to USD on entry). Feeds the P&L + VAT report.
-- Service-role only (RLS on, no policies) — money data.
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
  vat_pct NUMERIC(5, 2) NOT NULL DEFAULT 12,
  vat_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  issued_at DATE NOT NULL DEFAULT (now()::date),
  due_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'supplier_payment', 'freight', 'customs', 'logistics', 'certification',
    'marketing', 'salary', 'office', 'other'
  )),
  description TEXT,
  amount NUMERIC(16, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'UZS', 'CNY')),
  amount_usd NUMERIC(14, 2) NOT NULL,        -- normalized at entry time
  supplier TEXT,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  spent_on DATE NOT NULL DEFAULT (now()::date),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_period ON public.expenses (spent_on DESC, category);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

