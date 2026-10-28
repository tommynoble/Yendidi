-- PROMO CODES
create table public.promo_codes (
  code text primary key,
  discount_percent int not null check (discount_percent > 0 and discount_percent <= 100),
  active boolean default true,
  max_redemptions int,
  redemption_count int default 0 not null,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.promo_codes enable row level security;

-- Anyone can read active codes (needed for client-side validation at checkout);
-- only the service role can create/edit them.
create policy "Anyone can view promo codes"
  on public.promo_codes for select
  using (true);

-- PROMO REDEMPTIONS
-- One row per user per code, so the same user can't reuse a code across orders.
create table public.promo_redemptions (
  id uuid default gen_random_uuid() primary key,
  code text references public.promo_codes(code) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  constraint unique_redemption_per_user unique (code, user_id)
);

alter table public.promo_redemptions enable row level security;

create policy "Users can view their own redemptions"
  on public.promo_redemptions for select
  using (auth.uid() = user_id);

create policy "Users can redeem a code for themselves"
  on public.promo_redemptions for insert
  with check (auth.uid() = user_id);

-- Keep redemption_count in sync automatically rather than relying on the
-- client to increment it (which would race under concurrent checkouts).
create or replace function public.increment_promo_redemption_count()
returns trigger as $$
begin
  update public.promo_codes
  set redemption_count = redemption_count + 1
  where code = new.code;
  return new;
end;
$$ language plpgsql security definer;

create trigger tr_increment_promo_redemption
  after insert on public.promo_redemptions
  for each row execute function public.increment_promo_redemption_count();

-- Seed the code already advertised on the profile screen's rewards card.
insert into public.promo_codes (code, discount_percent) values ('SANKOFA20', 20);
