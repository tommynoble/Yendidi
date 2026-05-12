import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const MAIN_DISHES = [
    {
        name: 'Jollof Rice',
        slug: 'jollof-rice',
        description: 'Authentic West African rice dish cooked in a spicy tomato base.',
        category: 'Rice Dishes',
        base_image_url: 'https://media.screensdesign.com/gasset/aaa81f96-45d8-41bb-b156-715baa73be93.png'
    },
    {
        name: 'Waakye',
        slug: 'waakye',
        description: 'Rice and beans cooked with millet leaves, served with shito and stew.',
        category: 'Rice Dishes',
        base_image_url: 'https://media.screensdesign.com/gasset/dc3224ca-3fdf-4b66-988a-4ea4b318eddd.png'
    },
    {
        name: 'Banku & Tilapia',
        slug: 'banku-and-tilapia',
        description: 'Fermented corn and cassava dough served with grilled tilapia.',
        category: 'Grilled & Fried',
        base_image_url: 'https://media.screensdesign.com/gasset/1ac55fee-80ce-4496-9b40-e1326846c550.png'
    },
    {
        name: 'Fufu & Light Soup',
        slug: 'fufu-and-light-soup',
        description: 'Pounded cassava and plantain served with spicy light soup.',
        category: 'Soups & Stews',
        base_image_url: 'https://media.screensdesign.com/gasset/b2f9baeb-dfb0-41f6-9a4e-a80e958e8e6e.png'
    }
];

const COOK_LISTINGS = [
    {
        main_dish_slug: 'jollof-rice',
        title: 'Aunty Ama\'s Party Jollof',
        description: 'Smoky, spicy, and served with a large piece of grilled chicken and shito.',
        price: 45.00,
        prep_time_minutes: 45,
    },
    {
        main_dish_slug: 'waakye',
        title: 'Waakye Special (The Works)',
        description: 'Served with wele, egg, fish, spaghetti, and gari fortor.',
        price: 35.00,
        prep_time_minutes: 20,
    },
    {
        main_dish_slug: 'banku-and-tilapia',
        title: 'Full Grilled Tilapia with 2 Banku',
        description: 'Fresh from the grill with hot pepper, onions, and tomatoes.',
        price: 65.00,
        prep_time_minutes: 30,
    }
];

async function seed() {
    console.log('🌱 Starting refined seed...');

    // 1. Get/Create Cook Profile
    const { data: users, error: userError } = await supabase.from('profiles').select('id').limit(1);
    if (userError || !users || users.length === 0) {
        console.error('❌ No profiles found. Sign up first.');
        return;
    }
    const cookId = users[0].id;

    console.log(`👨‍🍳 Updating profile ${cookId} to COOK...`);
    await supabase.from('profiles').update({
        role: 'COOK',
        full_name: 'Aunty Ama',
        verified: true
    }).eq('id', cookId);

    // 2. Insert Main Dishes
    console.log('🍛 Populating main_dishes catalog...');
    for (const dish of MAIN_DISHES) {
        const { data, error } = await supabase.from('main_dishes').upsert(dish, { onConflict: 'name' }).select().single();
        if (error) console.error(`Err: ${dish.name}`, error.message);
        else console.log(`✅ Main dish: ${data.name}`);
    }

    // 3. Insert Listings
    console.log('🏷️ Adding cook listings...');
    const { data: mainDishes } = await supabase.from('main_dishes').select('id, slug');
    const slugMap = Object.fromEntries(mainDishes?.map(d => [d.slug, d.id]) || []);

    for (const listing of COOK_LISTINGS) {
        const mainDishId = slugMap[listing.main_dish_slug];
        if (!mainDishId) continue;

        const { error } = await supabase.from('listings').insert({
            main_dish_id: mainDishId,
            cook_id: cookId,
            title: listing.title,
            description: listing.description,
            price: listing.price,
            prep_time_minutes: listing.prep_time_minutes,
            available: true,
            supports_sessions: true
        });

        if (error) console.error(`Err: ${listing.title}`, error.message);
        else console.log(`✅ Listing: ${listing.title}`);
    }

    console.log('✨ Refined seed complete!');
}

seed();
