-- LIVE FEED + SPEED
-- 1) Publish listing changes over Realtime, so when a host pauses/resumes an event (or it fills up) every guest's feed
--    updates by itself. Realtime applies the same row-level security, so guests only receive rows they may read.
-- 2) Indexes for the host's own lookups (their events, and their host days by date).

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'listings') then
    alter publication supabase_realtime add table public.listings;
  end if;
end $$;

create index if not exists listings_cook_idx on public.listings (cook_id);
create index if not exists cook_sessions_cook_date_idx on public.cook_sessions (cook_id, session_date);
