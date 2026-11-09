import { useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useCurrentUserId } from '@/lib/useCurrentUserId';
import { earliestEventAt, bookingTiming, formatEventSentence } from '@/lib/booking';

// One source of truth for the notifications list AND the unread count, so the number on the Home bell always matches the
// Notifications page. What has been read is saved on the phone, per account.

export type NotificationItem = {
    id: string;
    status: string;
    title: string;
    message: string;
    time: string;
    createdAt: Date;
    image: string | null;
    unread: boolean;
};

const readKey = (userId: string) => `yendidii_read_notifications:${userId}`;
const MAX_REMEMBERED = 200;
// Updates older than this never count as unread, so a first install doesn't open with a pile of old "unread" orders.
const UNREAD_WINDOW_DAYS = 14;

// Plain, specific and short, in the order guests care about: what happened, then who and what. Dine-in wording (guests eat at
// the host's home), sentence case, no app name. Keep in step with the copy in supabase/functions/send-push.
export function orderNotificationCopy(status: string, host: string, dish: string, eventAt: Date | null = null): { title: string; message: string } {
    // A gathering with a date: until it's close, "cooking" and "ready" just mean the host is preparing, so say "see you on..." instead of "come now".
    const timing = bookingTiming(eventAt);
    const later = timing.scheduled && !timing.comeNow && eventAt;
    const when = eventAt ? formatEventSentence(eventAt) : '';
    switch (status) {
        case 'Accepted':
            return eventAt
                ? { title: 'Booking confirmed', message: `${host} confirmed your spot for ${dish} on ${when}.` }
                : { title: 'Order accepted', message: `${host} accepted your order for ${dish}.` };
        case 'Cooking':
            return later
                ? { title: 'Your host is preparing', message: `${host} has started preparing for ${dish}. See you ${when}.` }
                : { title: 'Cooking has started', message: `${host} is preparing ${dish}.` };
        case 'Ready':
            return later
                ? { title: 'Everything is ready', message: `${host} has everything ready for ${dish}. See you ${when}.` }
                : { title: 'Your table is ready', message: `${host} has ${dish} ready for you. Head over when you can.` };
        case 'Completed':
            return { title: 'Order completed', message: `Thanks for dining with ${host}. Hope you loved the ${dish}.` };
        case 'Declined':
            return { title: 'Order declined', message: `${host} couldn't host your order for ${dish} this time.` };
        case 'Cancelled':
            return { title: 'Order cancelled', message: `Your order for ${dish} with ${host} was cancelled.` };
        default:
            return { title: 'Order update', message: `There's an update on your order for ${dish}.` };
    }
}

const first = <T,>(value: T | T[] | null | undefined): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export function useNotificationFeed() {
    const userId = useCurrentUserId();
    const queryClient = useQueryClient();
    const readQueryKey = ['notifications-read', userId];

    const { data: orders = [], isLoading: ordersLoading } = useQuery({
        queryKey: ['notifications-orders', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id, status, created_at, updated_at,
                    profiles:cook_id (full_name, kitchen_name, avatar_url, kitchen_image_url),
                    order_items ( listings (title, order_deadline) )
                `)
                .eq('user_id', userId as string)
                .order('updated_at', { ascending: false })
                .limit(20);
            if (error) {
                console.error('Notifications orders fetch error:', error);
                return [];
            }
            return data || [];
        },
        enabled: !!userId,
        refetchInterval: 30000,
        refetchIntervalInBackground: false, // pause polling when the app is backgrounded
    });

    const { data: readIds, isSuccess: readLoaded } = useQuery({
        queryKey: readQueryKey,
        queryFn: async (): Promise<string[]> => {
            try {
                const raw = await AsyncStorage.getItem(readKey(userId as string));
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        },
        enabled: !!userId,
        staleTime: Infinity,
    });

    const items = useMemo<NotificationItem[]>(() => {
        const read = new Set(readIds ?? []);
        const cutoff = Date.now() - UNREAD_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        return (orders as any[])
            .filter((o) => o.status !== 'New') // "New" = just placed, not an update yet
            .map((o) => {
                const host = first<any>(o.profiles);
                const listing = first<any>(first<any>(o.order_items)?.listings);
                const hostName = host?.kitchen_name || host?.full_name || 'Your host';
                const dish = listing?.title || 'your dish';
                const updatedAt = new Date(o.updated_at || o.created_at);
                // The status is part of the id, so a new status on the same order is a new, unread notification.
                const id = `order-${o.id}-${o.status}`;
                return {
                    id,
                    status: o.status as string,
                    ...orderNotificationCopy(o.status, hostName, dish, earliestEventAt(o.order_items)),
                    time: formatDistanceToNow(updatedAt, { addSuffix: true }),
                    createdAt: updatedAt,
                    image: host?.kitchen_image_url || host?.avatar_url || null,
                    unread: !read.has(id) && updatedAt.getTime() > cutoff,
                };
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }, [orders, readIds]);

    // Nothing counts as unread until what was read has loaded from the phone, so the badge never flashes a wrong number.
    const unreadCount = readLoaded ? items.filter((i) => i.unread).length : 0;

    const saveRead = useCallback(
        (next: string[]) => {
            const trimmed = next.slice(-MAX_REMEMBERED);
            queryClient.setQueryData(readQueryKey, trimmed);
            if (userId) AsyncStorage.setItem(readKey(userId), JSON.stringify(trimmed)).catch(() => {});
        },
        [queryClient, userId],
    );

    const markRead = useCallback(
        (id: string) => {
            const current = queryClient.getQueryData<string[]>(readQueryKey) ?? [];
            if (!current.includes(id)) saveRead([...current, id]);
        },
        [queryClient, saveRead, userId],
    );

    const markAllRead = useCallback(() => {
        const current = queryClient.getQueryData<string[]>(readQueryKey) ?? [];
        saveRead(Array.from(new Set([...current, ...items.map((i) => i.id)])));
    }, [queryClient, saveRead, items, userId]);

    return { items, unreadCount, isLoading: !!userId && (ordersLoading || !readLoaded), markRead, markAllRead };
}
