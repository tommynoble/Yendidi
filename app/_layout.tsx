import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaystackProvider } from 'react-native-paystack-webview';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { ErrorBoundary, Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';
import './global.css';

export { ErrorBoundary };

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const queryClient = new QueryClient();
const paystackKey = process.env.EXPO_PUBLIC_PAYSTACK_KEY || '';

// Keep splash screen visible until fonts are loaded.
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.warn('SplashScreen.preventAutoHideAsync error:', e);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // Redirect to onboarding whenever Supabase fires SIGNED_OUT — this covers
  // both explicit sign-out and background token refresh failures where
  // autoRefreshToken exhausts its retries and clears the session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/onboarding');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const [loaded, error] = useFonts({
    DMSerifDisplay_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch((e) => {
        // Silently fail if splash screen is already hidden or not registered
        console.warn('SplashScreen.hideAsync error:', e);
      });
    }
  }, [loaded, error]);

  return (
    <QueryClientProvider client={queryClient}>
      <PaystackProvider publicKey={paystackKey}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FDFBF7' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
            <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="cook/[id]" />
            <Stack.Screen name="meal/[id]" />
            <Stack.Screen name="cart" options={{ presentation: 'card' }} />
          </Stack>
        </ThemeProvider>
      </PaystackProvider>
    </QueryClientProvider>
  );
}
