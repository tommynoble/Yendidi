-- =============================================
-- SEED COOK LOCATION for Map Testing
-- Run this in Supabase SQL Editor
-- =============================================

-- Set location for the approved UK cook (Paa's Kitchen)
-- Using East Legon, Accra coordinates as default
UPDATE public.profiles
SET 
    latitude = 5.6350,
    longitude = -0.1580,
    location = 'East Legon, Accra'
WHERE id = 'fb45559b-8aeb-41fe-a767-27b070fb76e7';

-- Verify it worked
SELECT id, full_name, role, cook_application_status, latitude, longitude, location
FROM public.profiles
WHERE role = 'COOK';
