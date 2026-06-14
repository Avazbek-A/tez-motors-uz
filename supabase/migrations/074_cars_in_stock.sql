-- Reserve eligibility: only cars physically in Tashkent that the dealer can sell
-- immediately should show the public "Reserve" CTA. The catalog is otherwise
-- import-to-order (inventory_status is 'available' for ~all cars, so it can't
-- distinguish them). `in_stock` is an admin-toggled flag, default false → Reserve
-- stays hidden until the dealer marks a car as on-hand.
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT false;

-- Fast lookup of the (small) in-stock set.
CREATE INDEX IF NOT EXISTS cars_in_stock_idx ON public.cars (in_stock) WHERE in_stock;
