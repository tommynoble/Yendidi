import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { MessageCircle, Clock, CheckCircle, ChefHat, ShoppingBag, ChevronRight, XCircle, Flame, Bike, Check, X, CookingPot, User } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { getDishImage } from '@/constants/Images';
import ProcessLoader from '@/components/ProcessLoader';
import { palette, type, fonts } from '@/constants/theme';
import { openConversationWithGuest } from '@/lib/messaging';
import { format, formatDistanceToNow } from 'date-fns';
import ScreenHeader from '@/components/ScreenHeader';

// Types for our order structure
type Order = {
    id: string;
    status: 'New' | 'Accepted' | 'Cooking' | 'Ready' | 'Completed' | 'Cancelled';
    total: number;
    created_at: string;
    delivery_method?: string;
    payment_status?: string;
    payment_method?: string;
    notes?: string | null;
    user_id?: string;
    cook_id?: string;
    order_items: {
        quantity: number;
        price_at_purchase?: number;
        listings: {
            title: string;
            image: string | null;
            order_deadline?: string | null;
            profiles: {
                full_name: string | null;
                avatar_url: string | null;
                kitchen_image_url: string | null;
            } | null;
        } | null;
    }[];
    // For cook mode — the eater's profile
    eater?: {
        full_name: string | null;
        avatar_url: string | null;
        phone: string | null;
    } | null;
};

const NEXT_STATUS: Record<string, string> = {
    'Accepted': 'Cooking',
    'Cooking': 'Ready',
    'Ready': 'Completed',
};

