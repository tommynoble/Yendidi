-- =============================================
-- LOCATION FEATURE MIGRATION
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Add lat/lng + location text to listings table
--    (allows cook to pin their pickup location per listing)
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_text TEXT;

-- 2. Add location text to profiles table
--    (user's saved home location shown on profile & used for distance sorting)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS location TEXT;

-- =============================================
-- OPTIONAL: Index for geo queries if you add
-- PostGIS later (skip for now)
-- CREATE INDEX IF NOT EXISTS listings_lat_lng_idx ON listings (latitude, longitude);
-- =============================================
