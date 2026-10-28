-- Bring "Join the Pot" batch-ordering concept into the regular listings/orders
-- flow instead of the separate, disconnected meal_sessions/meal_reservations
-- tables (which never wrote to `orders`, so pot reservations had no payment,
-- tracking, or review linkage). This is additive only — existing rows and the
-- old tables are untouched.

alter table public.listings
  add column if not exists min_orders_required int not null default 1 check (min_orders_required > 0),
  add column if not exists order_deadline timestamptz null;
