-- PUSH TOKENS
-- One row per device. A user can have several (phone + tablet, reinstalls, etc),
-- so this isn't folded into profiles directly.
create table public.push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  token text not null unique,
  platform text default 'ios' check (platform in ('ios', 'android')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.push_tokens enable row level security;

-- Users manage only their own device tokens. The send-push edge function
-- uses the service role key and bypasses RLS entirely to read across users.
create policy "Users can insert their own push tokens"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own push tokens"
  on public.push_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own push tokens"
  on public.push_tokens for delete
  using (auth.uid() = user_id);

create policy "Users can view their own push tokens"
  on public.push_tokens for select
  using (auth.uid() = user_id);
