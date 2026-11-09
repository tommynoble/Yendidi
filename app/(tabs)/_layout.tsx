import React, { useCallback, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Animated, Easing } from 'react-native';
import { Home, Compass, Plus, LayoutDashboard, MessageCircle } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import ForkKnifeIcon from '@/components/ForkKnifeIcon';
import WatchlistIcon from '@/components/WatchlistIcon';
import ProfileOutlineIcon from '@/components/ProfileOutlineIcon';
import KitchenPotIcon from '@/components/KitchenPotIcon';
import { palette } from '@/constants/theme';
import { unreadMessageCount } from '@/lib/messaging';
import { useCurrentUserId } from '@/lib/useCurrentUserId';

const fullBleedScene = { backgroundColor: palette.canvas, paddingHorizontal: 0 };

export default function TabLayout() {
  const isCookMode = useAppStore(state => state.isCookMode);
  const currentUserId = useCurrentUserId();
  const { data: unreadChats = 0 } = useQuery({
    queryKey: ['unread-chats', currentUserId],
    queryFn: () => unreadMessageCount(currentUserId as string),
    enabled: !!currentUserId,
    refetchInterval: 60000,
  });

  // Tapping the host's Post button spins the plus half a turn and gives the circle a quick pop.
  const plusSpin = useRef(new Animated.Value(0)).current;
  const spinPlus = useCallback(() => {
    plusSpin.setValue(0);
    Animated.timing(plusSpin, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [plusSpin]);

  const HomeIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      {isCookMode ? <LayoutDashboard size={22} color={color} strokeWidth={focused ? 2 : 1.5} /> : <Home size={22} color={color} strokeWidth={focused ? 2 : 1.5} />}
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 2 }}>{isCookMode ? 'Dashboard' : 'Home'}</Text>
    </View>
  ), [isCookMode]);

  const ExploreIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      <View>
        {isCookMode ? <MessageCircle size={22} color={color} strokeWidth={focused ? 2 : 1.5} /> : <Compass size={22} color={color} strokeWidth={focused ? 2 : 1.5} />}
        {isCookMode && unreadChats > 0 && (
          <View style={{ position: 'absolute', top: -1, right: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: palette.accent, borderWidth: 1.5, borderColor: palette.canvas }} />
        )}
      </View>
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 2 }}>{isCookMode ? 'Messages' : 'Explore'}</Text>
    </View>
  ), [isCookMode, unreadChats]);

  const CookIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64, marginTop: isCookMode ? -36 : 0 }}>
      {isCookMode ? (
        <Animated.View
          className="rounded-full items-center justify-center border-4 border-white"
          style={{
            width: 56, height: 56, top: 4, backgroundColor: '#573223', shadowColor: '#573223', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.24, shadowRadius: 9, elevation: 8,
            transform: [{ scale: plusSpin.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1.12, 1] }) }],
          }}
        >
          <Animated.View style={{ transform: [{ rotate: plusSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Plus size={23} color="white" strokeWidth={2.5} />
          </Animated.View>
        </Animated.View>
      ) : (
        <WatchlistIcon size={24} color={color} isSaved={focused} />
      )}
      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: isCookMode ? '500' : focused ? '600' : '500', color: isCookMode ? palette.inkSoft : color, marginTop: isCookMode ? 11 : 2 }}>{isCookMode ? 'Post' : 'Watchlist'}</Text>
    </View>
  ), [isCookMode, plusSpin]);

  const OrdersIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      <ForkKnifeIcon size={22} color={color} strokeWidth={focused ? 2.6 : 2.1} />
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 2 }}>{isCookMode ? 'Bookings' : 'Orders'}</Text>
    </View>
  ), [isCookMode]);

  const ProfileIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      {isCookMode ? <KitchenPotIcon size={24} color={color} /> : <ProfileOutlineIcon size={24} color={color} strokeWidth={focused ? 2 : 1.75} />}
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 2 }}>{isCookMode ? 'Kitchen' : 'Profile'}</Text>
    </View>
  ), [isCookMode]);

  const MeIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      <ProfileOutlineIcon size={24} color={color} strokeWidth={focused ? 2 : 1.75} />
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 2 }}>Profile</Text>
    </View>
  ), []);

  // Guests: Home, Explore, Watchlist, Orders, Profile. Hosts: Dashboard, Bookings, Post (centre), Kitchen, Profile.
  // The host's Messages tab (explore) is hidden, and the `me` tab is host-only.
  const screenOptions: Record<string, any> = {
    index: { tabBarIcon: HomeIcon },
    explore: { href: isCookMode ? null : undefined, tabBarIcon: ExploreIcon, sceneStyle: fullBleedScene },
    cook: { tabBarIcon: CookIcon, sceneStyle: fullBleedScene },
    orders: { tabBarIcon: OrdersIcon, sceneStyle: fullBleedScene },
    profile: { tabBarIcon: ProfileIcon },
    me: { href: isCookMode ? undefined : null, tabBarIcon: MeIcon },
  };
  const tabOrder = isCookMode
    ? ['index', 'orders', 'cook', 'profile', 'me', 'explore']
    : ['index', 'explore', 'cook', 'orders', 'profile', 'me'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // No outer side margin: each page sets its own padding, and the tab bar spans the full screen width.
        sceneStyle: { backgroundColor: palette.canvas, paddingHorizontal: 0 },
        tabBarStyle: {
          backgroundColor: palette.canvas,
          borderTopColor: '#DDC1B6',
          borderTopWidth: 1,
          height: 88,
          paddingTop: 10,
          zIndex: 9999,
          elevation: 24,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          shadowColor: '#231915',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.11,
          shadowRadius: 12,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.inkSoft,
      }}
    >
      {tabOrder.map((name) => (
        <Tabs.Screen key={name} name={name} options={screenOptions[name]} listeners={name === 'cook' && isCookMode ? { tabPress: spinPlus } : undefined} />
      ))}
    </Tabs>
  );
}
