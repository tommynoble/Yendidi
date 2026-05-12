-- =============================================
-- SEED LISTINGS for the approved cook
-- Run this in Supabase SQL Editor
-- =============================================

-- First, get the main_dish IDs we need
-- Then create listings for Paa's Kitchen (fb45559b-8aeb-41fe-a767-27b070fb76e7)

INSERT INTO public.listings (cook_id, main_dish_id, title, description, price, category, available, portions_available, prep_time_minutes, image)
SELECT 
    'fb45559b-8aeb-41fe-a767-27b070fb76e7',
    md.id,
    md.name,
    md.description,
    CASE md.slug
        WHEN 'jollof_rice_chicken' THEN 45
        WHEN 'waakye_special' THEN 40
        WHEN 'banku_tilapia' THEN 65
        WHEN 'fufu_light_soup' THEN 50
        WHEN 'red_red_gob3' THEN 30
    END,
    md.category,
    true,
    10,
    30,
    md.base_image_url
FROM public.main_dishes md
WHERE md.slug IN ('jollof_rice_chicken', 'waakye_special', 'banku_tilapia', 'fufu_light_soup', 'red_red_gob3');

-- Verify
SELECT l.title, l.price, l.available, p.full_name as cook
FROM listings l
JOIN profiles p ON p.id = l.cook_id
ORDER BY l.created_at DESC;
