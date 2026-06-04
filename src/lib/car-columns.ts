/**
 * The columns of `public.cars` that are SAFE to expose to anonymous callers.
 *
 * Background: the cars table is intentionally marketing-only (sensitive money
 * lives in separate tables: car_costs, payments, purchase_orders, …). But our
 * public list/detail routes used to read `select("*")`, which means any future
 * "tiny internal column I'll add real quick" silently leaks through the public
 * API. This constant gives ONE place to decide what we're willing to publish;
 * routes use it; anything new is opt-in.
 *
 * Keep in sync with `Car` in src/types/car.ts.
 */
export const PUBLIC_CAR_COLUMNS = [
  "id",
  "slug",
  "brand",
  "model",
  "year",
  "price_usd",
  "original_price_usd",
  "price_uzs",
  "body_type",
  "fuel_type",
  "engine_volume",
  "engine_power",
  "transmission",
  "drivetrain",
  "mileage",
  "listing_type",
  "vin",
  "owners_count",
  "accident_free",
  "condition_grade",
  "color",
  "description_ru",
  "description_uz",
  "description_en",
  "images",
  "thumbnail",
  "video_url",
  "is_hot_offer",
  "is_available",
  "inventory_status",
  "order_position",
  "specs",
  "spec_data",
  "spec_captured_at",
  "created_at",
  "updated_at",
].join(", ");
