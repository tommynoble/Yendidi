-- MESSAGING
-- One conversation per guest + host pair. Only the two people in it can read or write.
-- Phone numbers, emails and links are hidden in the database itself (not just in the app) until the guest has
-- completed a paid booking with that host, so the rule can't be bypassed by a modified app.

create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  guest_id uuid references public.profiles(id) on delete cascade not null,
  cook_id uuid references public.profiles(id) on delete cascade not null,
  last_message text,
  last_sender_id uuid,
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  guest_last_read_at timestamp with time zone default timezone('utc'::text, now()) not null,
  cook_last_read_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (guest_id, cook_id),
  check (guest_id <> cook_id)
);

create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  body text not null check (char_length(body) between 1 and 2000),
  was_masked boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index conversations_guest_idx on public.conversations (guest_id, last_message_at desc);
create index conversations_cook_idx on public.conversations (cook_id, last_message_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Conversations are created through get_or_create_conversation() and their read markers move through
-- mark_conversation_read(), so there are deliberately no insert/update/delete policies for clients.
create policy "Participants can view their conversations"
  on public.conversations for select
  using (auth.uid() = guest_id or auth.uid() = cook_id);

create policy "Participants can view their messages"
  on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (auth.uid() = c.guest_id or auth.uid() = c.cook_id)
  ));

create policy "Participants can send messages as themselves"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (auth.uid() = c.guest_id or auth.uid() = c.cook_id)
    )
  );

-- True once the guest has a paid, non-cancelled order with this host.
create or replace function public.has_booked_with_host(p_guest uuid, p_cook uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.orders o
    where o.user_id = p_guest
      and o.cook_id = p_cook
      and o.payment_status = 'success'
      and o.status <> 'Cancelled'
  );
$$;

-- Hide contact details before booking.
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
    cleaned := regexp_replace(cleaned, '\y[A-Za-z0-9-]+\.(com|org|net|io|gh|me|co|app|link|ly)\y(/\S*)?', '[link hidden]', 'gi');
    -- phone numbers: 8+ digits, allowing spaces, dashes, dots and brackets between them
    cleaned := regexp_replace(cleaned, '(\+?\d[ \-.()]*){8,}', '[number hidden]', 'g');
  end if;

  new.body := cleaned;
  new.was_masked := cleaned <> original;
  return new;
end;
$$;

create trigger mask_message_contacts_before_insert
  before insert on public.messages
  for each row execute function public.mask_message_contacts();

-- Keep the inbox preview current and mark the sender as caught up.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message = left(new.body, 140),
      last_sender_id = new.sender_id,
      last_message_at = new.created_at,
      guest_last_read_at = case when guest_id = new.sender_id then new.created_at else guest_last_read_at end,
      cook_last_read_at = case when cook_id = new.sender_id then new.created_at else cook_last_read_at end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger touch_conversation_after_insert
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- Guests start a conversation with a host. Returns the existing one if there already is one.
create or replace function public.get_or_create_conversation(p_cook_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if auth.uid() = p_cook_id then
    raise exception 'You cannot message yourself';
  end if;

  select id into conv_id from public.conversations
  where guest_id = auth.uid() and cook_id = p_cook_id;

  if conv_id is null then
    insert into public.conversations (guest_id, cook_id)
    values (auth.uid(), p_cook_id)
    returning id into conv_id;
  end if;

  return conv_id;
end;
$$;

-- Marks everything in the conversation as seen by the signed-in person.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations
  set guest_last_read_at = case when guest_id = auth.uid() then now() else guest_last_read_at end,
      cook_last_read_at = case when cook_id = auth.uid() then now() else cook_last_read_at end
  where id = p_conversation_id and (guest_id = auth.uid() or cook_id = auth.uid());
$$;

-- Live updates. Realtime applies the same row-level security, so people only receive their own conversations.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
