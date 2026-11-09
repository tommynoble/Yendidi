-- SERVICE RADIUS
-- How far from their kitchen a host serves, in km. Shown as the Service Zone on Kitchen Settings.
alter table public.profiles
  add column if not exists service_radius_km numeric(4, 1) not null default 5
  check (service_radius_km between 2 and 15);
