-- Combined Production-Ready Seed Script for Meal Sessions
-- This script finds IDs dynamically to avoid UUID mismatch

do $$
declare
    v_cook_id uuid;
    v_jollof_listing_id uuid;
    v_waakye_listing_id uuid;
    v_banku_listing_id uuid;
    v_jollof_main_id uuid;
    v_waakye_main_id uuid;
    v_banku_main_id uuid;
begin
    -- 1. Get the cook (Aunty Ama)
    select id into v_cook_id from profiles where full_name = 'Aunty Ama' limit 1;
    
    -- 2. Get Main Dish IDs
    select id into v_jollof_main_id from main_dishes where slug = 'jollof-rice' limit 1;
    select id into v_waakye_main_id from main_dishes where slug = 'waakye' limit 1;
    select id into v_banku_main_id from main_dishes where slug = 'banku-and-tilapia' limit 1;

    -- 3. Get Listing IDs
    select id into v_jollof_listing_id from listings where cook_id = v_cook_id and main_dish_id = v_jollof_main_id limit 1;
    select id into v_waakye_listing_id from listings where cook_id = v_cook_id and main_dish_id = v_waakye_main_id limit 1;
    select id into v_banku_listing_id from listings where cook_id = v_cook_id and main_dish_id = v_banku_main_id limit 1;

    -- Clear existing
    truncate public.meal_sessions cascade;

    -- Insert Sessions
    if v_waakye_listing_id is not null then
        insert into public.meal_sessions (
            cook_id, listing_id, main_dish_id, title, description, 
            session_date, start_time, request_deadline, 
            total_slots, filled_slots, price_per_plate, status
        ) values (
            v_cook_id, v_waakye_listing_id, v_waakye_main_id, 'Waakye Saturday Drop', 
            'Aunty Ama''s famous Saturday Waakye. Limited spots!', 
            current_date + interval '3 days', '13:00', current_timestamp + interval '2 days', 
            25, 18, 35.00, 'open'
        );
    end if;

    if v_banku_listing_id is not null then
        insert into public.meal_sessions (
            cook_id, listing_id, main_dish_id, title, description, 
            session_date, start_time, request_deadline, 
            total_slots, filled_slots, price_per_plate, status
        ) values (
            v_cook_id, v_banku_listing_id, v_banku_main_id, 'Friday Tilapia Night', 
            'Fresh grilled tilapia with hot banku. Join the community pot!', 
            current_date + interval '2 days', '18:30', current_timestamp + interval '1 day', 
            15, 5, 65.00, 'open'
        );
    end if;

    if v_jollof_listing_id is not null then
        insert into public.meal_sessions (
            cook_id, listing_id, main_dish_id, title, description, 
            session_date, start_time, request_deadline, 
            total_slots, filled_slots, price_per_plate, status
        ) values (
            v_cook_id, v_jollof_listing_id, v_jollof_main_id, 'Sunday Jollof Feast', 
            'The ultimate Sunday lunch. Authentic jollof with chicken.', 
            current_date + interval '4 days', '14:00', current_timestamp + interval '3 days', 
            30, 12, 45.00, 'open'
        );
    end if;

end $$;
