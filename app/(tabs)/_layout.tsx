import React, { useCallback } from 'react';
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Home, Compass, Plus, Receipt, User, LayoutDashboard, BookOpen, Heart, ChefHat } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';

export default function TabLayout() {
  const isCookMode = useAppStore(state => state.isCookMode);

  const HomeIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 60 }}>
      {isCookMode ? <LayoutDashboard size={24} color={color} strokeWidth={focused ? 2.5 : 2} /> : <Home size={24} color={color} strokeWidth={focused ? 2.5 : 2} />}
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>{isCookMode ? 'Dashboard' : 'Home'}</Text>
    </View>
  ), [isCookMode]);

  const ExploreIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 60 }}>
      {isCookMode ? <BookOpen size={24} color={color} strokeWidth={focused ? 2.5 : 2} /> : <Compass size={24} color={color} strokeWidth={focused ? 2.5 : 2} />}
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>{isCookMode ? 'Menu' : 'Explore'}</Text>
    </View>
  ), [isCookMode]);

  const CookIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 60, marginTop: isCookMode ? -20 : 0 }}>
      {isCookMode ? (
        <View className="w-14 h-14 bg-text-main rounded-full shadow-lg items-center justify-center border-4 border-white">
          <Plus size={24} color="white" strokeWidth={3} />
        </View>
      ) : (
        <Heart size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
      )}
      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: isCookMode ? '500' : focused ? '600' : '500', color: isCookMode ? '#6B7280' : color, marginTop: 4 }}>{isCookMode ? 'Post' : 'Saved'}</Text>
    </View>
  ), [isCookMode]);

  const OrdersIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 60 }}>
      <Receipt size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>{isCookMode ? 'Requests' : 'Orders'}</Text>
    </View>
  ), [isCookMode]);

  const ProfileIcon = useCallback(({ color, focused }: { color: string; focused: boolean }) => (
    <View className="items-center justify-center" style={{ width: 60 }}>
      {isCookMode ? <ChefHat size={24} color={color} strokeWidth={focused ? 2.5 : 2} /> : <User size={24} color={color} strokeWidth={focused ? 2.5 : 2} />}
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>{isCookMode ? 'Kitchen' : 'Profile'}</Text>
    </View>
  ), [isCookMode]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E0D8',
          borderTopWidth: 0.5,
          height: 100,
          paddingTop: 12,
          zIndex: 9999,
          elevation: 24,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          shadowColor: '#2D241E',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#D65A31',
        tabBarInactiveTintColor: '#9CA3AF',
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
