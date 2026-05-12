-- MEAL DROPS / MEAL SESSIONS SCHEMA

-- 1. MEAL SESSIONS
-- A cook-hosted timed event for a specific listing (cook's version of a dish)
create table public.meal_sessions (
  id uuid default uuid_generate_v4() primary key,
  cook_id uuid references public.profiles(id) not null,
  listing_id bigint references public.listings(id) not null,
  main_dish_id uuid references public.main_dishes(id) not null,
  title text not null, -- e.g. "Saturday Waakye Lunch Drop"
  description text,
  session_date date not null,
  start_time time not null,
  request_deadline timestamp with time zone not null,
  total_slots int not null default 20,
  filled_slots int not null default 0,
  min_requests_required int not null default 5,
  price_per_plate numeric not null,
  status text default 'open' check (status in ('open', 'confirmed', 'full', 'closed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- MIGRATION FOR LISTINGS TABLE
-- alter table public.listings add column supports_sessions boolean default false;

-- RLS for Meal Sessions
alter table public.meal_sessions enable row level security;
create policy "Meal sessions are viewable by everyone." on meal_sessions for select using (true);
create policy "Cooks can create meal sessions." on meal_sessions for insert with check (auth.uid() = cook_id);
create policy "Cooks can update own sessions." on meal_sessions for update using (auth.uid() = cook_id);

-- 2. MEAL RESERVATIONS
-- Users joining a meal session
create table public.meal_reservations (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.meal_sessions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  quantity int not null default 1,
  status text default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS for Meal Reservations
alter table public.meal_reservations enable row level security;
create policy "Users can view own reservations." on meal_reservations for select using (auth.uid() = user_id);
create policy "Cooks can view reservations for their sessions." on meal_reservations for select using (
  exists (select 1 from meal_sessions where id = meal_reservations.session_id and cook_id = auth.uid())
);
create policy "Users can reserve a spot." on meal_reservations for insert with check (auth.uid() = user_id);

-- 3. FUNCTION TO UPDATE FILLED SLOTS
create or replace function update_session_filled_slots()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update meal_sessions
    set filled_slots = filled_slots + new.quantity
    where id = new.session_id;
  elsif (TG_OP = 'DELETE') then
    update meal_sessions
    set filled_slots = filled_slots - old.quantity
    where id = old.session_id;
  elsif (TG_OP = 'UPDATE') then
    update meal_sessions
    set filled_slots = filled_slots - old.quantity + new.quantity
    where id = new.session_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_reservation_change
  after insert or update or delete on meal_reservations
  for each row
  execute function update_session_filled_slots();
