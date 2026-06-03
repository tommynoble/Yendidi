import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { Clock, CheckCircle, ChefHat, ShoppingBag, ChevronRight, XCircle, Flame, Bike, Check, X, CookingPot, User } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { getDishImage } from '@/constants/Images';

// Types for our order structure
type Order = {
    id: string;
    status: 'New' | 'Accepted' | 'Cooking' | 'Ready' | 'Completed' | 'Cancelled';
    total: number;
    created_at: string;
    delivery_method?: string;
    payment_status?: string;
    payment_method?: string;
    user_id?: string;
    cook_id?: string;
    order_items: {
        quantity: number;
        price_at_purchase?: number;
        listings: {
            title: string;
            image: string | null;
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
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
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

                // Fetch eater profiles for each order
                const ordersWithEaters = await Promise.all(
                    (data || []).map(async (order: any) => {
                        const { data: eater } = await supabase
                            .from('profiles')
                            .select('full_name, avatar_url, phone')
                            .eq('id', order.user_id)
                            .single();
                        return { ...order, eater };
                    })
                );

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
        fetchOrders();
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
        Alert.alert('Accept Order', 'Start preparing this order?', [
            { text: 'Not Yet', style: 'cancel' },
            { text: 'Accept', onPress: () => updateOrderStatus(orderId, 'Accepted') },
        ]);
    };

    const handleReject = (orderId: string) => {
        Alert.alert('Decline Order', 'Are you sure you want to decline this order?', [
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
        if (activeTab === 'active') {
            return ['New', 'Accepted', 'Cooking', 'Ready'].includes(order.status);
        } else {
            return ['Completed', 'Cancelled'].includes(order.status);
        }
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

    // ---- COOK MODE ORDER CARD ----
    const renderCookOrderItem = ({ item }: { item: Order }) => {
        const firstItem = item.order_items[0];
        const listing = firstItem?.listings;
        const itemCount = item.order_items.length;
        const isUpdating = updatingId === item.id;

        return (
            <View
                className="bg-white mx-6 mb-4 rounded-3xl p-4"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
            >
                {/* Header: Eater Info & Status */}
                <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden border border-gray-100">
                            {item.eater?.avatar_url ? (
                                <Image source={{ uri: item.eater.avatar_url }} className="w-full h-full" />
                            ) : (
                                <View className="w-full h-full items-center justify-center bg-blue-50">
                                    <User size={20} color="#3B82F6" />
                                </View>
                            )}
                        </View>
                        <View>
                            <Text className="font-bold text-text-main font-sans-bold text-base">
                                {item.eater?.full_name || 'Customer'}
                            </Text>
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

                <View className="h-[1px] bg-gray-50 w-full mb-3" />

                {/* Items List */}
                {item.order_items.map((oi: any, idx: number) => (
                    <View key={idx} className="flex-row items-center gap-3 mb-2">
                        <View className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden">
                            <Image source={getDishImage(oi.listings?.title, oi.listings?.image)} className="w-full h-full" resizeMode="cover" />
                        </View>
                        <Text className="flex-1 text-text-main font-sans text-sm" numberOfLines={1}>
                            {oi.listings?.title || 'Item'} × {oi.quantity}
                        </Text>
                        <Text className="text-text-main font-sans-bold text-sm font-bold">
                            ₵{((oi.price_at_purchase || 0) * oi.quantity).toFixed(2)}
                        </Text>
                    </View>
                ))}

                {/* Total & Payment */}
                <View className="flex-row justify-between items-center mt-2 pt-3 border-t border-gray-50">
                    <View className="flex-row items-center gap-2">
                        {item.payment_status === 'success' && (
                            <View className="flex-row items-center gap-1 bg-green-50 px-2 py-1 rounded-full">
                                <CheckCircle size={12} color="#007A33" />
                                <Text className="text-kente-green text-[10px] font-bold font-sans-bold">Paid</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-clay-primary font-bold font-sans-bold text-lg">₵{item.total.toFixed(2)}</Text>
                </View>

                {/* Cook Action Buttons */}
                {item.status === 'New' && (
                    <View className="flex-row gap-3 mt-4">
                        <TouchableOpacity
                            className="flex-1 bg-red-50 py-3 rounded-xl flex-row items-center justify-center gap-2 border border-red-100"
                            onPress={() => handleReject(item.id)}
                            disabled={isUpdating}
                        >
                            <X size={18} color="#DC2626" />
                            <Text className="text-red-600 font-bold font-sans-bold">Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 bg-kente-green py-3 rounded-xl flex-row items-center justify-center gap-2"
                            onPress={() => handleAccept(item.id)}
                            disabled={isUpdating}
                        >
                            {isUpdating ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Check size={18} color="white" />
                                    <Text className="text-white font-bold font-sans-bold">Accept</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {['Accepted', 'Cooking', 'Ready'].includes(item.status) && (
                    <TouchableOpacity
                        className="mt-4 bg-clay-primary py-3 rounded-xl flex-row items-center justify-center gap-2"
                        onPress={() => handleAdvance(item.id, item.status)}
                        disabled={isUpdating}
                    >
                        {isUpdating ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                {item.status === 'Accepted' && <><CookingPot size={18} color="white" /><Text className="text-white font-bold font-sans-bold">Start Cooking</Text></>}
                                {item.status === 'Cooking' && <><CheckCircle size={18} color="white" /><Text className="text-white font-bold font-sans-bold">Mark Ready</Text></>}
                                {item.status === 'Ready' && <><Check size={18} color="white" /><Text className="text-white font-bold font-sans-bold">Complete Order</Text></>}
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // ---- EATER MODE ORDER CARD ----
    const renderEaterOrderItem = ({ item }: { item: Order }) => {
        const firstItem = item.order_items[0];
        const listing = firstItem?.listings;
        const cook = listing?.profiles;
        const itemCount = item.order_items.length;
        const otherItemsCount = itemCount - 1;

        return (
            <TouchableOpacity
                className="bg-white mx-6 mb-4 rounded-3xl p-4 active:scale-[0.98]"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
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
                            <Text className="font-bold text-text-main font-sans-bold text-base">{cook?.full_name || 'Unknown Cook'}</Text>
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
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <View className="flex-1 bg-warm-cream">
            {/* Header */}
            <View className="px-6 pt-3 pb-4 bg-white border-b border-gray-100">
                <View className="mb-4">
                    <Text className="text-xl font-bold text-text-main font-sans-bold">
                        {isCookMode ? 'Incoming Orders' : 'Your Orders'}
                    </Text>
                    <Text className="text-sm text-text-sub font-sans">
                        {isCookMode ? 'Manage orders from your customers' : 'Track your recent and past meals'}
                    </Text>
                </View>

                {/* Tabs */}
                <View className="flex-row bg-gray-100 p-1 rounded-xl">
                    <TouchableOpacity
                        className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'active' ? 'bg-white' : ''}`}
                        style={activeTab === 'active' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 1.5, elevation: 1 } : {}}
                        onPress={() => setActiveTab('active')}
                    >
                        <Text className={`font-bold font-sans-bold ${activeTab === 'active' ? 'text-text-main' : 'text-gray-400'}`}>
                            {isCookMode ? 'Pending' : 'Active'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'history' ? 'bg-white' : ''}`}
                        style={activeTab === 'history' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 1.5, elevation: 1 } : {}}
                        onPress={() => setActiveTab('history')}
                    >
                        <Text className={`font-bold font-sans-bold ${activeTab === 'history' ? 'text-text-main' : 'text-gray-400'}`}>History</Text>
                    </TouchableOpacity>
                </View>
            </View>

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
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D65A31" colors={["#D65A31"]} />}
                    ListEmptyComponent={() => (
                        <View className="items-center justify-center py-20 px-10">
                            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                                <ShoppingBag size={40} color="#9CA3AF" />
                            </View>
                            <Text className="text-lg font-bold text-text-main font-sans-bold mb-2">
                                {isCookMode
                                    ? (activeTab === 'active' ? 'No pending orders' : 'No completed orders yet')
                                    : `No ${activeTab} orders`}
                            </Text>
                            <Text className="text-text-sub text-center font-sans mb-8">
                                {isCookMode
                                    ? (activeTab === 'active' ? 'New orders from customers will appear here.' : 'Completed and cancelled orders will show here.')
                                    : (activeTab === 'active'
                                        ? "Hungry? Explore local cooks and place your first order!"
                                        : "You haven't completed any orders yet.")}
                            </Text>
                            {!isCookMode && activeTab === 'active' && (
                                <TouchableOpacity
                                    className="bg-clay-primary px-8 py-3 rounded-xl active:scale-95"
                                    onPress={() => router.push('/(tabs)')}
                                >
                                    <Text className="text-white font-bold font-sans-bold">Find Food</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                />
            )}
            </View>
        </SafeAreaView>
    );
}
