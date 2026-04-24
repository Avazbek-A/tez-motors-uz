-- Wholesale pricing tier on parts catalog.
-- Dealer works with two audiences: walk-in retail buyers and garages that
-- reorder in bulk. The retail (price_usd) column already exists; this adds
-- a separate wholesale price plus a minimum-order quantity gate so the
-- public site only reveals the bulk price to logged-in or flagged
-- wholesale visitors.
alter table public.parts
  add column if not exists wholesale_price_usd numeric,
  add column if not exists min_order_qty integer not null default 1;

alter table public.parts
  add constraint parts_min_order_qty_positive check (min_order_qty >= 1);
