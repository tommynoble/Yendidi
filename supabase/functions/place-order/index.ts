import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The only way an order gets created. The app sends the cart (listing ids + quantities) and a promo code, never a price.
//   preflight: true  -> returns the server's price for the cart so the app knows what to charge. Nothing is created.
//   otherwise        -> confirms the payment with Paystack, then creates the orders only if the amount paid matches the
//                       server's price for that cart (see place_paid_orders in the database).
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
        const { data: { user } } = await admin.auth.getUser(token);
        if (!user) return json({ ok: false, error: 'not_signed_in' }, 401);

        const { items, promo_code, preflight, reference, payment_method, notes } = await req.json();

        const { data: quote, error: quoteError } = await admin.rpc('_price_cart', { p_user: user.id, p_items: items, p_promo: promo_code || null });
        if (quoteError) return json({ ok: false, error: quoteError.message }, 500);

        if (preflight) return json(quote);
        if (!quote?.ok) return json(quote, 400);
        if (!reference) return json({ ok: false, error: 'reference_required' }, 400);

        const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!secretKey) return json({ ok: false, error: 'Paystack is not configured on the server yet.' }, 500);

        const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
        });
        const paystack = await paystackRes.json();
        if (!paystackRes.ok || !paystack.status || paystack.data?.status !== 'success') {
            return json({ ok: false, error: 'payment_not_confirmed' }, 402);
        }

        const { data: placed, error: placeError } = await admin.rpc('place_paid_orders', {
            p_user: user.id,
            p_reference: reference,
            p_paid_pesewas: paystack.data.amount,
            p_items: items,
            p_promo: promo_code || null,
            p_method: payment_method || null,
            p_notes: notes || null,
        });
        if (placeError) return json({ ok: false, error: placeError.message }, 400);

        return json(placed);
    } catch (err) {
        return json({ ok: false, error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
    }
});
