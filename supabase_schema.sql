-- Clean and production-ready Supabase schema for YenDidii
-- WARNING: Running this script will DELETE all existing data (DROP TABLE ... CASCADE)
-- This is necessary to transition from BigInt to UUID primary keys safely.

-- DROP EXISTING TABLES
drop table if exists public.reviews cascade;
drop table if exists public.meal_reservations cascade;
drop table if exists public.meal_sessions cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.listings cascade;
drop table if exists public.main_dishes cascade;
drop table if exists public.profiles cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. REUSABLE UTILITIES
-- ==========================================

-- Function to auto-update updated_at timestamps
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Function to auto-create profile for new auth users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone);
  return new;
end;
$$ language plpgsql;

-- Trigger: create_profile_on_signup
-- IMPORTANT: This trigger must be enabled for auto-onboarding to work
-- Run: drop trigger if exists on_auth_user_created on auth.users;
--      create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ==========================================
-- 2. CORE TABLES
-- ==========================================

-- PROFILES
create table public.profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  full_name text,
  avatar_url text,
  phone text,
  role text default 'EATER' check (role in ('EATER', 'ADMIN', 'COOK')),
  bio text,
  verified boolean default false,
  rating numeric(3,1), -- default null (honest reputation)
  served_count int default 0,
  location text,
  address text,
  longitude double precision,
  latitude double precision,
  cook_application_status text default 'none' check (
    cook_application_status in ('none', 'pending', 'approved', 'rejected')
  ),
  cook_onboarding_completed boolean default false,
  cook_approved_at timestamp with time zone,
  cook_rejection_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- COOK APPLICATIONS
create table public.cook_applications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  kitchen_name text not null,
  bio text,
  specialties text[], -- e.g. ['Rice', 'Soups']
  location text,
  hygiene_certified boolean default false,
  id_document_url text,
  cooking_frequency text check (
    cooking_frequency in ('occasionally', 'weekly', 'multiple_times_weekly')
  ),
  max_session_capacity int check (max_session_capacity > 0),
  food_photos text[],
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Prevent duplicate pending applications per user
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_application
  ON public.cook_applications (user_id)
  WHERE (status = 'pending');

