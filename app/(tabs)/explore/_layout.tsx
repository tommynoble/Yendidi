import { Stack } from 'expo-router';

export default function ExploreLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }} initialRouteName="map">
            <Stack.Screen name="map" />
            <Stack.Screen name="list" />
        </Stack>
    );
}
