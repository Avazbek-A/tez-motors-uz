-- Column-level lockdown of the Phase-5 valuation inputs. RLS gates ROWS, not
-- COLUMNS, and the anon key is public (it ships in the client bundle) — so before
-- this, anyone could GET /rest/v1/cars?select=import_channel directly via PostgREST
-- and read these regardless of the app-layer scrub (scrubCarsForPublic only covers
-- the app's own rendered pages). These columns are internal pricing-engine inputs
-- with no client use; the server reads them via the service_role key, which is NOT
-- affected by column GRANTs. import_channel ('gray') is genuinely sensitive.
--
-- Pre-req (shipped in the same release): the public select('*') pages were switched
-- to PUBLIC_CAR_COLUMNS, which doesn't list these columns — so no anon query
-- requests them anymore and this REVOKE breaks nothing.
REVOKE SELECT (import_channel, battery_soh_pct, in_service_date) ON public.cars FROM anon;
REVOKE SELECT (import_channel, battery_soh_pct, in_service_date) ON public.cars FROM authenticated;
