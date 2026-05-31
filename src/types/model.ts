/**
 * model_catalog row (Phase W pre-orders). The dealer's MENU of importable
 * configurations — distinct from the physical `cars` table.
 */
export interface ModelCatalog {
  id: string;
  slug: string;
  brand: string;
  model: string;
  trims: string[];
  body_type: string | null;
  fuel_type: string | null;
  year: number | null;
  base_price_usd: number | null;
  lead_time_weeks_min: number;
  lead_time_weeks_max: number;
  available_colors: string[];
  thumbnail: string | null;
  images: string[];
  description_ru: string | null;
  description_uz: string | null;
  description_en: string | null;
  is_orderable: boolean;
  order_position: number;
  created_at: string;
  updated_at: string;
}
