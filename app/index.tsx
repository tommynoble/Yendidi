import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { hasPrimedPermissions } from '@/lib/permissionsOnboarding';

// Entry route: works out where the user belongs and redirects there straight away. It draws nothing itself. The intro
// video is a layer over the whole app (components/IntroOverlay, mounted in app/_layout.tsx), so the destination screen
// opens underneath it while it plays and the video lifts only once that screen is up.
export default function Index() {
    const router = useRouter();

    useEffect(() => {
        let done = false;

        const go = async (hasSession: boolean) => {
            if (done) return;
            done = true;
            if (!hasSession) {
                router.replace('/onboarding/community');
                return;
            }
            const primed = await hasPrimedPermissions();
            router.replace(primed ? '/(tabs)' : '/onboarding/permissions');
        };

        // Last-resort safety net only: if the session check hangs (e.g. a slow network refreshing an expired token), treat
        // the user as logged out instead of leaving the intro up forever.
        const timeout = setTimeout(() => go(false), 8000);

        supabase.auth
            .getSession()
            .then(({ data: { session }, error }) => {
                if (error) {
                    console.warn('Session recovery error, clearing tokens:', error.message);
                    supabase.auth.signOut();
                    go(false);
                } else {
                    go(!!session);
                }
            })
            .catch(() => {
                supabase.auth.signOut();
                go(false);
            })
            .finally(() => clearTimeout(timeout));

        return () => clearTimeout(timeout);
    }, []);

    return null;
}
