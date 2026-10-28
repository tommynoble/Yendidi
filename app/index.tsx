import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import IntroVideoScreen from '@/components/IntroVideoScreen';
import { hasPrimedPermissions } from '@/lib/permissionsOnboarding';

// The intro video/overlay is the first thing shown on every app open — the
// session check runs quietly behind it instead of gating the screen, so
// tapping through routes wherever the resolved session says to go.
export default function Index() {
    const router = useRouter();
    const [session, setSession] = useState<boolean | null>(null);
    const [wantsContinue, setWantsContinue] = useState(false);

    useEffect(() => {
        // Last-resort safety net only — must comfortably outlast the intro
        // video's own hold time (~4.5s) plus its animate-out, otherwise this
        // fires first and locks in "logged out" before the real session
        // check (which may need a network round-trip to refresh an expired
        // token) ever gets a chance to answer correctly.
        const outputTimeout = setTimeout(() => {
            setSession((s) => (s === null ? false : s));
        }, 8000);

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

    useEffect(() => {
        if (!wantsContinue || session === null) return;
        if (!session) {
            router.replace('/onboarding/community');
            return;
        }
        hasPrimedPermissions().then((primed) => {
            router.replace(primed ? '/(tabs)' : '/onboarding/permissions');
        });
    }, [wantsContinue, session]);

    return (
        <IntroVideoScreen
            source={require('@/assets/video/home.mp4')}
            onContinue={() => setWantsContinue(true)}
        />
    );
}
