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
