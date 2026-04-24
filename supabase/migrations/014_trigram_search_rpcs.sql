-- Typo-tolerant search via pg_trgm similarity.
-- ILIKE already uses trigram GIN indexes for '%q%' patterns, but doesn't
-- tolerate typos ("biyd" → "BYD"). These RPCs use the `%` operator which
-- does — threshold 0.2 for short queries.
--
-- The API calls these to collect matching IDs, then filters the main
-- query by `id in (...)`. This keeps the existing filter composition
-- (brand, price range, category, etc.) working unchanged.

create or replace function public.search_cars_ids(q text, max_results int default 200)
returns table (id uuid, score real)
language sql
stable
as $$
  select
    c.id,
    similarity(
      coalesce(c.brand,'') || ' ' ||
      coalesce(c.model,'') || ' ' ||
      coalesce(c.description_ru,''),
      q
    ) as score
  from public.cars c
  where (
    coalesce(c.brand,'') || ' ' ||
    coalesce(c.model,'') || ' ' ||
    coalesce(c.description_ru,'')
  ) % q
  order by score desc
  limit max_results;
$$;

create or replace function public.search_parts_ids(q text, max_results int default 200)
returns table (id uuid, score real)
language sql
stable
as $$
  select
    p.id,
    greatest(
      similarity(coalesce(p.oem_number,''), q),
      similarity(
        coalesce(p.oem_number,'') || ' ' ||
        p.name_ru || ' ' ||
        coalesce(p.name_en,'') || ' ' ||
        coalesce(p.brand,''),
        q
      )
    ) as score
  from public.parts p
  where
    p.oem_number = q
    or (
      coalesce(p.oem_number,'') || ' ' ||
      p.name_ru || ' ' ||
      coalesce(p.name_en,'') || ' ' ||
      coalesce(p.brand,'')
    ) % q
  order by score desc
  limit max_results;
$$;

-- Allow anon + authenticated to call these read-only.
grant execute on function public.search_cars_ids(text, int) to anon, authenticated;
grant execute on function public.search_parts_ids(text, int) to anon, authenticated;
