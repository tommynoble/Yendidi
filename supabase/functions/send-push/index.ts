import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Fired by four Database Webhooks (orders/UPDATE, cook_applications/UPDATE,
// meal_sessions/INSERT, messages/INSERT) configured in the Supabase dashboard — this is why
// the payload shape is the generic { table, type, record, old_record } that
// Supabase webhooks send, rather than something custom per caller.
const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const NEARBY_RADIUS_KM = 15;

async function sendToUsers(userIds: string[], title: string, body: string, data: Record<string, unknown> = {}) {
    if (userIds.length === 0) return;

    const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token')
        .in('user_id', userIds);

    const pushTokens = (tokens || []).map((t: { token: string }) => t.token);
    if (pushTokens.length === 0) return;

    const messages = pushTokens.map((to: string) => ({ to, sound: 'default', title, body, data }));

    // Expo caps batches at 100 messages per request.
    for (let i = 0; i < messages.length; i += 100) {
        await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(messages.slice(i, i + 100)),
        });
    }
}

// "Sat 15 Nov at 7:00 pm", in Ghana time, for gatherings with a date.
function formatEvent(d: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Accra',
    }).format(d).replace(',', ' at');
}

// Within this long of the start (or after it), a ready table means come now. Same rule as lib/booking.ts in the app.
const COME_NOW_WITHIN_MS = 3 * 60 * 60 * 1000;

// Banner wording for an order changing status. Short title, then who and what. Dine-in wording (guests eat at the host's home),
// sentence case, no app name. A gathering with a date says "see you on..." until it is close. Keep in step with
// orderNotificationCopy in lib/notificationFeed.ts.
function orderCopy(status: string, host: string, dish: string, eventAt: Date | null): { title: string; body: string } | null {
    const later = !!eventAt && eventAt.getTime() - Date.now() > COME_NOW_WITHIN_MS;
    const when = eventAt ? formatEvent(eventAt) : '';
    switch (status) {
        case 'Accepted':
            return eventAt
                ? { title: 'Booking confirmed', body: `${host} confirmed your spot for ${dish} on ${when}.` }
                : { title: 'Order accepted', body: `${host} accepted your order for ${dish}.` };
        case 'Cooking':
            return later
                ? { title: 'Your host is preparing', body: `${host} has started preparing for ${dish}. See you ${when}.` }
                : { title: 'Cooking has started', body: `${host} is preparing ${dish}.` };
        case 'Ready':
            return later
                ? { title: 'Everything is ready', body: `${host} has everything ready for ${dish}. See you ${when}.` }
                : { title: 'Your table is ready', body: `${host} has ${dish} ready for you. Head over when you can.` };
        case 'Completed': return { title: 'Order completed', body: `Thanks for dining with ${host}. Hope you loved the ${dish}.` };
        case 'Declined': return { title: 'Order declined', body: `${host} couldn't host your order for ${dish} this time.` };
        case 'Cancelled': return { title: 'Order cancelled', body: `Your order for ${dish} with ${host} was cancelled.` };
        default: return null;
    }
}

// Host, dish and gathering time for the banner. Falls back to generic words so a lookup problem never stops the notification.
async function orderContext(orderId: string): Promise<{ host: string; dish: string; eventAt: Date | null }> {
    const fallback = { host: 'Your host', dish: 'your dish', eventAt: null as Date | null };
    try {
        const { data } = await supabase
            .from('orders')
            .select('profiles:cook_id (full_name, kitchen_name), order_items ( listings (title, order_deadline) )')
            .eq('id', orderId)
            .single();
        const first = (v: any) => (Array.isArray(v) ? v[0] : v);
        const host = first(data?.profiles);
        const items: any[] = Array.isArray(data?.order_items) ? data!.order_items : data?.order_items ? [data.order_items] : [];
        const listing = first(items[0]?.listings);
        const times = items
            .map((i) => new Date(first(i?.listings)?.order_deadline))
            .filter((d) => !isNaN(d.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());
        return {
            host: host?.kitchen_name || host?.full_name || fallback.host,
            dish: listing?.title || fallback.dish,
            eventAt: times[0] ?? null,
        };
    } catch {
        return fallback;
    }
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    if (secret && req.headers.get('x-webhook-secret') !== secret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        const { table, type, record, old_record } = payload;

        if (table === 'orders' && type === 'UPDATE' && record.status !== old_record?.status) {
            const { host, dish, eventAt } = await orderContext(record.id);
            const copy = orderCopy(record.status, host, dish, eventAt);
            if (copy) {
                await sendToUsers([record.user_id], copy.title, copy.body, { orderId: record.id });
            }
        }

        if (
            table === 'cook_applications' &&
            type === 'UPDATE' &&
            record.status !== old_record?.status &&
            (record.status === 'approved' || record.status === 'rejected')
        ) {
            const approved = record.status === 'approved';
            await sendToUsers(
                [record.user_id],
                approved ? "You're approved! 🎉" : 'Application update',
                approved
                    ? 'Your cook application was approved — switch to Kitchen Mode to get started.'
                    : (record.rejection_reason || 'Your cook application needs a few changes.'),
                { screen: 'profile' }
            );
        }

        if (table === 'messages' && type === 'INSERT') {
            const { data: conv } = await supabase
                .from('conversations')
                .select('id, guest_id, cook_id')
                .eq('id', record.conversation_id)
                .single();

            if (conv) {
                const recipientId = record.sender_id === conv.guest_id ? conv.cook_id : conv.guest_id;
                const { data: sender } = await supabase
                    .from('profiles')
                    .select('full_name, kitchen_name')
                    .eq('id', record.sender_id)
                    .single();
                // record.body was already stripped of phone numbers / emails / links by the database trigger.
                const senderName = (record.sender_id === conv.cook_id && sender?.kitchen_name) || sender?.full_name || 'New message';
                await sendToUsers([recipientId], senderName, String(record.body).slice(0, 140), { conversationId: conv.id });
            }
        }

        if (table === 'meal_sessions' && type === 'INSERT') {
            const { data: listing } = await supabase
                .from('listings')
                .select('title, cook_id, latitude, longitude')
                .eq('id', record.listing_id)
                .single();

            if (listing?.latitude != null && listing?.longitude != null) {
                // Rough bounding box first (cheap, index-friendly), then a real
                // Haversine check so a 1-degree box doesn't notify half a region.
                const latDelta = NEARBY_RADIUS_KM / 111;
                const lngDelta = NEARBY_RADIUS_KM / (111 * Math.cos(toRad(listing.latitude)));

                const { data: nearby } = await supabase
                    .from('profiles')
                    .select('id, latitude, longitude')
                    .neq('id', listing.cook_id)
                    .not('latitude', 'is', null)
                    .not('longitude', 'is', null)
                    .gte('latitude', listing.latitude - latDelta)
                    .lte('latitude', listing.latitude + latDelta)
                    .gte('longitude', listing.longitude - lngDelta)
                    .lte('longitude', listing.longitude + lngDelta);

                const userIds = (nearby || [])
                    .filter((p: { latitude: number; longitude: number }) =>
                        haversineKm(listing.latitude, listing.longitude, p.latitude, p.longitude) <= NEARBY_RADIUS_KM
                    )
                    .map((p: { id: string }) => p.id);

                if (userIds.length > 0) {
                    await sendToUsers(
                        userIds,
                        'New meal session near you 🍲',
                        `${listing.title} just opened — grab a spot before it fills up.`,
                        { sessionId: record.id }
                    );
                }
            }
        }

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
