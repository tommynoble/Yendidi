-- =============================================
-- FIX: Ensure listings table has all required columns
-- The live DB already has the correct schema without
-- main_dish_id. This migration just ensures the
-- location and delivery columns exist.
-- Run this in your Supabase SQL Editor.
-- =============================================

-- Ensure location columns exist on listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS location_text TEXT;

-- Ensure delivery columns exist
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS pickup_available BOOLEAN DEFAULT true;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS delivery_available BOOLEAN DEFAULT false;

-- Verify
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'listings'
ORDER BY ordinal_position;
