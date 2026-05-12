import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAll() {
    console.log(`🔍 Fetching all profiles and cook applications...`);

    // 1. Fetch Profiles
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, cook_application_status, verified');

    if (pError) {
        console.error('❌ Error fetching profiles:', pError.message);
    } else {
        console.log(`\n✅ Profiles Found (${profiles.length}):`);
        profiles.forEach(p => {
            const status = p.cook_application_status ? p.cook_application_status.toUpperCase() : 'NONE';
            const verification = p.verified ? '✅ Verified' : '❌ Unverified';
            console.log(` - ${p.full_name || 'No Name'} | ${p.phone} | Role: ${p.role} | Status: ${status} | ${verification}`);
        });
    }

    // 2. Fetch Cook Applications
    const { data: apps, error: aError } = await supabase
        .from('cook_applications')
        .select('id, kitchen_name, status, profiles(full_name, phone)');

    if (aError) {
        console.error('❌ Error fetching applications:', aError.message);
    } else {
        console.log(`\n✅ Formal Cook Applications (${apps.length}):`);
        if (apps.length === 0) console.log('   (No formal applications found in the cook_applications table)');
        apps.forEach((a: any) => {
            console.log(` - ${a.kitchen_name} | User: ${a.profiles?.full_name} | Status: ${a.status.toUpperCase()}`);
        });
    }
}

listAll();
