import { corsHeaders } from '../_shared/cors.ts';

// Confirms a Paystack transaction server-side. The app must never trust a browser
// redirect alone as proof of payment — this is the source of truth before an order
// is created.
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { reference } = await req.json();

        if (!reference) {
            return new Response(
                JSON.stringify({ error: 'reference is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!secretKey) {
            return new Response(
                JSON.stringify({ error: 'Paystack is not configured on the server yet.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const paystackRes = await fetch(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
            { headers: { Authorization: `Bearer ${secretKey}` } }
        );

        const data = await paystackRes.json();

        if (!paystackRes.ok || !data.status) {
            return new Response(
                JSON.stringify({ verified: false, error: data.message || 'Verification failed.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const verified = data.data?.status === 'success';

        return new Response(
            JSON.stringify({
                verified,
                status: data.data?.status,
                reference: data.data?.reference,
                amount: data.data?.amount,
                channel: data.data?.channel,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ verified: false, error: err instanceof Error ? err.message : 'Unexpected error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
