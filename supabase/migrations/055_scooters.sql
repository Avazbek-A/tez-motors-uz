-- Scooters & e-bikes — a third product vertical alongside cars and parts.
-- Light EVs diverge from cars (motor/battery/range/speed; no fuel/transmission),
-- so a dedicated table cloned from `parts` (011), not the `cars` table. Images
-- reuse the existing public car-images bucket under a scooters/ path prefix.

create table if not exists public.scooters (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null check (kind in ('escooter', 'ebike')),
  brand text not null,
  model text not null,
  description_ru text,
  description_uz text,
  description_en text,
  price_usd numeric,
  original_price_usd numeric,
  price_uzs numeric,
  -- Light-EV spec fields (the point of the separate table).
  motor_power_w integer,
  battery_wh integer,
  range_km integer,
  top_speed_kmh integer,
  max_load_kg integer,
  weight_kg numeric,
  wheel_size_inch numeric,
  foldable boolean,
  color text,
  images text[] not null default '{}',
  stock_qty integer not null default 0,
  is_published boolean not null default false,
  order_position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scooters_kind_idx on public.scooters (kind);
create index if not exists scooters_published_idx on public.scooters (is_published) where is_published;
create index if not exists scooters_search_trgm_idx on public.scooters
  using gin (
    (coalesce(brand, '') || ' ' || coalesce(model, '')) gin_trgm_ops
  );

alter table public.scooters enable row level security;
-- Public reads published rows; writes via service-role only (mirror parts/cars).
drop policy if exists "scooters public read" on public.scooters;
create policy "scooters public read" on public.scooters for select using (is_published);
