-- Tighter contact masking. Replaces the function from 20261101140000_add_messaging.sql; safe to run more than once.
--  * ".me" / ".co" / ".ly" only count as links when a path follows (wa.me/..., bit.ly/...), so "sounds good.me too" is left alone.
--  * Numbers spelled out in words ("zero two four one two three ...") are hidden as well.
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
