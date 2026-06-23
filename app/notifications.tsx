import React, { useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Check, Flame, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

// Static app-level promos / announcements
const STATIC_PROMOS = [
  {
    id: 'promo-1',
    type: 'promo',
    title: 'Weekend Special 🔥',
    message: '20% off all orders this Saturday! Use code YENDIDII20',
    time: '3 hours ago',
    read: true,
    image: null,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
];

const getStatusTitle = (status: string) => {
  switch (status) {
    case 'Accepted': return 'Order Accepted! 🎉';
    case 'Cooking': return 'Cooking Started 👨‍🍳';
    case 'Ready': return 'Your Order is Ready! 🍽️';
    case 'Completed': return 'Order Completed ✅';
    case 'Declined': return 'Order Declined';
    default: return 'Order Update';
  }
};

const getStatusMessage = (status: string, cookName: string, dishName: string) => {
  switch (status) {
    case 'Accepted': return `${cookName} accepted your ${dishName} request. Get ready!`;
    case 'Cooking': return `${cookName} has started cooking your ${dishName}.`;
    case 'Ready': return `Your ${dishName} is ready for pickup!`;
    case 'Completed': return `You enjoyed your ${dishName}. Hope it was delicious!`;
    case 'Declined': return `${cookName} couldn't take your ${dishName} order this time.`;
    default: return `Your order for ${dishName} has been updated.`;
  }
};

const getIcon = (type: string) => {
  switch (type) {
    case 'order_accepted': return <Check size={18} color="#007A33" />;
    case 'declined': return <Bell size={18} color="#EF4444" />;
    case 'cook_nearby': return <MapPin size={18} color="#D65A31" />;
    case 'promo': return <Flame size={18} color="#D65A31" />;
    default: return <Bell size={18} color="#D65A31" />;
  }
};

const getBgColor = (type: string) => {
  switch (type) {
    case 'order_accepted': return '#DCFCE7';
    case 'declined': return '#FEE2E2';
    case 'cook_nearby': return '#FFF0EB';
    case 'promo': return '#FEF3C7';
    default: return '#F3F4F6';
  }
};

const NotificationRow = React.memo(({ item, readIds, onPress }: { item: any; readIds: Set<string>; onPress: (id: string) => void }) => {
  const isRead = item.read || readIds.has(item.id);
  return (
    <TouchableOpacity
      onPress={() => {
        onPress(item.id);
        item.onPress?.();
      }}
      className={`px-6 py-4 flex-row gap-4 border-b border-gray-50 ${isRead ? 'bg-white' : ''}`}
      style={!isRead ? { backgroundColor: 'rgba(214, 90, 49, 0.05)' } : {}}
      activeOpacity={0.7}
    >
      {item.image ? (
        <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#F3F4F6' }}>
          <Image source={{ uri: item.image }} style={{ width: 48, height: 48 }} resizeMode="cover" />
        </View>
      ) : (
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: getBgColor(item.type), alignItems: 'center', justifyContent: 'center' }}>
          {getIcon(item.type)}
        </View>
      )}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-semibold text-text-main flex-1 font-sans-semibold" numberOfLines={1}>
            {item.title}
          </Text>
          {!isRead && <View className="w-2 h-2 bg-clay-primary rounded-full" />}
        </View>
        <Text className="text-sm text-text-sub mt-1 font-sans leading-relaxed" numberOfLines={2}>
          {item.message}
        </Text>
        <Text className="text-xs text-text-sub mt-2 font-sans">{item.time}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default function NotificationsScreen() {
  const router = useRouter();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['user-notif'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
  });

  // Fetch user's recent orders with cook + dish info
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['notifications-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          updated_at,
          profiles:cook_id (full_name, avatar_url),
          order_items (
            listings (title, image)
          )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(15);

      if (error) {
        console.error('Notifications orders fetch error:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
    refetchIntervalInBackground: false, // pause polling when app is backgrounded
  });

  // Fetch nearby approved cooks
  const { data: nearbyCooks = [] } = useQuery({
    queryKey: ['nearby-cooks-notif'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, location')
        .eq('role', 'COOK')
        .eq('cook_application_status', 'approved')
        .limit(2);
      return data || [];
    },
  });

  // Build notification list from real orders
  const orderNotifications = orders
    .filter((o: any) => o.status !== 'New') // "New" = just placed, not a real update yet
    .map((o: any) => {
      const cook = Array.isArray(o.profiles) ? (o.profiles.length > 0 ? o.profiles[0] : null) : o.profiles;
      const firstItem = o.order_items?.[0];
      const listing = Array.isArray(firstItem?.listings) ? (firstItem.listings.length > 0 ? firstItem.listings[0] : null) : firstItem?.listings;
      const dishName = listing?.title || 'your dish';
      const cookName = cook?.full_name || 'Your cook';
      const updatedAt = new Date(o.updated_at || o.created_at);

      return {
        id: `order-${o.id}`,
        type: o.status === 'Declined' ? 'declined' : 'order_accepted',
        title: getStatusTitle(o.status),
        message: getStatusMessage(o.status, cookName, dishName),
        time: formatDistanceToNow(updatedAt, { addSuffix: true }),
        read: readIds.has(`order-${o.id}`),
        image: cook?.avatar_url || null,
        createdAt: updatedAt,
        onPress: () => router.push('/(tabs)/orders'),
      };
    });

  // Cook nearby notifications from real cooks
  const cookNearbyNotifications = nearbyCooks.slice(0, 1).map((cook: any) => ({
    id: `cook-nearby-${cook.id}`,
    type: 'cook_nearby',
    title: 'Cook Nearby 📍',
    message: `${cook.full_name} is available to cook near ${cook.location?.split(',')[0] || 'you'}!`,
    time: 'Recently',
    read: readIds.has(`cook-nearby-${cook.id}`),
    image: cook.avatar_url || null,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    onPress: () => router.push('/(tabs)/explore/map'),
  }));

  // Merge all notifications sorted by date
  const allNotifications = [
    ...orderNotifications,
    ...cookNearbyNotifications,
    ...STATIC_PROMOS,
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const todayNotifs = allNotifications.filter(n => {
    const diffHours = (Date.now() - n.createdAt.getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
  });
  const earlierNotifs = allNotifications.filter(n => {
    const diffHours = (Date.now() - n.createdAt.getTime()) / (1000 * 60 * 60);
    return diffHours >= 24;
  });

  const unreadCount = allNotifications.filter(n => !n.read && !readIds.has(n.id)).length;

  const markAllRead = () => {
    setReadIds(new Set(allNotifications.map(n => n.id)));
  };

  const handleMarkRead = useCallback((id: string) => {
    setReadIds(prev => new Set([...prev, id]));
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-1 bg-warm-cream">

        {/* Header */}
        <View className="bg-white px-6 py-4 flex-row items-center gap-4 border-b border-gray-100">
          <TouchableOpacity onPress={() => router.back()} className="p-1">
            <ArrowLeft size={24} color="#2D241E" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-text-main font-sans-bold">Notifications</Text>
            {unreadCount > 0 && (
              <Text className="text-xs text-text-sub font-sans">{unreadCount} unread</Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead}>
              <Text className="text-sm text-clay-primary font-semibold font-sans-semibold">Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#D65A31" />
          </View>
        ) : (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

            {/* Today */}
            {todayNotifs.length > 0 && (
              <>
                <View className="px-6 pt-5 pb-2">
                  <Text className="text-xs font-semibold text-text-sub uppercase tracking-widest font-sans-semibold">Today</Text>
                </View>
                {todayNotifs.map(n => <NotificationRow key={n.id} item={n} readIds={readIds} onPress={handleMarkRead} />)}
              </>
            )}

            {/* Earlier */}
            {earlierNotifs.length > 0 && (
              <>
                <View className="px-6 pt-6 pb-2">
                  <Text className="text-xs font-semibold text-text-sub uppercase tracking-widest font-sans-semibold">Earlier</Text>
                </View>
                {earlierNotifs.map(n => <NotificationRow key={n.id} item={n} readIds={readIds} onPress={handleMarkRead} />)}
              </>
            )}

            {/* Empty state */}
            {allNotifications.length === 0 && (
              <View className="flex-1 items-center justify-center py-24 px-6">
                <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                  <Bell size={36} color="#9CA3AF" />
                </View>
                <Text className="text-lg font-bold text-text-main font-sans-bold mb-2">All caught up!</Text>
                <Text className="text-text-sub text-center font-sans">
                  You'll see order updates and cook alerts here.
                </Text>
              </View>
            )}

            <View className="h-24" />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
