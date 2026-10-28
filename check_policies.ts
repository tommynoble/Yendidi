import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
    console.log("Checking policies...");
    const { data, error } = await supabase.rpc('get_policies'); // If RPC exists
    if (error) {
        // Fallback: run a raw query using SQL or check via REST if possible
        console.log("RPC get_policies not available, executing direct SQL query via REST if available...");
        // Let's try select from pg_policies via a generic query or just inspect policies in our supabase_schema.sql
        console.log(error.message);
    } else {
        console.log("Policies:", data);
    }
}

checkPolicies();