export default function OrdersScreen() {
    const router = useRouter();
    const { isCookMode } = useAppStore();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [activeTab, setActiveTab] = useState<string>(isCookMode ? 'pending' : 'active');
    const [refreshing, setRefreshing] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchOrders = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            if (isCookMode) {
                // Cook mode: fetch orders where I'm the cook
                const { data, error } = await supabase
                    .from('orders')
                    .select(`
                        *,
                        order_items (
                            quantity,
                            price_at_purchase,
                            listings (
                                title,
                                image,
                                order_deadline,
                                profiles (
                                    full_name,
                                    avatar_url,
                                    kitchen_image_url
                                )
                            )
                        )
                    `)
                    .eq('cook_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Batch-fetch all eater profiles in a single query instead of one-per-order
                const userIds = [...new Set((data || []).map((o: any) => o.user_id).filter(Boolean))];
                let eaterMap: Record<string, any> = {};
                if (userIds.length > 0) {
                    const { data: eaterProfiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url, phone')
                        .in('id', userIds);
                    eaterMap = Object.fromEntries((eaterProfiles || []).map((p: any) => [p.id, p]));
                }
                const ordersWithEaters = (data || []).map((order: any) => ({
                    ...order,
                    eater: eaterMap[order.user_id] || null,
                }));

                setOrders(ordersWithEaters as any);
            } else {
                // Eater mode: fetch orders I placed
                const { data, error } = await supabase
                    .from('orders')
                    .select(`
                        *,
                        order_items (
                            quantity,
                            price_at_purchase,
                            listings (
                                title,
                                image,
                                profiles (
                                    full_name,
                                    avatar_url,
                                    kitchen_image_url
                                )
                            )
                        )
                    `)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setOrders((data || []) as any);
            }
        } catch (error) {
            // silently fail
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setActiveTab(isCookMode ? 'pending' : 'active');
        fetchOrders();
    }, [isCookMode]);

    // New bookings and status changes arrive live, so a host sees a request the moment a guest pays.
    useEffect(() => {
        if (!isCookMode) return;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let channel: any = null;
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            channel = supabase
                .channel(`cook-bookings:${Math.random().toString(36).slice(2)}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `cook_id=eq.${user.id}` }, () => {
                    if (timer) clearTimeout(timer);
                    timer = setTimeout(() => fetchOrders(), 400);
                })
                .subscribe();
        })();
        return () => {
            if (timer) clearTimeout(timer);
            if (channel) supabase.removeChannel(channel);
        };
    }, [isCookMode]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchOrders();
    }, [isCookMode]);

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        setUpdatingId(orderId);
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;
            fetchOrders();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not update order status');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleAccept = (orderId: string) => {
        Alert.alert('Accept Booking', 'Confirm these seats and start preparing?', [
            { text: 'Not Yet', style: 'cancel' },
            { text: 'Accept', onPress: () => updateOrderStatus(orderId, 'Accepted') },
        ]);
    };

    const handleReject = (orderId: string) => {
        Alert.alert('Decline Booking', 'This booking is already paid. Declining cancels it, and the guest is not refunded automatically yet, so message them to sort it out. Decline anyway?', [
            { text: 'Keep', style: 'cancel' },
            { text: 'Decline', style: 'destructive', onPress: () => updateOrderStatus(orderId, 'Cancelled') },
        ]);
    };

    const handleAdvance = (orderId: string, currentStatus: string) => {
        const next = NEXT_STATUS[currentStatus];
        if (!next) return;

        const messages: Record<string, string> = {
            'Cooking': 'Mark this order as cooking?',
            'Ready': 'Mark this order as ready for pickup?',
            'Completed': 'Mark this order as completed?',
        };

        Alert.alert('Update Status', messages[next] || `Move to "${next}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', onPress: () => updateOrderStatus(orderId, next) },
        ]);
    };

    const filteredOrders = orders.filter(order => {
        if (activeTab === 'pending') return order.status === 'New';
        if (activeTab === 'confirmed') return ['Accepted', 'Cooking', 'Ready'].includes(order.status);
        if (activeTab === 'active') return ['New', 'Accepted', 'Cooking', 'Ready'].includes(order.status);
        return ['Completed', 'Cancelled'].includes(order.status);
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'New': return 'bg-blue-100 text-blue-800';
            case 'Accepted': return 'bg-yellow-100 text-yellow-800';
            case 'Cooking': return 'bg-orange-100 text-orange-800';
            case 'Ready': return 'bg-green-100 text-green-800';
            case 'Completed': return 'bg-gray-100 text-gray-800';
            case 'Cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'New': return <Clock size={14} color="#1E40AF" />;
            case 'Accepted': return <ChefHat size={14} color="#854D0E" />;
            case 'Cooking': return <Flame size={14} color="#9A3412" />;
            case 'Ready': return <Bike size={14} color="#166534" />;
            case 'Completed': return <CheckCircle size={14} color="#374151" />;
            case 'Cancelled': return <XCircle size={14} color="#991B1B" />;
            default: return <Clock size={14} color="#374151" />;
        }
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Recently';
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return 'Recently';
        }
    };

    // Host starts a chat with a guest who has paid for an order.
    const handleMessageGuest = useCallback(async (guestId?: string) => {
        if (!guestId) return;
        try {
            const conversationId = await openConversationWithGuest(guestId);
            router.push(`/messages/${conversationId}`);
        } catch (e) {
            Alert.alert("Couldn't open the chat", 'Please check your connection and try again.');
        }
    }, [router]);

    // ---- COOK MODE BOOKING CARD ----
    const bookingLook = (status: string) => {
        switch (status) {
            case 'New': return { label: 'Needs your reply', bg: '#FFF4E0', border: '#F2D9A8', color: '#9A5B00' };
            case 'Accepted': return { label: 'Confirmed', bg: '#FFF1EC', border: 'rgba(194, 83, 39,0.35)', color: palette.accent };
            case 'Cooking': return { label: 'Cooking', bg: '#FFF1EC', border: 'rgba(194, 83, 39,0.35)', color: palette.accent };
            case 'Ready': return { label: 'Ready', bg: '#F0FFF8', border: '#B2DFCC', color: '#006A3C' };
            case 'Completed': return { label: 'Completed', bg: '#F0FFF8', border: '#B2DFCC', color: '#006A3C' };
            case 'Cancelled': return { label: 'Declined', bg: '#FDEDED', border: '#F2C2C2', color: '#B3261E' };
            default: return { label: status, bg: palette.surface, border: palette.skeleton, color: palette.muted };
        }
    };

    const renderCookOrderItem = useCallback(({ item }: { item: Order }) => {
        const isUpdating = updatingId === item.id;
        const look = bookingLook(item.status);
        const first = item.order_items[0];
        const listing = first?.listings;
        const seats = item.order_items.reduce((n, oi) => n + (oi.quantity || 1), 0);
        const extra = item.order_items.length - 1;
        const guestName = item.eater?.full_name || 'Guest';
        const when = listing?.order_deadline ? new Date(listing.order_deadline) : null;
        const whenLabel = when && !isNaN(when.getTime()) ? format(when, 'EEE, MMM d • h:mm a') : formatDate(item.created_at);
        const seatLabel = `${seats} ${seats === 1 ? 'Seat' : 'Seats'}`;
        const canMessage = item.payment_status === 'success' && item.status !== 'Cancelled' && !!item.user_id;

        return (
            <View style={{ backgroundColor: palette.surface, marginHorizontal: 24, marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)', shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 1 }}>
                {/* Guest, seats and amount */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {item.eater?.avatar_url ? (
                        <Image source={{ uri: item.eater.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: palette.accent, backgroundColor: palette.canvas }} />
                    ) : (
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF1EC', borderWidth: 2, borderColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}>
                            <User size={20} color={palette.accent} />
                        </View>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink }}>{guestName}</Text>
                        <Text numberOfLines={1} style={{ ...type.meta, color: palette.inkSoft, marginTop: 2 }}>{seatLabel} • {whenLabel}</Text>
                    </View>
                    <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.accent }}>₵{Number(item.total).toFixed(2)}</Text>
                </View>

                {/* Event */}
                <Text numberOfLines={2} style={{ ...type.body, fontFamily: fonts.semibold, color: palette.ink, marginTop: 12 }}>
                    {listing?.title || 'Event'}{extra > 0 ? `  + ${extra} more` : ''}
                </Text>

                {/* Status and payment */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: look.bg, borderWidth: 1, borderColor: look.border }}>
                        <Text style={{ ...type.micro, color: look.color }}>{look.label}</Text>
                    </View>
                    {item.payment_status === 'success' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: '#F0FFF8', borderWidth: 1, borderColor: '#B2DFCC' }}>
                            <CheckCircle size={11} color="#006A3C" />
                            <Text style={{ ...type.micro, color: '#006A3C' }}>Paid</Text>
                        </View>
                    )}
                </View>

                {/* What the guest told you (allergies, requests) */}
                {!!item.notes && (
                    <View style={{ backgroundColor: '#FFF1EC', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.25)' }}>
                        <Text style={{ ...type.micro, color: palette.accent, letterSpacing: 0.8, marginBottom: 3 }}>GUEST NOTE</Text>
                        <Text style={{ ...type.body, color: palette.ink, fontStyle: 'italic' }}>"{item.notes}"</Text>
                    </View>
                )}

                {item.status === 'New' && (
                    <Text style={{ ...type.meta, color: '#9A5B00', marginTop: 12 }}>
                        Waiting for your reply · booked {formatDistanceToNow(new Date(item.created_at))} ago
                    </Text>
                )}

                {/* Decline / Accept */}
                {item.status === 'New' && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                        <TouchableOpacity
                            onPress={() => handleReject(item.id)}
                            disabled={isUpdating}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(61, 37, 30, 0.3)', alignItems: 'center' }}
                        >
                            <Text style={{ ...type.body, fontFamily: fonts.bold, color: palette.inkSoft }}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleAccept(item.id)}
                            disabled={isUpdating}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            style={{ flex: 1.5, paddingVertical: 13, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', opacity: isUpdating ? 0.7 : 1 }}
                        >
                            {isUpdating ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Text style={{ ...type.body, fontFamily: fonts.bold, color: 'white' }}>Accept ({seatLabel})</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Next step once confirmed */}
                {['Accepted', 'Cooking', 'Ready'].includes(item.status) && (
                    <TouchableOpacity
                        onPress={() => handleAdvance(item.id, item.status)}
                        disabled={isUpdating}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        style={{ marginTop: 14, paddingVertical: 13, borderRadius: 12, backgroundColor: palette.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: isUpdating ? 0.7 : 1 }}
                    >
                        {isUpdating ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                {item.status === 'Accepted' && <><CookingPot size={18} color="white" /><Text style={{ ...type.body, fontFamily: fonts.bold, color: 'white' }}>Start Cooking</Text></>}
                                {item.status === 'Cooking' && <><CheckCircle size={18} color="white" /><Text style={{ ...type.body, fontFamily: fonts.bold, color: 'white' }}>Mark Ready</Text></>}
                                {item.status === 'Ready' && <><Check size={18} color="white" /><Text style={{ ...type.body, fontFamily: fonts.bold, color: 'white' }}>Complete Booking</Text></>}
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {canMessage && (
                    <TouchableOpacity
                        onPress={() => handleMessageGuest(item.user_id)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: palette.accent }}
                    >
                        <MessageCircle size={16} color={palette.accent} />
                        <Text style={{ ...type.body, fontFamily: fonts.bold, color: palette.accent }}>
                            Message {item.eater?.full_name?.split(' ')[0] || 'guest'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }, [updatingId, handleReject, handleAccept, handleAdvance, handleMessageGuest]);

    // ---- EATER MODE ORDER CARD ----
    const renderEaterOrderItem = useCallback(({ item }: { item: Order }) => {
        const firstItem = item.order_items[0];
        const listing = firstItem?.listings;
        const cook = listing?.profiles;
        const otherItemsCount = item.order_items.length - 1;

        return (
            <TouchableOpacity
                className="bg-surface mx-6 mb-4 rounded-3xl p-4 active:scale-[0.98]"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 8, elevation: 2 }}
                activeOpacity={0.9}
                onPress={() => router.push(`/order/${item.id}`)}
            >
                {/* Header: Cook Info & Status */}
                <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden border border-gray-100">
                            {cook?.kitchen_image_url || cook?.avatar_url ? (
                                <Image source={{ uri: (cook.kitchen_image_url || cook.avatar_url) ?? undefined }} className="w-full h-full" />
                            ) : (
                                <View className="w-full h-full items-center justify-center" style={{ backgroundColor: 'rgba(214, 90, 49, 0.1)' }}>
                                    <ChefHat size={20} color="#D65A31" />
                                </View>
                            )}
                        </View>
                        <View>
                            <Text className="font-bold text-text-main font-sans-bold text-base">{cook?.full_name || 'Unknown Host'}</Text>
                            <Text className="text-xs text-text-sub font-sans">{formatDate(item.created_at)}</Text>
                        </View>
                    </View>

                    <View className={`px-2.5 py-1 rounded-full flex-row items-center gap-1 ${getStatusColor(item.status).split(' ')[0]}`}>
                        {getStatusIcon(item.status)}
                        <Text className={`text-xs font-bold font-sans-bold ${getStatusColor(item.status).split(' ')[1]}`}>
                            {item.status}
                        </Text>
                    </View>
                </View>

                {/* Divider Line */}
                <View className="h-[1px] bg-gray-50 w-full mb-4" />

                {/* Items Summary */}
                <View className="flex-row gap-4 mb-4">
                    <View className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden">
                        <Image source={getDishImage(listing?.title ?? '', listing?.image)} className="w-full h-full" resizeMode="cover" />
                    </View>
                    <View className="flex-1 justify-center">
                        <Text className="text-text-main font-medium font-sans-medium text-base h-auto" numberOfLines={1}>
                            {listing?.title || 'Unknown Item'}
                        </Text>
                        {otherItemsCount > 0 && (
                            <Text className="text-text-sub text-sm font-sans mt-0.5">
                                + {otherItemsCount} other item{otherItemsCount > 1 ? 's' : ''}
                            </Text>
                        )}
                        <Text className="text-clay-primary font-bold font-sans-bold mt-1">
                            ₵{item.total.toFixed(2)}
                        </Text>
                        {item.payment_status === 'success' && (
                            <View className="flex-row items-center gap-1 mt-1">
                                <CheckCircle size={12} color="#007A33" />
                                <Text className="text-kente-green text-[10px] font-bold font-sans-bold">Paid</Text>
                            </View>
                        )}
                    </View>
                    <View className="justify-center">
                        <ChevronRight size={20} color="#E5E7EB" />
                    </View>
                </View>

                {/* Footer / Actions - Only for Active */}
                {activeTab === 'active' && (
                    <View className="mt-2 rounded-xl p-3 flex-row items-center gap-3" style={{ backgroundColor: 'rgba(250, 249, 246, 0.5)' }}>
                        {item.status === 'New' && (
                            <>
                                <ActivityIndicator size="small" color="#D65A31" />
                                <Text className="text-text-sub text-xs font-sans italic flex-1">
                                    Waiting for cook to accept...
                                </Text>
                            </>
                        )}
                        {item.status === 'Accepted' && (
                            <>
                                <ChefHat size={16} color="#854D0E" />
                                <Text className="text-yellow-700 text-xs font-bold font-sans-bold flex-1">
                                    Cook accepted your order!
                                </Text>
                            </>
                        )}
                        {item.status === 'Cooking' && (
                            <>
                                <Flame size={16} color="#D65A31" />
                                <Text className="text-clay-primary text-xs font-bold font-sans-bold flex-1">
                                    Your food is being prepared!
                                </Text>
                            </>
                        )}
                        {item.status === 'Ready' && (
                            <>
                                <Bike size={16} color="#007A33" />
                                <Text className="text-kente-green text-xs font-bold font-sans-bold flex-1">
                                    Ready for pickup!
                                </Text>
                            </>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    }, [updatingId, activeTab, router]);

    const tabList = isCookMode
        ? [
            { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'New').length },
            { key: 'confirmed', label: 'Confirmed', count: 0 },
            { key: 'history', label: 'History', count: 0 },
        ]
        : [
            { key: 'active', label: 'Active', count: 0 },
            { key: 'history', label: 'History', count: 0 },
        ];

    return (
        <SafeAreaView className="flex-1 bg-warm-cream" edges={['bottom']}>
            <View className="flex-1 bg-warm-cream">
            {/* Header */}
            <ScreenHeader
                title={isCookMode ? 'Guest Bookings' : 'Your Orders'}
                subtitle={isCookMode ? 'Review guest bookings and manage seats' : 'Track your recent and past meals'}
            >
                <View style={{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: palette.canvas }}>
                    {tabList.map(t => {
                        const active = activeTab === t.key;
                        return (
                            <TouchableOpacity
                                key={t.key}
                                onPress={() => setActiveTab(t.key)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, backgroundColor: active ? palette.accent : 'transparent' }}
                            >
                                <Text style={{ ...type.body, fontFamily: active ? fonts.bold : fonts.semibold, color: active ? 'white' : palette.inkSoft }}>{t.label}</Text>
                                {t.count > 0 && (
                                    <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: active ? 'white' : palette.accent, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ fontFamily: fonts.bold, fontSize: 10, lineHeight: 13, color: active ? palette.accent : 'white' }}>{t.count}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScreenHeader>

            {/* List */}
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#D65A31" />
                </View>
            ) : (
                <FlatList
                    data={filteredOrders}
                    renderItem={isCookMode ? renderCookOrderItem : renderEaterOrderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingVertical: 20 }}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D65A31" colors={["#D65A31"]} />}
                    ListEmptyComponent={() => {
                        const copy = isCookMode
                            ? activeTab === 'pending'
                                ? { title: 'No pending bookings', text: 'New seat requests from guests for your upcoming events will appear here.', cta: 'View Upcoming Host Days' }
                                : activeTab === 'confirmed'
                                    ? { title: 'No confirmed guests yet', text: 'Bookings you accept will be listed here until the event is done.' }
                                    : { title: 'No past bookings', text: 'Completed and declined bookings will show up here.' }
                            : { title: `No ${activeTab} orders`, text: activeTab === 'active' ? 'Hungry? Explore local hosts and place your first order!' : "You haven't completed any orders yet.", cta: activeTab === 'active' ? 'Find Food' : undefined };
                        return (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 70, paddingHorizontal: 40 }}>
                                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF1EC', borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <ShoppingBag size={32} color={palette.accent} />
                                </View>
                                <Text style={{ ...type.section, color: palette.ink, marginBottom: 6, textAlign: 'center' }}>{copy.title}</Text>
                                <Text style={{ ...type.body, color: palette.muted, textAlign: 'center', marginBottom: copy.cta ? 22 : 0 }}>{copy.text}</Text>
                                {!!copy.cta && (
                                    <TouchableOpacity
                                        onPress={() => router.push(isCookMode ? '/(tabs)/profile' : '/(tabs)')}
                                        activeOpacity={0.85}
                                        accessibilityRole="button"
                                        style={{ backgroundColor: palette.accent, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 }}
                                    >
                                        <Text style={{ ...type.body, fontFamily: fonts.bold, color: 'white' }}>{copy.cta}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    }}
                />
            )}
            </View>

            <ProcessLoader 
                visible={refreshing} 
                message="Updating Orders..."
            />
        </SafeAreaView>
    );
}
