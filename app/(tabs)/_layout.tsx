import React, { useCallback } from 'react';
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Home, Compass, Plus, Receipt, User, LayoutDashboard, BookOpen, Heart, ChefHat } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';

export default function TabLayout() {
  const isCookMode = useAppStore(state => state.isCookMode);

  const HomeIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      {isCookMode ? <LayoutDashboard size={26} color={color} strokeWidth={focused ? 2 : 1.5} /> : <Home size={26} color={color} strokeWidth={focused ? 2 : 1.5} />}
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>{isCookMode ? 'Dashboard' : 'Home'}</Text>
    </View>
  ), [isCookMode]);

  const ExploreIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      {isCookMode ? <BookOpen size={26} color={color} strokeWidth={focused ? 2 : 1.5} /> : <Compass size={26} color={color} strokeWidth={focused ? 2 : 1.5} />}
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>{isCookMode ? 'Menu' : 'Explore'}</Text>
    </View>
  ), [isCookMode]);

  const CookIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64, marginTop: isCookMode ? -20 : 0 }}>
      {isCookMode ? (
        <View className="w-14 h-14 bg-text-main rounded-full shadow-lg items-center justify-center border-4 border-white">
          <Plus size={26} color="white" strokeWidth={2.5} />
        </View>
      ) : (
        <Heart size={26} color={color} strokeWidth={focused ? 2 : 1.5} />
      )}
      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: isCookMode ? '500' : focused ? '600' : '500', color: isCookMode ? '#6B7280' : color, marginTop: 4 }}>{isCookMode ? 'Post' : 'Saved'}</Text>
    </View>
  ), [isCookMode]);

  const OrdersIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      <Receipt size={26} color={color} strokeWidth={focused ? 2 : 1.5} />
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>{isCookMode ? 'Requests' : 'Orders'}</Text>
    </View>
  ), [isCookMode]);

  const ProfileIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 64 }}>
      {isCookMode ? <ChefHat size={26} color={color} strokeWidth={focused ? 2 : 1.5} /> : <User size={26} color={color} strokeWidth={focused ? 2 : 1.5} />}
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>{isCookMode ? 'Kitchen' : 'Profile'}</Text>
    </View>
  ), [isCookMode]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFF1EC',
          borderTopColor: '#DDC1B6',
          borderTopWidth: 1,
          height: 108,
          paddingTop: 14,
          zIndex: 9999,
          elevation: 24,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          shadowColor: '#231915',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#BF592B',
        tabBarInactiveTintColor: '#8A7269',
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: HomeIcon }} />
      <Tabs.Screen name="explore" options={{ tabBarIcon: ExploreIcon }} />
      <Tabs.Screen name="cook" options={{ tabBarIcon: CookIcon }} />

      <Tabs.Screen name="orders" options={{ tabBarIcon: OrdersIcon }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}
