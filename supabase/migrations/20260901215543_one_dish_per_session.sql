-- Enforce "one dish per cook day" at the database level, not just in app
-- code. A partial unique index (only applies where session_id is set)
-- guarantees no two listings can ever attach to the same cook_sessions row,
-- even under a race or a client bypassing the app-level check.

create unique index if not exists listings_one_dish_per_session
  on public.listings (session_id)
  where session_id is not null;
