-- HOST PROFILE DETAILS
-- Kitchen story: shown on the host's public profile, so it lives on profiles next to bio.
alter table public.profiles
  add column if not exists kitchen_story text;

-- Emergency contact and kitchen assistant: private. Only the host can read or write their own row, so these phone numbers
-- never reach guests (profiles can be read by guests, so they must not live there).
create table if not exists public.host_contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  emergency_contact text,
  kitchen_assistant text,
  updated_at timestamp with time zone not null default now()
);

alter table public.host_contacts enable row level security;

drop policy if exists "host_contacts_select_own" on public.host_contacts;
create policy "host_contacts_select_own" on public.host_contacts
  for select using (auth.uid() = user_id);

drop policy if exists "host_contacts_insert_own" on public.host_contacts;
create policy "host_contacts_insert_own" on public.host_contacts
  for insert with check (auth.uid() = user_id);

drop policy if exists "host_contacts_update_own" on public.host_contacts;
create policy "host_contacts_update_own" on public.host_contacts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
