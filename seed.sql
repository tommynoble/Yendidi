-- Run this in your Supabase SQL Editor to seed products
-- First, get your user ID (replace with actual ID from your profiles table)

-- Insert sample meals
INSERT INTO products (name, description, price, image, category, cook_id, available) VALUES
('Jollof Rice with Grilled Chicken', 'Authentic Ghanaian Jollof rice served with spicy grilled chicken and shito. Made with premium jasmine rice and fresh tomatoes.', 45.00, 'https://media.screensdesign.com/gasset/aaa81f96-45d8-41bb-b156-715baa73be93.png', 'Rice Dishes', '372c2161-c5fc-45ed-a084-ff62f630a7af', true),
('Waakye Special', 'Hot Waakye with wele, egg, fish, and spaghetti. The breakfast of champions!', 35.00, 'https://media.screensdesign.com/gasset/dc3224ca-3fdf-4b66-988a-4ea4b318eddd.png', 'Rice Dishes', '372c2161-c5fc-45ed-a084-ff62f630a7af', true),
('Banku and Tilapia', 'Fresh succulent Tilapia grilled to perfection, served with soft Banku and hot pepper sauce.', 60.00, 'https://media.screensdesign.com/gasset/1ac55fee-80ce-4496-9b40-e1326846c550.png', 'Grilled & Fried', '372c2161-c5fc-45ed-a084-ff62f630a7af', true),
('Fufu and Light Soup', 'Pounded yam fufu served with spicy goat meat light soup. A Sunday favorite.', 55.00, 'https://media.screensdesign.com/gasset/b2f9baeb-dfb0-41f6-9a4e-a80e958e8e6e.png', 'Soups & Stews', '372c2161-c5fc-45ed-a084-ff62f630a7af', true),
('Red Red (Gob3)', 'Beans stew with fried plantain and gari. Filling and delicious.', 25.00, 'https://media.screensdesign.com/gasset/618211fb-92b5-4a6e-b68a-9107aebfa82a.png', 'Rice Dishes', '372c2161-c5fc-45ed-a084-ff62f630a7af', true);

-- Also update the profile to be a cook
UPDATE profiles SET role = 'COOK', verified = true, full_name = 'Aunty Ama', location = 'East Legon, Accra', latitude = 5.6355, longitude = -0.1603 WHERE id = '372c2161-c5fc-45ed-a084-ff62f630a7af';
