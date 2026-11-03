-- EVENT DETAILS + HOST DAY PROTECTION
-- 1) New optional listing fields hosts can fill in when creating an event: the main dish, starters / sides / drinks,
--    and tag lists for games & atmosphere and dietary info. The guest listing page reads these.
-- 2) A host day that already has paid bookings cannot be moved. The app already hides the option; this makes the
--    database enforce it too, so a modified app can't move a date guests have booked.

alter table public.listings
  add column if not exists main_dish text,
  add column if not exists starter text,
  add column if not exists sides_dessert text,
  add column if not exists drinks text,
  add column if not exists atmosphere_tags text[] not null default '{}',
  add column if not exists dietary_tags text[] not null default '{}';

-- Keep text short enough for the cards, and the tag lists a sensible size.
alter table public.listings drop constraint if exists listings_event_details_limits;
alter table public.listings add constraint listings_event_details_limits check (
  (main_dish is null or char_length(main_dish) <= 160)
  and (starter is null or char_length(starter) <= 200)
  and (sides_dessert is null or char_length(sides_dessert) <= 200)
  and (drinks is null or char_length(drinks) <= 200)
  and coalesce(array_length(atmosphere_tags, 1), 0) <= 10
  and coalesce(array_length(dietary_tags, 1), 0) <= 10
);

-- Block date / time changes on a host day that has paid, non-cancelled bookings.
create or replace function public.block_booked_session_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.session_date is distinct from old.session_date or new.start_time is distinct from old.start_time then
    if exists (
      select 1
      from public.order_items oi
      join public.listings l on l.id = oi.listing_id
      join public.orders o on o.id = oi.order_id
      where l.session_id = old.id
        and o.payment_status = 'success'
        and o.status <> 'Cancelled'
    ) then
      raise exception 'This host day has bookings, so its date and time cannot be changed.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists block_booked_session_change_before_update on public.cook_sessions;
create trigger block_booked_session_change_before_update
  before update on public.cook_sessions
  for each row execute function public.block_booked_session_change();
