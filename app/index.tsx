import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';

export default function Index() {
    const [session, setSession] = useState<boolean | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Timeout to prevent hanging
        const outputTimeout = setTimeout(() => {
            if (session === null) setSession(false);
        }, 1500);

        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.warn('Session recovery error, clearing tokens:', error.message);
                supabase.auth.signOut();
                setSession(false);
            } else {
                setSession(!!session);
            }
            clearTimeout(outputTimeout);
        }).catch(() => {
            supabase.auth.signOut();
            setSession(false);
        });

        return () => clearTimeout(outputTimeout);
    }, []);

    if (session === null) {
        return (
            <View className="flex-1 items-center justify-center bg-brand-cream gap-4">
                <ActivityIndicator size="large" color="#D65A31" />
                <Text>Checking Session...</Text>
            </View>
        );
    }

    if (session) {
        return <Redirect href="/(tabs)" />;
    }

    return <Redirect href="/onboarding" />;
}
