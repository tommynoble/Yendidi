-- GUEST TASTE PROFILE
-- Answers from the sign-up questions, split by who may see them:
--   * taste_profile (public): cravings, table vibe, who they like to eat with, travel. Lives on profiles, which is already
--     readable by everyone, so other guests and hosts can see it on a guest's profile card.
--   * guest_dietary (private): allergies and dietary needs. Only the guest and hosts they have an order with can read it.

alter table public.profiles
  add column if not exists taste_profile jsonb not null default '{}'::jsonb;

create table if not exists public.guest_dietary (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  needs text[] not null default '{}',
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.guest_dietary enable row level security;

-- The guest manages their own row.
create policy "Guests manage their own dietary needs"
  on public.guest_dietary for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A host can read the dietary needs of guests who have an (uncancelled) order with them.
create policy "Hosts read dietary needs of their guests"
  on public.guest_dietary for select
  using (
    exists (
      select 1 from public.orders o
      where o.user_id = guest_dietary.user_id
        and o.cook_id = auth.uid()
        and o.status <> 'Cancelled'
    )
  );
