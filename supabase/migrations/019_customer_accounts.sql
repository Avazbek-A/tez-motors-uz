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
