import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, ShieldCheck, MoreVertical, Flag, Ban } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { palette, type, fonts } from '@/constants/theme';
import {
  fetchPeople, markConversationRead, otherPersonId, MAX_MESSAGE_LENGTH,
  fetchBlockedIds, blockUser, unblockUser, reportUser, REPORT_REASONS, type ReportReason,
  type Conversation, type Message,
} from '@/lib/messaging';
import { useCurrentUserId } from '@/lib/useCurrentUserId';

const PAGE_SIZE = 50;

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useCurrentUserId();
  const [messages, setMessages] = useState<Message[]>([]); // newest first, for the inverted list
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sheet, setSheet] = useState<null | 'menu' | 'report'>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const { data: conversation, isLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('conversations').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Conversation;
    },
    enabled: !!id,
  });

  const otherId = conversation && me ? otherPersonId(conversation, me) : null;
  const iAmGuest = !!conversation && conversation.guest_id === me;
  const { data: people } = useQuery({
    queryKey: ['conversation-person', otherId, iAmGuest],
    queryFn: () => fetchPeople([otherId as string], iAmGuest ? [otherId as string] : []),
    enabled: !!otherId,
  });
  const other = otherId ? people?.[otherId] : undefined;

  const { data: blockedIds = [] } = useQuery({
    queryKey: ['blocked', me],
    queryFn: () => fetchBlockedIds(me as string),
    enabled: !!me,
  });
  const iBlocked = !!otherId && blockedIds.includes(otherId);

  const markRead = useCallback(() => {
    if (!id) return;
    markConversationRead(id).then(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }));
  }, [id, queryClient]);

  // History, then live updates for anything the other person sends while this screen is open.
  useEffect(() => {
    if (!id) return;
    let active = true;

    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data }) => { if (active && data) setMessages(prev => mergeMessages(prev, data as Message[])); });

    const channel = supabase
      .channel(`conversation:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        payload => {
          setMessages(prev => mergeMessages(prev, [payload.new as Message]));
          markRead();
        }
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [id, markRead]);

  useFocusEffect(useCallback(() => { markRead(); }, [markRead]));

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !id || !me) return;
    setSending(true);
    setSendError('');
    // The saved row comes back with any contact details already hidden, so we show exactly what the other person sees.
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: id, sender_id: me, body })
      .select()
      .single();
    setSending(false);
    if (error || !data) {
      // Same wording whichever side blocked, so nobody learns who did.
      setSendError(error?.message?.includes('blocked')
        ? "You can't message this person."
        : "Couldn't send that. Check your connection and try again.");
      return;
    }
    setDraft('');
    setMessages(prev => mergeMessages(prev, [data as Message]));
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  const refreshBlocks = () => {
    queryClient.invalidateQueries({ queryKey: ['blocked', me] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['unread-chats'] });
  };

  const confirmBlock = () => {
    if (!me || !otherId) return;
    setSheet(null);
    Alert.alert(
      `Block ${other?.name || 'this person'}?`,
      "They won't be able to message you, and you won't be able to message them. You can unblock them any time from this chat.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try { await blockUser(me, otherId); refreshBlocks(); }
            catch { Alert.alert("Couldn't block", 'Please try again.'); }
          },
        },
      ]
    );
  };

  const doUnblock = async () => {
    if (!me || !otherId) return;
    try { await unblockUser(me, otherId); refreshBlocks(); }
    catch { Alert.alert("Couldn't unblock", 'Please try again.'); }
  };

  const submitReport = async (reason: ReportReason) => {
    if (!me || !otherId || !id) return;
    setSheet(null);
    try {
      await reportUser({ me, reportedId: otherId, conversationId: id, reason });
      Alert.alert('Report sent', `Thanks for letting us know. We'll review it. Do you also want to block ${other?.name || 'them'}?`, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: async () => { try { await blockUser(me, otherId); refreshBlocks(); } catch {} } },
      ]);
    } catch {
      Alert.alert("Couldn't send the report", 'Please check your connection and try again.');
    }
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const mine = item.sender_id === me;
    // Show the time when the next-older message is from someone else or more than 10 minutes earlier.
    const older = messages[index + 1];
    const showTime = !older || older.sender_id !== item.sender_id ||
      new Date(item.created_at).getTime() - new Date(older.created_at).getTime() > 10 * 60 * 1000;
    return (
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginTop: showTime ? 10 : 3 }}>
        <View style={{
          maxWidth: '80%',
          backgroundColor: mine ? palette.accent : palette.surface,
          borderRadius: 18,
          borderBottomRightRadius: mine ? 6 : 18,
          borderBottomLeftRadius: mine ? 18 : 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}>
          <Text style={{ ...type.body, color: mine ? 'white' : palette.ink }}>{item.body}</Text>
        </View>
        {item.was_masked && (
          <Text style={{ ...type.micro, color: palette.muted, marginTop: 3 }}>For safety and booking protection, contact details unlock after your booking is confirmed.</Text>
        )}
        {showTime && !item.was_masked && (
          <Text style={{ ...type.micro, color: palette.muted, marginTop: 3 }}>{format(new Date(item.created_at), 'h:mm a')}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }} edges={['top']}>
      <View style={{ backgroundColor: palette.surface, paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={palette.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!iAmGuest || !otherId}
          onPress={() => otherId && router.push(`/cook/${otherId}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
          activeOpacity={0.7}
        >
          {other?.avatarUrl ? (
            <Image source={{ uri: other.avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: palette.skeleton }} />
          ) : (
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...type.card, fontFamily: fonts.bold, color: 'white' }}>{(other?.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text numberOfLines={1} style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink, flex: 1 }}>{other?.name || ' '}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSheet('menu')}
          accessibilityLabel="More options"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 4 }}
        >
          <MoreVertical size={22} color={palette.ink} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 8 }}>
        <ShieldCheck size={14} color={palette.muted} />
        <Text style={{ ...type.meta, color: palette.muted, flex: 1 }}>
          Phone numbers, emails and links stay hidden until a booking is made.
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            inverted
            keyExtractor={m => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListEmptyComponent={
              <View style={{ transform: [{ scaleY: -1 }], alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
                <Text style={{ ...type.body, color: palette.muted, textAlign: 'center' }}>
                  {iAmGuest ? `Ask ${other?.name || 'the host'} anything about their table.` : 'No messages yet.'}
                </Text>
              </View>
            }
          />
        )}

        {!!sendError && (
          <Text style={{ ...type.meta, color: palette.accent, paddingHorizontal: 24, paddingBottom: 4 }}>{sendError}</Text>
        )}
        {iBlocked ? (
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: palette.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text style={{ ...type.body, color: palette.muted, flex: 1 }}>You blocked {other?.name || 'this person'}.</Text>
              <TouchableOpacity onPress={doUnblock} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: palette.accent }}>
                <Text style={{ ...type.body, fontFamily: fonts.bold, color: palette.accent }}>Unblock</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        ) : (
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: palette.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message"
              placeholderTextColor={palette.muted}
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
              style={{
                ...type.body,
                flex: 1,
                maxHeight: 110,
                color: palette.ink,
                backgroundColor: palette.canvas,
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: 10,
              }}
            />
            <TouchableOpacity
              onPress={send}
              disabled={!draft.trim() || sending}
              accessibilityLabel="Send message"
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: palette.accent,
                opacity: !draft.trim() || sending ? 0.45 : 1,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {sending ? <ActivityIndicator color="white" /> : <Send size={18} color="white" />}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        )}
      </KeyboardAvoidingView>

      {/* ⋮ menu and report reasons */}
      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable onPress={() => setSheet(null)} style={{ flex: 1, backgroundColor: 'rgba(61,37,30,0.4)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 }}>
            {sheet === 'report' ? (
              <>
                <Text style={{ ...type.section, color: palette.ink, marginBottom: 4 }}>Report {other?.name || 'this person'}</Text>
                <Text style={{ ...type.body, color: palette.muted, marginBottom: 12 }}>What's the problem?</Text>
                {REPORT_REASONS.map(r => (
                  <TouchableOpacity key={r.key} onPress={() => submitReport(r.key)} style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: palette.inkWash }}>
                    <Text style={{ ...type.card, color: palette.ink }}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setSheet('report')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
                  <Flag size={20} color={palette.ink} />
                  <Text style={{ ...type.card, color: palette.ink }}>Report {other?.name || 'this person'}</Text>
                </TouchableOpacity>
                {iBlocked ? (
                  <TouchableOpacity onPress={() => { setSheet(null); doUnblock(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: palette.inkWash }}>
                    <Ban size={20} color={palette.ink} />
                    <Text style={{ ...type.card, color: palette.ink }}>Unblock</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={confirmBlock} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: palette.inkWash }}>
                    <Ban size={20} color={palette.accent} />
                    <Text style={{ ...type.card, color: palette.accent }}>Block</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// Newest first, no duplicates (a message can arrive both from our own insert and from the live channel).
function mergeMessages(existing: Message[], incoming: Message[]) {
  const byId = new Map<string, Message>();
  [...existing, ...incoming].forEach(m => byId.set(m.id, m));
  return Array.from(byId.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
