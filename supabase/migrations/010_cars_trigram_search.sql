-- Fuzzy search for cars + foundation for parts catalog (Phase J).
-- Enables Postgres trigram similarity so that "byd" matches "BYD Song Plus"
-- and typos like "tiggo" still find "Tiggo 8 Pro".

create extension if not exists pg_trgm;

-- Functional GIN index on brand+model+description used by /api/cars search.
create index if not exists cars_search_trgm_idx
  on public.cars
  using gin (
    (
      coalesce(brand, '') || ' ' ||
      coalesce(model, '') || ' ' ||
      coalesce(description_ru, '')
    ) gin_trgm_ops
  );

-- Optional: set a lower default similarity threshold for this schema so
-- short queries like "byd" still match. The API uses the `%` operator which
-- honors this threshold.
-- pg_trgm default is 0.3; 0.2 lets 3-letter prefixes work.
-- This is a session-level setting normally; the API sets it explicitly.
