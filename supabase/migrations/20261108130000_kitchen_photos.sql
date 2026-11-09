-- KITCHEN PHOTOS
-- A host can show several photos of their kitchen. The first one is the cover and is also kept in kitchen_image_url,
-- which the rest of the app already reads.
alter table public.profiles
  add column if not exists kitchen_photos text[] not null default '{}';
