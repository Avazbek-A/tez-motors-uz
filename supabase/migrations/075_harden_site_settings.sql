-- 075_harden_site_settings.sql
-- Two fixes to the multi-row site_settings table.
--
-- (1) SECURITY — confidential rows were anon-readable.
-- Migration 005 created `site_settings_public_read` as `USING (true)` back when
-- the table only ever held the public 'singleton' row (a CHECK enforced that).
-- Since then 018 added 'fx_rate' and 039 added 'import_config', and the app also
-- stores an 'autopilot' row. import_config holds the dealer's CONFIDENTIAL
-- pricing model (target margin %, per-fuel customs-duty/excise/VAT assumptions,
-- flat landed-cost fees) and autopilot holds internal automation config. With a
-- row-blind `USING (true)` policy, any client can read them directly with the
-- public anon key:
--   GET /rest/v1/site_settings?id=eq.import_config&select=values
-- letting a competitor derive Tez Motors' buy price + markup on every car.
-- Only 'singleton' (public site config) and 'fx_rate' are meant to be public;
-- import_config/autopilot are read server-side via the service-role client
-- (src/lib/autopilot.ts, /api/admin/import-config, /api/admin/buying, the crons),
-- which bypasses RLS — so scoping the anon policy to the two public rows has no
-- product impact.
DROP POLICY IF EXISTS "site_settings_public_read" ON public.site_settings;
CREATE POLICY "site_settings_public_read"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (id IN ('singleton', 'fx_rate'));

-- (2) CORRECTNESS — the id CHECK never allowed 'autopilot'.
-- 039 set CHECK (id IN ('singleton','fx_rate','import_config')), but
-- /api/admin/autopilot-config upserts id='autopilot' (src/lib/autopilot.ts
-- AUTOPILOT_ROW_ID), which violates the constraint, so saving the autopilot /
-- auto-markdown / auto-source config silently fails (the cron then reads no row
-- and falls back to defaults). Allow it.
ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_id_check;
ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_id_check
  CHECK (id IN ('singleton', 'fx_rate', 'import_config', 'autopilot'));
