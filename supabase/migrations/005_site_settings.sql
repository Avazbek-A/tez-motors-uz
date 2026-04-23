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
