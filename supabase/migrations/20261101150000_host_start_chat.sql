-- Hosts can start a chat with a guest, but only one who has a paid, non-cancelled order with them.
-- Safe to run more than once.
create or replace function public.start_conversation_with_guest(p_guest_id uuid)
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
  if auth.uid() = p_guest_id then
    raise exception 'You cannot message yourself';
  end if;
  if not public.has_booked_with_host(p_guest_id, auth.uid()) then
    raise exception 'You can only message guests who have booked with you';
  end if;

  select id into conv_id from public.conversations
  where guest_id = p_guest_id and cook_id = auth.uid();

  if conv_id is null then
    insert into public.conversations (guest_id, cook_id)
    values (p_guest_id, auth.uid())
    returning id into conv_id;
  end if;

  return conv_id;
end;
$$;
