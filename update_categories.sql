-- =============================================
-- UPDATE LISTINGS & MAIN DISHES TO NEW CATEGORIES
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Update listings table
UPDATE public.listings SET category = 'Rice Dishes' WHERE category = 'Rice';
UPDATE public.listings SET category = 'Soups & Stews' WHERE category IN ('Soups', 'Swallow');
UPDATE public.listings SET category = 'Traditional Snacks' WHERE category IN ('Snacks', 'Traditional', 'Beans');
UPDATE public.listings SET category = 'Seafood' WHERE category = 'Fish';
UPDATE public.listings SET category = 'Pastries' WHERE category = 'Pastry';

-- 2. Update main_dishes catalog to match
UPDATE public.main_dishes SET category = 'Rice Dishes' WHERE category = 'Rice';
UPDATE public.main_dishes SET category = 'Soups & Stews' WHERE category IN ('Soups', 'Swallow');
UPDATE public.main_dishes SET category = 'Traditional Snacks' WHERE category IN ('Snacks', 'Traditional', 'Beans');

-- Verify updates
SELECT id, title, category FROM public.listings;
