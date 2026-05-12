-- Refined Seed Script for main_dishes table
-- Matches local filenames in assets/images/dishes/
-- Run this in your Supabase SQL Editor (Clean existing first if needed: TRUNCATE main_dishes CASCADE;)

INSERT INTO public.main_dishes (name, slug, description, category)
VALUES 
    ('Jollof Rice with Chicken', 'jollof_rice_chicken', 'Authentic Ghanaian Jollof rice served with spicy grilled chicken and shito.', 'Rice'),
    ('Waakye Special', 'waakye_special', 'Traditional rice and beans cooked with sorghum leaves, served with wele, egg, and fish.', 'Rice'),
    ('Banku and Tilapia', 'banku_tilapia', 'Soft Banku served with charcoal-grilled Tilapia and fresh pepper sauce.', 'Swallow'),
    ('Fufu and Light Soup', 'fufu_light_soup', 'Pounded Yam and Cassava fufu served with spicy Goat Meat light soup.', 'Soups'),
    ('Red Red (Gob3)', 'red_red_gob3', 'Spicy beans stew cooked in palm oil, served with fried ripe plantains.', 'Beans'),
    ('Kenkey and Fried Fish', 'kenkey_and_fish', 'Fermented maize dumplings served with crispy fried fish and shito.', 'Swallow'),
    ('Banku and Okro', 'banku_and_okro', 'Smooth banku served with slimy okro soup/stew and assorted meat.', 'Soups'),
    ('Ampesi', 'ampesi', 'Boiled yam or plantain served with kontomire (palava) sauce or garden egg stew.', 'Traditional'),
    ('Kelewele', 'kelewele', 'Fried spicy plantain cubes, often served with groundnuts.', 'Snacks'),
    ('Fried Rice', 'fried_rice', 'Ghanaian style fried rice with vegetables and chicken.', 'Rice'),
    ('Emo Tuo with Groundnut Soup', 'emo_tuo_with_groundutsoup', 'Smooth rice balls served with creamy groundnut (peanut) soup.', 'Soups')
ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug, category = EXCLUDED.category;
