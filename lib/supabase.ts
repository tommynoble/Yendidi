import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let storage: any = undefined;

// Only load AsyncStorage on native platforms
if (Platform.OS !== 'web') {
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        storage = AsyncStorage;
    } catch (e) {
        // AsyncStorage not available
    }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
