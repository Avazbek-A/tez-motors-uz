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
