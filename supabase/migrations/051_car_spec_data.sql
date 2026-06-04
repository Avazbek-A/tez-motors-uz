-- Phase AD: AutoHome spec sheets.
--
-- Rich, multi-trim parameter configuration captured from an AutoHome model page
-- (clean global.autohome.com JSON, or — for obfuscated CN pages — a Playwright
-- screenshot read by a vision LLM). Powers the public spec page + downloadable
-- PDF. Distinct from the simple `specs` jsonb (a flat display grid) which stays
-- as-is. Shape:
--   { source, source_url, captured_at, brand, model, groups:[...],
--     trims:[{ name, price_raw, year, params:{ group:{ paramName:value } } }],
--     gallery:[storageUrls], colors:[...] }
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS spec_data JSONB;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS spec_captured_at TIMESTAMPTZ;

-- Marketing data (no PII); the existing public car SELECT policy already covers
-- new columns. Writes are service-role only via the admin import route.
