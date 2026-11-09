import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { PUBLIC_QUESTION_IDS, PRIVATE_QUESTION_ID } from '@/constants/guestQuestions';

const PREFS_KEY = 'yendidii_guest_preferences';

// Answers from the sign-up questions, keyed by question id (e.g. { foods: ['rice', 'grills'], travel: ['always'] }).
export type GuestPreferences = Record<string, string[]>;

const pick = (prefs: GuestPreferences, ids: string[]) =>
    Object.fromEntries(ids.filter((id) => prefs[id]?.length).map((id) => [id, prefs[id]]));

// Saves on the phone first (so nothing is lost offline), then to Supabase:
//   public answers  -> profiles.taste_profile   (anyone can see these on the guest's profile)
//   dietary needs   -> guest_dietary            (only the guest and hosts they've booked with)
// A failed upload (e.g. the migration hasn't been run yet) never blocks the user.
export async function savePreferences(prefs: GuestPreferences) {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error: tasteError } = await supabase.from('profiles').update({ taste_profile: pick(prefs, PUBLIC_QUESTION_IDS) }).eq('id', user.id);
        if (tasteError) console.warn('Could not save taste profile:', tasteError.message);
        const { error: dietError } = await supabase.from('guest_dietary').upsert({
            user_id: user.id,
            needs: prefs[PRIVATE_QUESTION_ID] || [],
            updated_at: new Date().toISOString(),
        });
        if (dietError) console.warn('Could not save dietary needs:', dietError.message);
    } catch (e: any) {
        console.warn('Could not sync preferences:', e?.message);
    }
}

// The signed-in guest's own answers: from Supabase when available, otherwise from this phone.
export async function loadPreferences(): Promise<GuestPreferences> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const [{ data: profile }, { data: diet }] = await Promise.all([
                supabase.from('profiles').select('taste_profile').eq('id', user.id).maybeSingle(),
                supabase.from('guest_dietary').select('needs').eq('user_id', user.id).maybeSingle(),
            ]);
            const remote: GuestPreferences = { ...((profile as any)?.taste_profile || {}) };
            if (diet?.needs?.length) remote[PRIVATE_QUESTION_ID] = diet.needs;
            if (Object.keys(remote).length > 0) return remote;
        }
    } catch {}
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    const local: GuestPreferences = raw ? JSON.parse(raw) : {};
    // Answers that only exist on this phone (saved before the database could take them) get uploaded now.
    if (Object.keys(local).length > 0) savePreferences(local).catch(() => {});
    return local;
}

// Another guest's public taste profile — never includes dietary needs.
export async function loadPublicTaste(userId: string): Promise<GuestPreferences> {
    try {
        const { data } = await supabase.from('profiles').select('taste_profile').eq('id', userId).maybeSingle();
        return ((data as any)?.taste_profile as GuestPreferences) || {};
    } catch {
        return {};
    }
}
