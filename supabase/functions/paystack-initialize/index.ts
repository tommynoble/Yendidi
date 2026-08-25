import { corsHeaders } from '../_shared/cors.ts';

// Initializes a Paystack transaction server-side (the secret key never touches the app)
// and hands the client a real hosted checkout URL. That real URL is what makes Apple Pay
// work — Apple Pay JS requires a genuine HTTPS origin for merchant domain verification,
// which an in-app injected-HTML checkout can't provide.
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { email, amount, reference, metadata, channels } = await req.json();

        if (!email || !amount || !reference) {
            return new Response(
                JSON.stringify({ error: 'email, amount, and reference are required' }),
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

        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                amount, // smallest currency unit (pesewas for GHS)
                currency: 'GHS',
                reference,
                metadata,
                channels: channels && channels.length > 0 ? channels : ['card', 'mobile_money'],
                callback_url: 'yendidii://payment-callback',
            }),
        });

        const data = await paystackRes.json();

        if (!paystackRes.ok || !data.status) {
            return new Response(
                JSON.stringify({ error: data.message || 'Could not initialize the transaction.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                authorization_url: data.data.authorization_url,
                access_code: data.data.access_code,
                reference: data.data.reference,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
