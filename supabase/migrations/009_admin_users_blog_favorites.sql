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
