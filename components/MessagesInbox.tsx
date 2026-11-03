import React, { useEffect } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { palette, type, fonts } from '@/constants/theme';
import { fetchConversations, isUnread, otherPersonId, type Conversation } from '@/lib/messaging';
import { useCurrentUserId } from '@/lib/useCurrentUserId';

// The inbox. `showBack` is on for the full-screen route and off when it is a tab.
export default function MessagesInbox({ showBack = true }: { showBack?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useCurrentUserId();
  const { isCookMode } = useAppStore();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['conversations', me],
    queryFn: () => fetchConversations(me as string),
    enabled: !!me,
  });

  // New messages and read markers arrive live, so the list reorders and unread dots update without a refresh.
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`inbox:${me}:${Math.random().toString(36).slice(2)}`) // unique, since the tab and the full-screen inbox can both be open
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversations', me] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me, queryClient]);

  const conversations = data?.conversations || [];
  const people = data?.people || {};
  const blockedIds = data?.blockedIds || [];

  const renderItem = ({ item }: { item: Conversation }) => {
    const person = people[otherPersonId(item, me as string)];
    const blocked = blockedIds.includes(otherPersonId(item, me as string));
    const unread = !blocked && isUnread(item, me as string);
    const name = person?.name || 'Guest';
    return (
      <TouchableOpacity
        onPress={() => router.push(`/messages/${item.id}`)}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 16, padding: 14 }}
      >
        {person?.avatarUrl ? (
          <Image source={{ uri: person.avatarUrl }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: palette.skeleton }} />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ ...type.section, color: 'white' }}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text numberOfLines={1} style={{ ...type.card, fontFamily: unread ? fonts.bold : fonts.semibold, color: palette.ink, flex: 1 }}>{name}</Text>
            <Text style={{ ...type.meta, color: palette.muted }}>
              {item.last_message ? formatDistanceToNowStrict(new Date(item.last_message_at)) : ''}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={{ ...type.body, color: unread ? palette.ink : palette.muted, fontFamily: unread ? fonts.semibold : fonts.regular, marginTop: 2 }}
          >
            {blocked
              ? 'You blocked this person'
              : item.last_message
                ? `${item.last_sender_id === me ? 'You: ' : ''}${item.last_message}`
                : 'Say hello 👋'}
          </Text>
        </View>
        {unread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent }} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScreenHeader
        title="Messages"
        subtitle={isCookMode ? 'Chat with your guests' : 'Your conversations with hosts'}
        left={showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Back">
            <ArrowLeft size={24} color={palette.ink} />
          </TouchableOpacity>
        ) : undefined}
      />

      {!me || isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ ...type.section, color: palette.ink, marginBottom: 4, textAlign: 'center' }}>Couldn't load your messages</Text>
          <Text style={{ ...type.body, color: palette.muted, textAlign: 'center', marginBottom: 16 }}>
            {(error as any)?.message || 'Please check your connection and try again.'}
          </Text>
          <TouchableOpacity onPress={() => refetch()} style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.accent }}>
            <Text style={{ ...type.body, fontFamily: fonts.bold, color: palette.accent }}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <MessageCircle size={32} color={palette.accent} />
          </View>
          <Text style={{ ...type.section, color: palette.ink, marginBottom: 4, textAlign: 'center' }}>No messages yet</Text>
          <Text style={{ ...type.body, color: palette.muted, textAlign: 'center' }}>
            Ask a host a question from their profile and the conversation will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: showBack ? 16 : 120 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.accent} />}
        />
      )}
    </View>
  );
}
