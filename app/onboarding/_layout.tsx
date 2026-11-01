import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="community" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="id-verification" />
      <Stack.Screen name="permissions" />
    </Stack>
  );
}
