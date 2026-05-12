import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Home, Compass, Plus, Receipt, User, LayoutDashboard, BookOpen, Heart, ChefHat } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';

export default function TabLayout() {
  const { isCookMode } = useAppStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F3F4F6',
          height: 90,
          paddingTop: 10,
          zIndex: 9999,
          elevation: 9999,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#D65A31',
        tabBarInactiveTintColor: '#9CA3AF',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View className="items-center justify-center" style={{ width: 60 }}>
              {isCookMode ? (
                <LayoutDashboard size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
              ) : (
                <Home size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
              )}
              <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>
                {isCookMode ? 'Dashboard' : 'Home'}
              </Text>
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: isCookMode ? '/(tabs)/explore/list' : '/(tabs)/explore/map',
          tabBarIcon: ({ color, focused }) => (
            <View className="items-center justify-center" style={{ width: 60 }}>
              {isCookMode ? (
                <BookOpen size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
              ) : (
                <Compass size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
              )}
              <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>
                {isCookMode ? 'Menu' : 'Explore'}
              </Text>
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="cook"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View className="items-center justify-center" style={{ width: 60, marginTop: isCookMode ? -20 : 0 }}>
              {isCookMode ? (
                <View className="w-14 h-14 bg-text-main rounded-full shadow-lg items-center justify-center border-4 border-white">
                  <Plus size={28} color="white" strokeWidth={3} />
                </View>
              ) : (
                <Heart size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
              )}
              <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: isCookMode ? '500' : focused ? '600' : '500', color: isCookMode ? '#6B7280' : color, marginTop: 4 }}>
                {isCookMode ? 'Post' : 'Saved'}
              </Text>
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View className="items-center justify-center" style={{ width: 60 }}>
              <Receipt size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
              <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>
                {isCookMode ? 'Requests' : 'Orders'}
              </Text>
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View className="items-center justify-center" style={{ width: 60 }}>
              {isCookMode ? (
                <ChefHat size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
              ) : (
                <User size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
              )}
              <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: focused ? '600' : '500', marginTop: 4 }}>
                {isCookMode ? 'Kitchen' : 'Profile'}
              </Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
