export interface Car {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  price_usd: number;
  original_price_usd?: number | null;
  price_uzs: number | null;
  body_type: "sedan" | "suv" | "crossover" | "hatchback" | "minivan" | "coupe";
  fuel_type: "petrol" | "electric" | "hybrid" | "phev";
  engine_volume: number | null;
  engine_power: number | null;
  transmission: "automatic" | "manual" | "cvt" | "robot" | "dct";
  drivetrain: "fwd" | "rwd" | "awd" | null;
  mileage: number;
  color: string | null;
  description_ru: string | null;
  description_uz: string | null;
  description_en: string | null;
  images: string[];
  thumbnail: string | null;
  video_url?: string | null;
  is_hot_offer: boolean;
  is_available: boolean;
  inventory_status?: "available" | "reserved" | "sold";
  listing_type?: "new" | "used";
  vin?: string | null;
  owners_count?: number | null;
  accident_free?: boolean | null;
  condition_grade?: "excellent" | "good" | "fair" | null;
  order_position: number;
  specs: Record<string, string | number>;
  spec_data?: import("@/lib/autohome-spec").SpecData | null;
  created_at: string;
  updated_at: string;
  /** Per-car review aggregates (attached by /api/cars for ★ on tiles). */
  review_avg?: number;
  review_count?: number;
}

export interface CarFilters {
  brand?: string;
  body_type?: string;
  fuel_type?: string;
  price_min?: number;
  price_max?: number;
  /** Max monthly installment budget (USD); inverted to a price ceiling server-side. */
  monthly_max?: number;
  year_min?: number;
  year_max?: number;
  /** 'new' | 'used' — the used-car section pins this to 'used'. */
  listing_type?: string;
  /** Max mileage (km) — used-car filter. */
  mileage_max?: number;
  search?: string;
}

export interface Inquiry {
  id: string;
  type: "general" | "car_inquiry" | "callback" | "calculator" | "reservation" | "test_drive" | "trade_in" | "newsletter" | "price_drop" | "service" | "part_inquiry";
  name: string;
  phone: string;
  email?: string;
  message?: string;
  car_id?: string;
  source_page: string;
  metadata: Record<string, unknown>;
  status: "new" | "contacted" | "in_progress" | "closed";
  notes?: string | null;
  follow_up_date?: string | null;
  assigned_to?: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  client_name: string;
  car_description: string | null;
  review_text_ru: string | null;
  review_text_uz: string | null;
  review_text_en: string | null;
  photo_url: string | null;
  video_url: string | null;
  rating: number;
  is_published: boolean;
  order_position: number;
  created_at: string;
  car_id: string | null;
}

export interface FAQ {
  id: string;
  question_ru: string;
  question_uz: string;
  question_en: string;
  answer_ru: string;
  answer_uz: string;
  answer_en: string;
  category: string;
  order_position: number;
  is_published: boolean;
}

export interface BlogPost {
  id: string;
  slug: string;
  title_ru: string;
  title_uz: string | null;
  title_en: string | null;
  body_ru: string;
  body_uz: string | null;
  body_en: string | null;
  cover_image: string | null;
  published_at: string | null;
  author_id: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}
