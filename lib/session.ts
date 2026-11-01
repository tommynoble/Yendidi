import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';

// Everything stored on the phone (or cached in memory) that belongs to the signed-in person. It must never survive
// into the next person's session, so it is wiped on sign-out and whenever a different account signs in.
const USER_SCOPED_KEYS = [
    'yendidii_favorites',          // saved dishes (Watchlist)
    'yendidii_favorite_cooks',     // saved hosts
    'yendidii_guest_preferences',  // sign-up taste answers
];
const OWNER_KEY = 'yendidii_data_owner';

export async function clearUserData(queryClient?: QueryClient) {
    queryClient?.clear();                                              // in-memory cached results from the old account
    useAppStore.setState({ cartItems: [], userName: '', isCookMode: false }); // cart, name, kitchen mode
    await AsyncStorage.multiRemove(USER_SCOPED_KEYS).catch(() => {});
}

// Call whenever a session appears. If this account isn't the one whose data is on this phone, clear that data first,
// then record the new owner. A phone with no recorded owner (data saved before this check existed) is treated the same
// way, once, because there's no way to know whose saved dishes those are.
export async function claimDeviceForUser(userId: string, queryClient?: QueryClient) {
    try {
        const owner = await AsyncStorage.getItem(OWNER_KEY);
        if (owner !== userId) {
            await clearUserData(queryClient);
            await AsyncStorage.setItem(OWNER_KEY, userId);
        }
    } catch {}
}
