import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Check, CheckCheck, Flame, Utensils, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { palette, fonts } from '@/constants/theme';
import { useNotificationFeed, type NotificationItem } from '@/lib/notificationFeed';

// What each order status looks like: a small icon on the host's photo, in a colour that matches the news.
const STATUS_LOOK: Record<string, { Icon: any; color: string; bg: string }> = {
  Accepted: { Icon: Check, color: '#007A33', bg: '#DCFCE7' },
  Cooking: { Icon: Flame, color: '#C25327', bg: '#FFE7DC' },
  Ready: { Icon: Utensils, color: '#92600A', bg: '#FDEFC8' },
  Completed: { Icon: CheckCheck, color: '#007A33', bg: '#DCFCE7' },
  Declined: { Icon: X, color: '#B3261E', bg: '#FDEDED' },
  Cancelled: { Icon: X, color: '#B3261E', bg: '#FDEDED' },
};
const lookFor = (status: string) => STATUS_LOOK[status] ?? { Icon: Bell, color: palette.accent, bg: '#FFE7DC' };

const NotificationRow = React.memo(({ item, onPress }: { item: NotificationItem; onPress: (item: NotificationItem) => void }) => {
  const { Icon, color, bg } = lookFor(item.status);
  const unread = item.unread;

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.title}. ${item.message}. ${item.time}`}
      style={{
        flexDirection: 'row',
        gap: 14,
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: unread ? 'rgba(194, 83, 39, 0.08)' : palette.surface,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(221, 193, 182, 0.5)',
      }}
    >
      {/* Unread marker down the left edge */}
      {unread && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: palette.accent }} />}

      {/* Host photo (or the status icon on its own) with a small status badge */}
      <View style={{ width: 48, height: 48 }}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F2DFD7', opacity: unread ? 1 : 0.85 }} resizeMode="cover" />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={22} color={color} />
          </View>
        )}
        {item.image && (
          <View style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: bg, borderWidth: 2, borderColor: unread ? '#F7E5DC' : palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={11} color={color} strokeWidth={3} />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: unread ? fonts.bold : fonts.semibold, fontSize: 15, color: unread ? palette.ink : '#56423B' }}>
            {item.title}
          </Text>
          <Text style={{ fontFamily: unread ? fonts.semibold : fonts.regular, fontSize: 12, color: unread ? palette.accent : palette.muted }}>{item.time}</Text>
          {unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.accent }} />}
        </View>
        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: unread ? '#3D2C26' : palette.muted, marginTop: 3 }}>
          {item.message}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

function SectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: palette.muted, textTransform: 'uppercase' }}>{title}</Text>
      {!!count && (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#FFFFFF' }}>{count}</Text>
        </View>
      )}
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, unreadCount, isLoading, markRead, markAllRead } = useNotificationFeed();

  const unread = items.filter((i) => i.unread);
  const earlier = items.filter((i) => !i.unread);

  const open = (item: NotificationItem) => {
    markRead(item.id);
    router.push('/(tabs)/orders');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.surface }} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: palette.canvas }}>
        {/* Header */}
        <View style={{ backgroundColor: palette.surface, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(221, 193, 182, 0.6)' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }} accessibilityLabel="Back">
            <ArrowLeft size={24} color="#2D241E" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: palette.ink }}>Notifications</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: unreadCount > 0 ? palette.accent : palette.muted, marginTop: 1 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllRead}
              accessibilityRole="button"
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, backgroundColor: 'rgba(194, 83, 39, 0.1)', borderWidth: 1, borderColor: 'rgba(194, 83, 39, 0.3)' }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: palette.accent }}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={palette.accent} />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {unread.length > 0 && (
              <>
                <SectionLabel title="New" count={unread.length} />
                {unread.map((n) => <NotificationRow key={n.id} item={n} onPress={open} />)}
              </>
            )}

            {earlier.length > 0 && (
              <>
                <SectionLabel title="Earlier" />
                {earlier.map((n) => <NotificationRow key={n.id} item={n} onPress={open} />)}
              </>
            )}

            {items.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 96, paddingHorizontal: 32 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Bell size={34} color={palette.accent} />
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: palette.ink, marginBottom: 6 }}>You're all caught up</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.muted, textAlign: 'center' }}>
                  When a host accepts, starts cooking or finishes your order, you'll see it here.
                </Text>
              </View>
            )}

            <View style={{ height: 96 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
