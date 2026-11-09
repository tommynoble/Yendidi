import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaystackProvider } from 'react-native-paystack-webview';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { ErrorBoundary, Stack, useRouter, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { clearUserData, claimDeviceForUser } from '@/lib/session';
import PageTransitionLoader from '@/components/PageTransitionLoader';
import IntroOverlay from '@/components/IntroOverlay';
import { palette } from '@/constants/theme';
import './global.css';

// Crash and error reporting. Only starts when a DSN is set (and never in development), so it is off until you add
// EXPO_PUBLIC_SENTRY_DSN. Errors only: no performance tracing, and no personal data (email, phone, IP) is attached.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn && !__DEV__) {
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: sentryDsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend(event: any) {
        // Drop anything that identifies the person; keep the error itself.
        if (event.user) event.user = { id: event.user.id };
        return event;
      },
    });
  } catch (e) {
    console.warn('Sentry failed to start:', e);
  }
}

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
  const pathname = usePathname();
  const [showTransitionLoader, setShowTransitionLoader] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Brief bouncing-dots indicator on every route change, so navigation feels alive
  // without blocking the new screen underneath it.
  useEffect(() => {
    setShowTransitionLoader(true);
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => setShowTransitionLoader(false), 500);
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, [pathname]);

  // Redirect to onboarding whenever Supabase fires SIGNED_OUT — this covers
  // both explicit sign-out and background token refresh failures where
  // autoRefreshToken exhausts its retries and clears the session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Nothing from this account (cart, saved dishes, cached results, answers) may carry over to the next person.
        clearUserData(queryClient);
        setTimeout(() => router.replace('/onboarding/community'), 0);
      }
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        // A different account on the same phone also starts clean.
        claimDeviceForUser(session.user.id, queryClient);
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        registerForPushNotificationsAsync().catch((e) => console.warn('Push registration error:', e));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Tapping a "new message" notification opens that conversation.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const conversationId = response.notification.request.content.data?.conversationId;
      if (typeof conversationId === 'string') router.push(`/messages/${conversationId}`);
    });
    return () => sub.remove();
  }, []);

  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
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

  // Draw nothing until the fonts are ready (the splash screen stays up meanwhile). Text drawn earlier is measured with a
  // fallback font and never re-measured, so bold headings ("YenDidii", "Gathering Nearby") ended up cut off with "…".
  if (!loaded && !error) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <PaystackProvider publicKey={paystackKey} currency="GHS" defaultChannels={['card', 'mobile_money']}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 6 } }}>
            {/* the intro screen: edge to edge (no 6px side padding); its own orange covers the first moments, so this is the page colour */}
            <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="login" />
            <Stack.Screen name="onboarding" options={{ animation: 'none', contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'none', contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="notifications" options={{ presentation: 'card', contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="messages/index" options={{ presentation: 'card', contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="messages/[id]" options={{ presentation: 'card', contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="cook/[id]" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="meal/[id]" />
            <Stack.Screen name="listing/[id]" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="pass/[id]" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="account" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="business-overview" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="personal-information" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="kitchen-settings" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="address/index" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="payment-methods" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="privacy-security" options={{ contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
            <Stack.Screen name="cart" options={{ presentation: 'card', contentStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 } }} />
          </Stack>
          <PageTransitionLoader visible={showTransitionLoader} />
          {/* the intro video sits on top of the whole app until its first screen has opened and painted */}
          <IntroOverlay />
        </ThemeProvider>
      </PaystackProvider>
    </QueryClientProvider>
  );
}
