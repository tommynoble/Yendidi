-- PAYOUT SCHEDULE
-- How a host prefers to be paid. 'on_request' is the existing behaviour (the host requests a payout when they want one).
alter table public.profiles
  add column if not exists payout_schedule text not null default 'on_request'
  check (payout_schedule in ('weekly', 'biweekly', 'on_request'));
