-- 078 was ineffective: a TABLE-level SELECT grant (Supabase grants it to anon by
-- default) overrides a column-level REVOKE, so anon could still read every column.
-- The correct pattern is to drop the table grant and re-grant ONLY the public
-- columns — then the private pricing-engine inputs (import_channel/battery_soh_pct/
-- in_service_date) are simply not selectable by anon/authenticated. The server reads
-- them via service_role, which is unaffected by these grants.
--
-- The granted set == PUBLIC_CAR_COLUMNS (src/lib/car-columns.ts). Every anon/
-- authenticated cars query selects a subset of these (verified: catalog, feeds,
-- detail, recommended, sitemap, track, inquiry, pdf). KEEP THE TWO IN SYNC: if a new
-- public column is added to PUBLIC_CAR_COLUMNS, add it here too.
REVOKE SELECT ON public.cars FROM anon, authenticated;

GRANT SELECT (
  id, slug, brand, model, year, price_usd, original_price_usd, price_uzs,
  body_type, fuel_type, engine_volume, engine_power, transmission, drivetrain,
  mileage, listing_type, vin, owners_count, accident_free, condition_grade, color,
  description_ru, description_uz, description_en, images, thumbnail, video_url,
  is_hot_offer, is_available, inventory_status, in_stock, order_position,
  specs, spec_data, spec_captured_at, created_at, updated_at
) ON public.cars TO anon, authenticated;
