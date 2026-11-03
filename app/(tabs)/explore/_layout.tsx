import { Stack } from 'expo-router';
import { useAppStore } from '@/lib/store';
import MessagesInbox from '@/components/MessagesInbox';

export default function ExploreLayout() {
    const isCookMode = useAppStore(state => state.isCookMode);

    // In Kitchen Mode this tab is the host's Messages inbox, not the guest map.
    if (isCookMode) return <MessagesInbox showBack={false} />;

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="map" />
        </Stack>
    );
}
