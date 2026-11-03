import { supabase } from '@/lib/supabase';

export type Conversation = {
    id: string;
    guest_id: string;
    cook_id: string;
    last_message: string | null;
    last_sender_id: string | null;
    last_message_at: string;
    guest_last_read_at: string;
    cook_last_read_at: string;
};

export type Message = {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    was_masked: boolean;
    created_at: string;
};

export type Person = { id: string; name: string; avatarUrl: string | null };

export const MAX_MESSAGE_LENGTH = 2000;

export const isUnread = (c: Conversation, me: string) => {
    const myLastRead = c.guest_id === me ? c.guest_last_read_at : c.cook_last_read_at;
    return !!c.last_sender_id && c.last_sender_id !== me && new Date(c.last_message_at) > new Date(myLastRead);
};

export const otherPersonId = (c: Conversation, me: string) => (c.guest_id === me ? c.cook_id : c.guest_id);

// Opens the chat with a host, creating it the first time.
export async function openConversationWithHost(cookId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_or_create_conversation', { p_cook_id: cookId });
    if (error) throw error;
    return data as string;
}

// Host side: opens (or creates) the chat with a guest who has a paid booking.
export async function openConversationWithGuest(guestId: string): Promise<string> {
    const { data, error } = await supabase.rpc('start_conversation_with_guest', { p_guest_id: guestId });
    if (error) throw error;
    return data as string;
}

export async function fetchConversations(me: string): Promise<{ conversations: Conversation[]; people: Record<string, Person>; blockedIds: string[] }> {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`guest_id.eq.${me},cook_id.eq.${me}`)
        .order('last_message_at', { ascending: false });
    if (error) throw error;

    const conversations = (data || []) as Conversation[];
    const people = await fetchPeople(
        conversations.map(c => otherPersonId(c, me)),
        conversations.filter(c => c.guest_id === me).map(c => c.cook_id) // the people who are the host in their chat
    );
    const blockedIds = await fetchBlockedIds(me);
    return { conversations, people, blockedIds };
}

// Hosts show under their kitchen name; guests always show under their own name.
export async function fetchPeople(ids: string[], hostIds: string[] = []): Promise<Record<string, Person>> {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return {};
    const { data } = await supabase.from('profiles').select('id, full_name, kitchen_name, avatar_url').in('id', unique);
    const people: Record<string, Person> = {};
    (data || []).forEach((p: any) => {
        people[p.id] = { id: p.id, name: (hostIds.includes(p.id) && p.kitchen_name) || p.full_name || 'Guest', avatarUrl: p.avatar_url || null };
    });
    return people;
}

export async function markConversationRead(conversationId: string) {
    await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
}

export async function unreadMessageCount(me: string): Promise<number> {
    const { conversations, blockedIds } = await fetchConversations(me).catch(() => ({ conversations: [] as Conversation[], blockedIds: [] as string[] }));
    return conversations.filter(c => isUnread(c, me) && !blockedIds.includes(otherPersonId(c, me))).length;
}

export type ReportReason = 'spam_or_scam' | 'harassment' | 'inappropriate' | 'off_platform_contact' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
    { key: 'spam_or_scam', label: 'Spam or a scam' },
    { key: 'harassment', label: 'Harassment or abuse' },
    { key: 'inappropriate', label: 'Inappropriate content' },
    { key: 'off_platform_contact', label: 'Asking to pay or talk outside the app' },
    { key: 'other', label: 'Something else' },
];

// People I have blocked.
export async function fetchBlockedIds(me: string): Promise<string[]> {
    const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', me);
    return (data || []).map((b: any) => b.blocked_id);
}

export async function blockUser(me: string, otherId: string) {
    const { error } = await supabase.from('user_blocks').upsert({ blocker_id: me, blocked_id: otherId });
    if (error) throw error;
}

export async function unblockUser(me: string, otherId: string) {
    const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', me).eq('blocked_id', otherId);
    if (error) throw error;
}

export async function reportUser(args: { me: string; reportedId: string; conversationId: string; reason: ReportReason; details?: string }) {
    const { error } = await supabase.from('message_reports').insert({
        reporter_id: args.me,
        reported_id: args.reportedId,
        conversation_id: args.conversationId,
        reason: args.reason,
        details: args.details?.trim() || null,
    });
    if (error) throw error;
}
