import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCurrentUserId } from '@/lib/useCurrentUserId';

// Order statuses that count as a confirmed booking.
const CONFIRMED_STATUSES = ['Accepted', 'Cooking', 'Ready', 'Completed'];

// Whether the viewer may see this host's nearby-landmark line. Hosts can turn on "Kitchen Door Cloaking" in Privacy & Security,
// which hides it until the viewer has a confirmed booking. Fails closed: false until the check has finished.
export function useKitchenLandmarkAccess(hostId?: string | null) {
    const me = useCurrentUserId();
    const { data } = useQuery({
        queryKey: ['landmark-access', hostId, me],
        enabled: !!hostId,
        queryFn: async () => {
            const { data: flag, error } = await supabase.from('profiles').select('hide_landmark_until_booked').eq('id', hostId as string).single();
            // Column not there yet (database update not run) or setting off: nothing is hidden.
            if (error || !flag?.hide_landmark_until_booked) return true;
            if (me && me === hostId) return true;
            if (!me) return false;
            const { count } = await supabase
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', me)
                .eq('cook_id', hostId as string)
                .in('status', CONFIRMED_STATUSES);
            return (count || 0) > 0;
        },
    });
    return data === true;
}
