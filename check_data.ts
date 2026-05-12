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

async function checkData() {
    console.log('🔍 Checking Listings with Profile Join...');

    const { data: listings, error } = await supabase
        .from('listings')
        .select(`
            id,
            title,
            cook_id,
            profiles (
                full_name,
                avatar_url,
                rating
            )
        `);

    if (error) {
        console.error('❌ Error fetching listings with join:', error.message);
    } else if (!listings || listings.length === 0) {
        console.log('⚠️ No listings found in the database.');
    } else {
        console.log(`✅ Found ${listings.length} listings with join:`);
        listings.forEach((p: any) => {
            console.log(` - ${p.title} | ID: ${p.id} | Cook ID: ${p.cook_id}`);
            console.log(`   -> Profile:`, p.profiles ? p.profiles : 'NULL (Check RLS or Foreign Key)');
        });
    }

    console.log('\n🔍 Checking Active Meal Sessions...');
    const { data: sessions, error: sessionError } = await supabase
        .from('meal_sessions')
        .select(`
            *,
            profiles:cook_id (full_name),
            listings:listing_id (title)
        `);

    if (sessionError) {
        console.error('❌ Error fetching sessions:', sessionError.message);
    } else {
        console.log(`✅ Found ${sessions?.length || 0} sessions:`);
        sessions?.forEach((s: any) => {
            console.log(` - ${s.title} | Cook: ${s.profiles?.full_name} | Listing: ${s.listings?.title} | Slots: ${s.filled_slots}/${s.total_slots}`);
        });
    }
}

checkData();
