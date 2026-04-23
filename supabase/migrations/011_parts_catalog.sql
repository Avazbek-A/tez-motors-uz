-- Phase J: Spare parts catalog — second product vertical alongside cars.
-- Reuses pg_trgm extension from 010. Not polymorphic with cars: schemas differ.

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  oem_number text,
  name_ru text not null,
  name_uz text,
  name_en text,
  description_ru text,
  description_uz text,
  description_en text,
  category text not null check (category in (
    'engine','body','electrical','suspension','brakes','interior','other'
  )),
  brand text,
  price_usd numeric,
  original_price_usd numeric,
  stock_qty integer not null default 0,
  images text[] not null default '{}',
  is_published boolean not null default false,
  fits_brands text[] not null default '{}',
  fits_models text[] not null default '{}',
  fits_year_from integer,
  fits_year_to integer,
  order_position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parts_category_idx on public.parts (category);
create index if not exists parts_published_idx on public.parts (is_published) where is_published;
create index if not exists parts_fits_brands_gin on public.parts using gin (fits_brands);
create index if not exists parts_fits_models_gin on public.parts using gin (fits_models);
create index if not exists parts_oem_idx on public.parts (oem_number) where oem_number is not null;
create index if not exists parts_search_trgm_idx on public.parts
  using gin (
    (
      coalesce(oem_number, '') || ' ' ||
      coalesce(name_ru, '') || ' ' ||
      coalesce(name_en, '') || ' ' ||
      coalesce(brand, '')
    ) gin_trgm_ops
  );

-- Keep updated_at fresh on writes.
create or replace function public.parts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists parts_updated_at on public.parts;
create trigger parts_updated_at
  before update on public.parts
  for each row execute function public.parts_set_updated_at();

-- RLS: public can read published only; writes via service role only.
alter table public.parts enable row level security;

drop policy if exists "parts public read" on public.parts;
create policy "parts public read"
  on public.parts
  for select
  to anon, authenticated
  using (is_published);

-- No insert/update/delete policies → service-role-only writes.

-- Extend inquiries.type check constraint to allow part_inquiry.
-- The existing constraint was created with a name we don't know; drop-by-find.
do $$
declare
  cn text;
begin
  select conname into cn
    from pg_constraint
   where conrelid = 'public.inquiries'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%type%in%';
  if cn is not null then
    execute format('alter table public.inquiries drop constraint %I', cn);
  end if;
end$$;

alter table public.inquiries
  add constraint inquiries_type_check
  check (type in (
    'general','car_inquiry','callback','calculator','reservation',
    'test_drive','trade_in','newsletter','price_drop','service','part_inquiry'
  ));
