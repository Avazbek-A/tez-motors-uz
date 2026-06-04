export interface Scooter {
  id: string;
  slug: string;
  kind: "escooter" | "ebike";
  brand: string;
  model: string;
  description_ru: string | null;
  description_uz: string | null;
  description_en: string | null;
  price_usd: number | null;
  original_price_usd: number | null;
  price_uzs: number | null;
  motor_power_w: number | null;
  battery_wh: number | null;
  range_km: number | null;
  top_speed_kmh: number | null;
  max_load_kg: number | null;
  weight_kg: number | null;
  wheel_size_inch: number | null;
  foldable: boolean | null;
  color: string | null;
  images: string[];
  stock_qty: number;
  is_published: boolean;
  order_position: number;
  created_at: string;
  updated_at: string;
}
