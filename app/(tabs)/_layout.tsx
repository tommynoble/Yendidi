import React, { useCallback } from 'react';
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Home, Compass, Plus, User, LayoutDashboard, MessageCircle, Heart, ChefHat } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import ForkKnifeIcon from '@/components/ForkKnifeIcon';
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
    <View className="items-center justify-center" style={{ width: 64, marginTop: isCookMode ? -20 : 0 }}>
      {isCookMode ? (
        <View className="w-14 h-14 bg-text-main rounded-full shadow-lg items-center justify-center border-4 border-white">
          <Plus size={22} color="white" strokeWidth={2.5} />
        </View>
      ) : (
        <Heart size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
      )}
      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: isCookMode ? '500' : focused ? '600' : '500', color: isCookMode ? '#6B7280' : color, marginTop: 2 }}>{isCookMode ? 'Post' : 'Watchlist'}</Text>
    </View>
  ), [isCookMode]);

  const OrdersIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      <ForkKnifeIcon size={22} color={color} strokeWidth={focused ? 2.6 : 2.1} />
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 2 }}>{isCookMode ? 'Bookings' : 'Orders'}</Text>
    </View>
  ), [isCookMode]);

  const ProfileIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      {isCookMode ? <ChefHat size={22} color={color} strokeWidth={focused ? 2 : 1.5} /> : <User size={22} color={color} strokeWidth={focused ? 2 : 1.5} />}
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 2 }}>{isCookMode ? 'Kitchen' : 'Profile'}</Text>
    </View>
  ), [isCookMode]);

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
      <Tabs.Screen name="index" options={{ tabBarIcon: HomeIcon }} />
      <Tabs.Screen name="explore" options={{ tabBarIcon: ExploreIcon, sceneStyle: fullBleedScene }} />
      <Tabs.Screen name="cook" options={{ tabBarIcon: CookIcon, sceneStyle: fullBleedScene }} />

      <Tabs.Screen name="orders" options={{ tabBarIcon: OrdersIcon, sceneStyle: fullBleedScene }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}
