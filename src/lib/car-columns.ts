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
const ALL_PUBLIC_CAR_COLUMNS = [
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
  "seats",
  "range_km",
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
  "in_stock",
  "order_position",
  "specs",
  "spec_data",
  "spec_captured_at",
  "created_at",
  "updated_at",
];

export const PUBLIC_CAR_COLUMNS = ALL_PUBLIC_CAR_COLUMNS.join(", ");

/**
 * Heavy, DETAIL-ONLY columns the catalog list/cards never render: the full
 * AutoHome `spec_data` jsonb (often 20–100KB+ per car — it embeds video
 * transcripts), the legacy `specs` provenance blob, the long localized
 * descriptions, and the video URL. Excluding them from the list query shrinks
 * the server-rendered catalog payload ~10× (it was ~2MB of inline RSC for 24
 * cards). The detail page + /api/cars/[id] still select the full
 * PUBLIC_CAR_COLUMNS. Card field needs verified against car-card.tsx.
 */
const LIST_EXCLUDED_COLUMNS = new Set([
  "spec_data",
  "specs",
  "description_ru",
  "description_uz",
  "description_en",
  "video_url",
  "spec_captured_at",
]);

export const PUBLIC_CAR_LIST_COLUMNS = ALL_PUBLIC_CAR_COLUMNS.filter(
  (c) => !LIST_EXCLUDED_COLUMNS.has(c),
).join(", ");
