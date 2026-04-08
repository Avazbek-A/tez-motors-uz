-- Cars table
CREATE TABLE IF NOT EXISTS cars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  price_usd INTEGER NOT NULL,
  price_uzs BIGINT,
  body_type TEXT NOT NULL DEFAULT 'suv',
  fuel_type TEXT NOT NULL DEFAULT 'petrol',
  engine_volume NUMERIC(3,1),
  engine_power INTEGER,
  transmission TEXT NOT NULL DEFAULT 'automatic',
  drivetrain TEXT,
  mileage INTEGER DEFAULT 0,
  color TEXT,
  description_ru TEXT,
  description_uz TEXT,
  description_en TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  thumbnail TEXT,
  is_hot_offer BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  order_position INTEGER DEFAULT 0,
  specs JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cars_brand ON cars(brand);
CREATE INDEX IF NOT EXISTS idx_cars_body_type ON cars(body_type);
CREATE INDEX IF NOT EXISTS idx_cars_fuel_type ON cars(fuel_type);
CREATE INDEX IF NOT EXISTS idx_cars_price ON cars(price_usd);
CREATE INDEX IF NOT EXISTS idx_cars_is_hot ON cars(is_hot_offer) WHERE is_hot_offer = true;
CREATE INDEX IF NOT EXISTS idx_cars_available ON cars(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_cars_slug ON cars(slug);

-- Enable RLS
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;

-- Anonymous can read available cars
CREATE POLICY "Anyone can view available cars" ON cars
  FOR SELECT USING (is_available = true);

-- Inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'general',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT,
  car_id UUID REFERENCES cars(id),
  source_page TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an inquiry
CREATE POLICY "Anyone can submit inquiries" ON inquiries
  FOR INSERT WITH CHECK (true);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  car_description TEXT,
  review_text_ru TEXT,
  review_text_uz TEXT,
  review_text_en TEXT,
  photo_url TEXT,
  video_url TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_published BOOLEAN DEFAULT false,
  order_position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published reviews" ON reviews
  FOR SELECT USING (is_published = true);

-- FAQs table
CREATE TABLE IF NOT EXISTS faqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_ru TEXT NOT NULL,
  question_uz TEXT NOT NULL,
  question_en TEXT NOT NULL,
  answer_ru TEXT NOT NULL,
  answer_uz TEXT NOT NULL,
  answer_en TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  order_position INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published faqs" ON faqs
  FOR SELECT USING (is_published = true);
