import AsyncStorage from '@react-native-async-storage/async-storage';

const PRIMED_KEY = 'yendidii_permissions_primed';

// Gates the one-time location/notifications priming screen. Keyed to the
// device via AsyncStorage rather than the account, so a reinstall (or a
// second account on the same phone) doesn't skip it, but logging out and
// back in on the same install doesn't repeat it either.
export async function hasPrimedPermissions() {
    return (await AsyncStorage.getItem(PRIMED_KEY)) === 'true';
}

export async function markPermissionsPrimed() {
    await AsyncStorage.setItem(PRIMED_KEY, 'true');
}
