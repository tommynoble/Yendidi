import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// The signed-in person's id, or null while loading / signed out.
export function useCurrentUserId() {
    const [userId, setUserId] = useState<string | null>(null);
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    }, []);
    return userId;
}
