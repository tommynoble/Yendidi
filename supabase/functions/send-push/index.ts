import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Fired by three Database Webhooks (orders/UPDATE, cook_applications/UPDATE,
// meal_sessions/INSERT) configured in the Supabase dashboard — this is why
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

const ORDER_STATUS_COPY: Record<string, { title: string; body: string }> = {
    Accepted: { title: 'Order accepted! 🎉', body: 'Your order was accepted — get ready!' },
    Cooking: { title: 'Cooking started 👨‍🍳', body: 'Your order is being cooked right now.' },
    Ready: { title: 'Ready for pickup! 🍽️', body: 'Your order is ready.' },
    Completed: { title: 'Order completed ✅', body: 'Hope you enjoyed your meal!' },
    Cancelled: { title: 'Order cancelled', body: 'Your order was cancelled.' },
};

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
            const copy = ORDER_STATUS_COPY[record.status];
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
