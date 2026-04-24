export type PartCategory =
  | "engine"
  | "body"
  | "electrical"
  | "suspension"
  | "brakes"
  | "interior"
  | "other";

export interface Part {
  id: string;
  slug: string;
  oem_number: string | null;
  name_ru: string;
  name_uz: string | null;
  name_en: string | null;
  description_ru: string | null;
  description_uz: string | null;
  description_en: string | null;
  category: PartCategory;
  brand: string | null;
  price_usd: number | null;
  original_price_usd: number | null;
  wholesale_price_usd: number | null;
  min_order_qty: number;
  stock_qty: number;
  images: string[];
  is_published: boolean;
  fits_brands: string[];
  fits_models: string[];
  fits_year_from: number | null;
  fits_year_to: number | null;
  order_position: number;
  created_at: string;
  updated_at: string;
}
