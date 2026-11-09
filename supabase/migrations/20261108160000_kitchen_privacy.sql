-- KITCHEN PRIVACY
-- When on, the host's nearby-landmark line is only shown to guests who have a confirmed booking with them.
alter table public.profiles
  add column if not exists hide_landmark_until_booked boolean not null default false;
