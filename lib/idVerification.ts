import { supabase } from '@/lib/supabase';

// Guests browse freely; the first time they try to book, they must have passed an ID check.
// Flip this off to let anyone book (e.g. while testing, or until a verification provider is connected).
export const REQUIRE_ID_TO_BOOK = true;

export const BOOKING_ID_REASON = 'Hosts open their real homes. Verify your ID once, and you can book any table.';

// Whether the signed-in user has passed the ID check. The flag is set only by the server, never by the app.
export async function isIdVerified(): Promise<boolean> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        const { data } = await supabase.from('profiles').select('id_verified').eq('id', user.id).maybeSingle();
        return !!(data as any)?.id_verified;
    } catch {
        return false;
    }
}

// TEMPORARY: until a verification provider is connected, "Maybe later" lets a guest carry on to payment. The skip lasts
// until the app is restarted. Remove skipIdCheckForNow() (and this flag) when the real check goes live.
let skippedForNow = false;
export const skipIdCheckForNow = () => { skippedForNow = true; };

// Whether this guest may book right now: verified, or has chosen "Maybe later" this session.
export async function canBook(): Promise<boolean> {
    return skippedForNow || (await isIdVerified());
}

// What to do once the ID screen is dismissed with "Maybe later" (e.g. carry on to the cart / payment).
let afterIdGate: (() => void) | null = null;
export const setAfterIdGate = (fn: () => void) => { afterIdGate = fn; };
export const runAfterIdGate = () => { const fn = afterIdGate; afterIdGate = null; fn?.(); };

// Route to the ID screen with a reason and where to come back to once verified.
export const idVerificationHref = (returnTo: string) =>
    `/onboarding/id-verification?reason=book&returnTo=${encodeURIComponent(returnTo)}` as const;
