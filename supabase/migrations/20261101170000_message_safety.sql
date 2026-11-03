-- MESSAGE SAFETY: block + report users, and hide social handles.
-- Run once in the Supabase SQL editor (the function at the bottom is safe to re-run).

-- Who has blocked whom. Only the blocker can see or change their own blocks.
create table public.user_blocks (
  blocker_id uuid references public.profiles(id) on delete cascade not null,
  blocked_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

create policy "Users can view their own blocks"
  on public.user_blocks for select using (auth.uid() = blocker_id);
create policy "Users can block people"
  on public.user_blocks for insert with check (auth.uid() = blocker_id);
create policy "Users can unblock people"
  on public.user_blocks for delete using (auth.uid() = blocker_id);

-- Reports from the chat screen. Reporters can add and see their own; you review them in the Supabase table editor.
create table public.message_reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  reported_id uuid references public.profiles(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason text not null check (reason in ('spam_or_scam', 'harassment', 'inappropriate', 'off_platform_contact', 'other')),
  details text check (char_length(details) <= 1000),
  status text default 'open' not null check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  check (reporter_id <> reported_id)
);

alter table public.message_reports enable row level security;

create policy "Users can file reports as themselves"
  on public.message_reports for insert with check (auth.uid() = reporter_id);
create policy "Users can view their own reports"
  on public.message_reports for select using (auth.uid() = reporter_id);

-- Nobody can send a message to someone who blocked them, or after they blocked that person.
-- Named with an "a_" prefix so it runs before the contact-hiding trigger.
create or replace function public.reject_blocked_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = conv.guest_id and b.blocked_id = conv.cook_id)
       or (b.blocker_id = conv.cook_id and b.blocked_id = conv.guest_id)
  ) then
    raise exception 'blocked';
  end if;
  return new;
end;
$$;

create trigger a_reject_blocked_message
  before insert on public.messages
  for each row execute function public.reject_blocked_message();

-- Contact hiding, now also covering social handles ("IG: ama_cooks", "snap - ama", "@ama_cooks").
create or replace function public.mask_message_contacts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations;
  original text := new.body;
  cleaned text := new.body;
begin
  select * into conv from public.conversations where id = new.conversation_id;

  if not public.has_booked_with_host(conv.guest_id, conv.cook_id) then
    -- emails, including "name [at] site dot com" style
    cleaned := regexp_replace(cleaned, '[A-Za-z0-9._%+-]+\s*(@|\[at\]|\(at\))\s*[A-Za-z0-9.-]+\s*(\.|\[dot\]|\(dot\)|\sdot\s)\s*[A-Za-z]{2,}', '[email hidden]', 'gi');
    -- links
    cleaned := regexp_replace(cleaned, '(https?://|www\.)\S+', '[link hidden]', 'gi');
    cleaned := regexp_replace(cleaned, '\y[A-Za-z0-9-]+\.(com|org|net|io|gh|app|link)\y(/\S*)?', '[link hidden]', 'gi');
    cleaned := regexp_replace(cleaned, '\y[A-Za-z0-9-]+\.(me|co|ly)/\S*', '[link hidden]', 'gi');
    -- social handles: "IG: name", "snap - name", "whatsapp: name", and bare "@name"
    cleaned := regexp_replace(cleaned, '\y(ig|insta|instagram|snap|snapchat|tiktok|fb|facebook|telegram|tg|whatsapp|twitter)\y\s*[:\-@]\s*@?[A-Za-z0-9_.]{3,}', '[handle hidden]', 'gi');
    cleaned := regexp_replace(cleaned, '@[A-Za-z][A-Za-z0-9_.]{2,}', '[handle hidden]', 'g');
    -- phone numbers written in words: 7 or more digit words in a row
    cleaned := regexp_replace(cleaned, '(\y(zero|one|two|three|four|five|six|seven|eight|nine)\y[ ,.\-]*){7,}', '[number hidden]', 'gi');
    -- phone numbers: 8+ digits, allowing spaces, dashes, dots and brackets between them
    cleaned := regexp_replace(cleaned, '(\+?\d[ \-.()]*){8,}', '[number hidden]', 'g');
  end if;

  new.body := cleaned;
  new.was_masked := cleaned <> original;
  return new;
end;
$$;