-- MAIN DISHES (Global Catalog)
create table public.main_dishes (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  slug text unique not null, -- must be lowercase-hyphenated
  description text,
  category text, -- 'Rice', 'Soups', etc.
  base_image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- LISTINGS (Cook-Specific Versions)
create table public.listings (
  id uuid default uuid_generate_v4() primary key,
  main_dish_id uuid references public.main_dishes(id) on delete restrict not null,
  cook_id uuid references public.profiles(id) on delete cascade not null,
  title text not null, -- Replaces 'custom_title' and 'name'
  description text,
  price numeric not null check (price >= 0),
  image text,
  category text,
  available boolean default true,
  supports_sessions boolean default false,
  portions_available int default 1 check (portions_available >= 0),
  prep_time_minutes int default 30 check (prep_time_minutes >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- MEAL SESSIONS (Join the Pot Events)
create table public.meal_sessions (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references public.listings(id) on delete cascade not null,
  cook_id uuid references public.profiles(id) on delete cascade not null,
  main_dish_id uuid references public.main_dishes(id) not null,
  title text not null,
  description text,
  session_date date not null,
  start_time time not null,
  request_deadline timestamp with time zone not null,
  total_slots int not null default 20 check (total_slots > 0),
  filled_slots int not null default 0 check (filled_slots >= 0),
  min_requests_required int not null default 5,
  price_per_plate numeric not null check (price_per_plate >= 0),
  status text default 'open' check (status in ('open', 'confirmed', 'full', 'closed', 'cancelled', 'completed')),
  session_note text,
  max_per_user int default 5 check (max_per_user > 0),
  cover_image text,
  visibility text default 'public' check (
    visibility in ('public', 'private')
  ),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- MEAL RESERVATIONS
create table public.meal_reservations (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.meal_sessions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  quantity int not null default 1 check (quantity > 0),
  status text default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  constraint one_active_reservation_per_user_per_session unique (session_id, user_id)
);

-- ORDERS
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  cook_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'New' check (status in ('New', 'Accepted', 'Cooking', 'Ready', 'Completed', 'Cancelled')),
  total numeric not null check (total >= 0),
  delivery_method text default 'Pickup' check (delivery_method in ('Pickup', 'Delivery')),
  delivery_address text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ORDER ITEMS
create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  listing_id uuid references public.listings(id) on delete restrict not null,
  quantity int not null default 1 check (quantity > 0),
  price_at_purchase numeric not null check (price_at_purchase >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- REVIEWS
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  cook_id uuid references public.profiles(id) on delete cascade not null,
  listing_id uuid references public.listings(id),
  rating int not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  constraint unique_review_per_order unique (order_id, user_id)
);

-- ==========================================
-- 3. INTEGRITY & VALIDATION TRIGGERS
-- ==========================================

-- A. Validate Meal Session constraints
create or replace function validate_meal_session()
returns trigger as $$
begin
  -- 1. Ensure Cook owns the Listing
  if not exists (
    select 1 from listings 
    where id = new.listing_id and cook_id = new.cook_id
  ) then
    raise exception 'Listing does not belong to the specified cook.';
  end if;

  -- 2. Ensure Main Dish matches Listing
  if not exists (
    select 1 from listings 
    where id = new.listing_id and main_dish_id = new.main_dish_id
  ) then
    raise exception 'Main dish mismatch for this listing.';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger tr_validate_meal_session
  before insert or update on meal_sessions
  for each row execute function validate_meal_session();

-- B. Validate Meal Reservation (Overfill & Status)
create or replace function validate_meal_reservation()
returns trigger as $$
declare
  v_session_status text;
  v_total_slots int;
  v_filled_slots int;
  v_deadline timestamptz;
begin
  select status, total_slots, filled_slots, request_deadline 
  into v_session_status, v_total_slots, v_filled_slots, v_deadline
  from meal_sessions where id = new.session_id;

  -- 1. Check Deadline
  if now() > v_deadline then
    raise exception 'Request deadline has passed.';
  end if;

  -- 2. Check Session Status
  if v_session_status in ('closed', 'cancelled', 'completed') then
    raise exception 'Session is no longer accepting reservations.';
  end if;

  -- 3. Check Capacity (only for new/updated quantity)
  if (TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and new.quantity > old.quantity)) then
    if (v_filled_slots + (new.quantity - coalesce(old.quantity, 0))) > v_total_slots then
      raise exception 'Not enough slots available.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger tr_validate_meal_reservation
  before insert or update on meal_reservations
  for each row execute function validate_meal_reservation();

-- C. Update Session Filled Slots (Status-Aware)
create or replace function update_session_filled_slots_advanced()
returns trigger as $$
declare
  v_total_reserved int;
begin
  -- Calculate sum of all non-cancelled quantities for this session
  select coalesce(sum(quantity), 0) into v_total_reserved
  from meal_reservations
  where session_id = coalesce(new.session_id, old.session_id)
    and status in ('pending', 'confirmed');

  update meal_sessions
  set 
    filled_slots = v_total_reserved,
    status = case 
      when v_total_reserved >= total_slots then 'full'::text 
      when status = 'full' then 'open'::text -- back to open if someone cancels
      else status 
    end
  where id = coalesce(new.session_id, old.session_id);

  return null;
end;
$$ language plpgsql;

create trigger tr_sync_filled_slots
  after insert or update or delete on meal_reservations
  for each row execute function update_session_filled_slots_advanced();

-- D. Enforce Single-Cook Orders
create or replace function validate_order_item_consistency()
returns trigger as $$
declare
  v_order_cook_id uuid;
  v_listing_cook_id uuid;
begin
  select cook_id into v_order_cook_id from orders where id = new.order_id;
  select cook_id into v_listing_cook_id from listings where id = new.listing_id;

  if v_order_cook_id != v_listing_cook_id then
    raise exception 'All items in an order must belong to the same cook.';
  end if;

  return new;
end;
$$ language plpgsql;

-- VALIDATE MEAL RESERVATION LIMITS
create or replace function public.validate_meal_reservation_limits()
returns trigger as $$
declare
  v_session record;
begin
  select *
  into v_session
  from public.meal_sessions
  where id = new.session_id;

  if v_session is null then
    raise exception 'Meal session not found';
  end if;

  if new.quantity > v_session.max_per_user then
    raise exception 'You cannot reserve more than % spots for this session', v_session.max_per_user;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger tr_validate_meal_reservation_limits
before insert or update
on public.meal_reservations
for each row
execute function public.validate_meal_reservation_limits();

create trigger tr_validate_order_item
  before insert or update on order_items
  for each row execute function validate_order_item_consistency();

-- E. Validate Review Consistency
create or replace function validate_review_consistency()
returns trigger as $$
begin
  if not exists (
    select 1 from orders 
    where id = new.order_id and cook_id = new.cook_id
  ) then
    raise exception 'Review cook_id must match the order cook_id.';
  end if;

  if (new.listing_id is not null) and not exists (
    select 1 from order_items 
    where order_id = new.order_id and listing_id = new.listing_id
  ) then
    raise exception 'Review listing_id must be part of the referenced order.';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger tr_validate_review
  before insert or update on reviews
  for each row execute function validate_review_consistency();

-- ==========================================
-- 4. TIMESTAMPS & REPUTATION
-- ==========================================

-- Attach updated_at triggers
create trigger tr_profiles_updated_at before update on profiles for each row execute function set_updated_at();
create trigger tr_listings_updated_at before update on listings for each row execute function set_updated_at();
create trigger tr_sessions_updated_at before update on meal_sessions for each row execute function set_updated_at();
create trigger tr_orders_updated_at before update on orders for each row execute function set_updated_at();

-- Cook Rating Engine
create or replace function refresh_cook_stats()
returns trigger as $$
begin
  update profiles
  set 
    rating = (select avg(rating)::numeric(3,1) from reviews where cook_id = new.cook_id),
    served_count = (select count(*) from orders where cook_id = new.cook_id and status = 'Completed')
  where id = new.cook_id;
  return new;
end;
$$ language plpgsql;

create trigger tr_refresh_cook_rating
  after insert or update on reviews
  for each row execute function refresh_cook_stats();

-- ==========================================
-- 5. RLS POLICIES (Hardened)
-- ==========================================

alter table profiles enable row level security;
alter table main_dishes enable row level security;
alter table listings enable row level security;
alter table meal_sessions enable row level security;
alter table meal_reservations enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reviews enable row level security;

-- Cook Applications
alter table public.cook_applications enable row level security;

create policy "Users can view own applications" on cook_applications for select 
  using (auth.uid() = user_id);

create policy "Users can insert own applications" on cook_applications for insert 
  with check (auth.uid() = user_id);

create policy "Admins can view all applications" on cook_applications for select 
  using (exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN'));

-- Listings (Hardened)
create policy "Everyone view" on listings for select using (true);
create policy "Approved cooks manage own" on listings for all 
  using (auth.uid() = cook_id)
  with check (exists (
    select 1 from profiles 
    where id = auth.uid() and role = 'COOK' and cook_application_status = 'approved'
  ));

-- Sessions (Hardened)
create policy "Everyone view sessions" on meal_sessions for select using (true);
create policy "Approved cooks manage sessions" on meal_sessions for all 
  using (auth.uid() = cook_id)
  with check (exists (
    select 1 from profiles 
    where id = auth.uid() and role = 'COOK' and cook_application_status = 'approved'
  ));

-- Reservations
create policy "Users manage own reservations" on meal_reservations for all using (auth.uid() = user_id);
create policy "Cooks view session reservations" on meal_reservations for select 
  using (exists (select 1 from meal_sessions where id = meal_reservations.session_id and cook_id = auth.uid()));

-- Orders
create policy "User orders" on orders for all using (auth.uid() = user_id);
create policy "Cook orders" on orders for select using (auth.uid() = cook_id);
create policy "Cook status updates" on orders for update using (auth.uid() = cook_id);

-- Order Items
create policy "User items" on order_items for select using (exists (select 1 from orders where id = order_id and user_id = auth.uid()));
create policy "Cook items" on order_items for select using (exists (select 1 from orders where id = order_id and cook_id = auth.uid()));
create policy "User insert items" on order_items for insert with check (exists (select 1 from orders where id = order_id and user_id = auth.uid()));

-- Reviews
create policy "Public reviews" on reviews for select using (true);
create policy "User post review" on reviews for insert with check (
  auth.uid() = user_id and 
  exists (select 1 from orders where id = reviews.order_id and user_id = auth.uid() and status = 'Completed')
);
