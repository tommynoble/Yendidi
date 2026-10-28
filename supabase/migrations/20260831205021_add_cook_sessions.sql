-- Cook scheduling: a cook commits to a fixed weekly cadence (2 cooking
-- sessions/week, >=2 days apart) instead of posting listings whenever.
-- A "pot" listing optionally attaches to one of these scheduled sessions,
-- which drives the countdown display and the seat-capacity deadline
-- (order_deadline auto-set to the session's start time). Gap/day-count
-- rules are enforced in app code, not DB constraints, since they depend
-- on comparing against a cook's other upcoming sessions.

create table if not exists public.cook_sessions (
  id uuid default gen_random_uuid() primary key,
  cook_id uuid references public.profiles(id) on delete cascade not null,
  session_date date not null,
  start_time time not null,
  created_at timestamptz default timezone('utc'::text, now())
);

alter table public.cook_sessions enable row level security;

create policy "Everyone view" on public.cook_sessions for select using (true);
create policy "Approved cooks manage own" on public.cook_sessions for all
  using (auth.uid() = cook_id)
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and role = 'COOK' and cook_application_status = 'approved'
  ));

alter table public.listings
  add column if not exists session_id uuid references public.cook_sessions(id) on delete set null;
