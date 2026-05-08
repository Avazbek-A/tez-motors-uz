-- Link reviews to a specific car so each car detail page can show an
-- AggregateRating in its Product schema (rich snippets boost CTR).
-- Existing reviews stay un-linked; admin can backfill via the form.
alter table public.reviews
  add column if not exists car_id uuid references public.cars(id) on delete set null;

create index if not exists idx_reviews_car_id
  on public.reviews(car_id)
  where car_id is not null;
