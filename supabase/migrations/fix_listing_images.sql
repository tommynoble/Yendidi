-- =============================================
-- FIX: Add images to seeded listings
-- Run this in Supabase SQL Editor
-- =============================================

-- Update listings with high-quality food images using reliable Unsplash URLs
UPDATE public.listings 
SET image = CASE title
    WHEN 'Jollof Rice with Chicken' THEN 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=800&q=80'
    WHEN 'Waakye Special' THEN 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80'
    WHEN 'Banku and Tilapia' THEN 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=800&q=80'
    WHEN 'Fufu and Light Soup' THEN 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80'
    WHEN 'Red Red (Gob3)' THEN 'https://images.unsplash.com/photo-1645696301019-35adcc0b1046?w=800&q=80'
    ELSE image
END
WHERE image IS NULL
  AND title IN ('Jollof Rice with Chicken', 'Waakye Special', 'Banku and Tilapia', 'Fufu and Light Soup', 'Red Red (Gob3)');

-- Verify
SELECT title, image FROM public.listings ORDER BY created_at DESC;
