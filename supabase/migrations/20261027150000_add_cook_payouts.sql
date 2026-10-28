-- Where a cook wants their payout sent. Payoneer handles the actual transfer —
-- this app only tracks balances and requests.
alter table public.profiles add column payoneer_email text;

create table public.payouts (
  id uuid default gen_random_uuid() primary key,
  cook_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric not null check (amount >= 0),
  platform_fee_percent int not null,
  status text default 'pending' check (status in ('pending', 'processing', 'paid', 'failed')),
  payoneer_reference text,
  requested_at timestamp with time zone default timezone('utc'::text, now()),
  paid_at timestamp with time zone
);

alter table public.payouts enable row level security;

create policy "Cooks can view their own payouts"
  on public.payouts for select
  using (auth.uid() = cook_id);

create policy "Cooks can request their own payouts"
  on public.payouts for insert
  with check (auth.uid() = cook_id);

-- Which completed orders a payout covers, so the next payout request only
-- sums orders that haven't already been paid out.
alter table public.orders add column payout_id uuid references public.payouts(id);
