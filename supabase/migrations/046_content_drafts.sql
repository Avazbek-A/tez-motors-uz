-- Phase: marketing content studio.
--
-- A library of AI-drafted marketing content (social posts, ad copy, blog
-- articles, promos) so the dealer can save, reuse and track what's published.
-- Service-role only (RLS on, no policies) — internal marketing data.
CREATE TABLE IF NOT EXISTS public.content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'telegram'
    CHECK (kind IN ('telegram', 'instagram', 'facebook', 'ad', 'blog', 'promo')),
  locale TEXT NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru', 'uz', 'en')),
  subject TEXT,
  car_id UUID REFERENCES public.cars(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_channel TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_drafts_created ON public.content_drafts (created_at DESC);

ALTER TABLE public.content_drafts ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.
