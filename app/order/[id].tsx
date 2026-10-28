import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Phone, MapPin, Clock, Star, Check, ChefHat, Navigation, ShieldCheck, CreditCard, Package, Receipt, X } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getDishImage } from '@/constants/Images';
import { formatPotCountdown } from '@/lib/countdown';

const STATUS_STEPS = [
    { key: 'New', label: 'Placed', icon: Package },
    { key: 'Accepted', label: 'Accepted', icon: Check },
    { key: 'Cooking', label: 'Cooking', icon: ChefHat },
    { key: 'Ready', label: 'Ready', icon: MapPin },
];

const STATUS_ORDER = ['New', 'Accepted', 'Cooking', 'Ready', 'Completed'];

export default function OrderDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const queryClient = useQueryClient();
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    // Fetch real order data from Supabase
    const { data: order, isLoading, error, refetch } = useQuery({
        queryKey: ['order-detail', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        id,
                        quantity,
                        price_at_purchase,
                        listings (
                            id,
                            title,
                            image,
                            prep_time_minutes,
                            location_text,
                            portions_available,
                            order_deadline,
                            profiles (
                                id,
                                full_name,
                                avatar_url,
                                kitchen_image_url,
                                phone,
                                rating,
                                served_count,
                                location,
                                kitchen_name,
                                location_description,
                                latitude,
                                longitude
                            )
                        )
                    )
                `)
                .eq('id', id as string)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // "Join the Pot" — how many seats are booked so far for each scheduled listing
    // in this order, to reconstruct total capacity alongside the live remaining count.
    const potListingIds = (order?.order_items || [])
        .map((item: any) => item.listings?.id)
        .filter(Boolean);
    const { data: potOrderCounts = {} } = useQuery({
        queryKey: ['listing-order-counts', potListingIds],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('order_items')
                .select('listing_id, quantity, orders!inner(status)')
                .in('listing_id', potListingIds)
                .neq('orders.status', 'Cancelled');

            if (error) {
                console.error('Error fetching pot order counts:', error);
                return {};
            }
            const counts: Record<string, number> = {};
            (data || []).forEach((item: any) => {
                counts[item.listing_id] = (counts[item.listing_id] || 0) + item.quantity;
            });
            return counts;
        },
        enabled: potListingIds.length > 0,
    });

    const { data: existingReview } = useQuery({
        queryKey: ['order-review', id],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;
            const { data } = await supabase
                .from('reviews')
                .select('*')
                .eq('order_id', id as string)
                .eq('user_id', user.id)
                .maybeSingle();
            return data;
        },
        enabled: !!id,
    });

    const handleSubmitReview = async () => {
        if (reviewRating === 0 || !order) return;
        setSubmittingReview(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');
            const cookId = order.order_items?.[0]?.listings?.profiles?.id;
            const listingId = order.order_items?.[0]?.listings?.id;
            if (!cookId) throw new Error('Could not find the cook for this order');

            const { error } = await supabase.from('reviews').insert({
                order_id: order.id,
                user_id: user.id,
                cook_id: cookId,
                listing_id: listingId,
                rating: reviewRating,
                comment: reviewComment.trim() || null,
            });
            if (error) throw error;

            setReviewModalVisible(false);
            queryClient.invalidateQueries({ queryKey: ['order-review', id] });
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not submit your review');
        } finally {
            setSubmittingReview(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'New': return '#3B82F6';
            case 'Accepted': return '#D65A31';
            case 'Cooking': return '#F59E0B';
            case 'Ready': return '#007A33';
            case 'Completed': return '#007A33';
            case 'Cancelled': return '#DC2626';
            default: return '#9CA3AF';
        }
    };

    const getPaymentLabel = (method: string | null) => {
        switch (method) {
            case 'momo': return 'Mobile Money';
            case 'momo_mtn': return 'MTN MoMo';
            case 'momo_voda': return 'Vodafone Cash';
            case 'momo_airtel': return 'AirtelTigo';
            case 'card': return 'Card';
            default: return method || 'Unknown';
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
        }) + ' at ' + date.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    };

    const getEstimatedReady = () => {
        if (!order?.created_at) return null;
        const firstItem = order.order_items?.[0];
        const prepMin = firstItem?.listings?.prep_time_minutes || 30;
        const created = new Date(order.created_at);
        const ready = new Date(created.getTime() + prepMin * 60 * 1000);
        return ready.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const handleCancelOrder = () => {
        if (!order || order.status === 'Cancelled' || order.status === 'Completed') return;
        Alert.alert(
            'Cancel Order',
            'Are you sure you want to cancel this order? This cannot be undone.',
            [
                { text: 'Keep Order', style: 'cancel' },
                {
                    text: 'Cancel Order', style: 'destructive', onPress: async () => {
                        const { error } = await supabase
                            .from('orders')
                            .update({ status: 'Cancelled' })
                            .eq('id', order.id);
                        if (error) {
                            Alert.alert('Error', 'Could not cancel order. Please try again.');
                        } else {
                            refetch();
                        }
                    }
                },
            ]
        );
    };

    // Loading
    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-warm-cream items-center justify-center" edges={['top']}>
                <ActivityIndicator size="large" color="#D65A31" />
                <Text className="text-text-sub mt-3 font-sans">Loading order...</Text>
            </SafeAreaView>
        );
    }

    // Error or not found
    if (error || !order) {
        return (
            <SafeAreaView className="flex-1 bg-warm-cream items-center justify-center px-8" edges={['top']}>
                <Text className="text-lg text-text-sub font-sans text-center mb-4">
                    Sorry, we couldn't find that order.
                </Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text className="text-clay-primary font-bold font-sans-bold">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const cook = order.order_items?.[0]?.listings?.profiles;
    const cookLocation = cook?.location || order.order_items?.[0]?.listings?.location_text || null;
    const cookLandmark = cook?.location_description || null;
    const cookKitchenName = cook?.kitchen_name || null;
    const cookLat = cook?.latitude;
    const cookLng = cook?.longitude;
    const currentStepIndex = STATUS_ORDER.indexOf(order.status);
    const isActive = ['New', 'Accepted', 'Cooking', 'Ready'].includes(order.status);
    const isCompleted = order.status === 'Completed';
    const isCancelled = order.status === 'Cancelled';

    const firstItem = order.order_items?.[0];
    const firstItemTitle = firstItem?.listings?.title || 'Meal';
    const extraItemsCount = (order.order_items?.length || 1) - 1;

    return (
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
            <View className="flex-1 bg-warm-cream">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 bg-surface border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()} className="p-2" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <ChevronLeft size={24} color="#BF592B" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-text-main font-sans-bold">Order Details</Text>
                <View className="w-8" />
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                {/* Hero */}
                <View className="px-6 pt-6">
                    <View style={{ height: 160, borderRadius: 24, overflow: 'hidden', position: 'relative' }}>
                        <Image source={getDishImage(firstItemTitle, firstItem?.listings?.image)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '75%', justifyContent: 'flex-end', padding: 16 }}
                        >
                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Order #{String(order.id).slice(0, 8)}
                            </Text>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, color: '#fff', marginTop: 2 }} numberOfLines={1}>
                                {firstItemTitle}{extraItemsCount > 0 ? ` +${extraItemsCount} more` : ''}
                            </Text>
                            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                                Ordered {formatDate(order.created_at)}
                            </Text>
                        </LinearGradient>
                    </View>
                </View>

                {/* Status Card */}
                <View className="bg-surface mx-6 mt-4 rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 }}>
                    <View className="flex-row items-center justify-between mb-5">
                        <View className="flex-row items-center gap-2">
                            <Package size={18} color="#BF592B" />
                            <Text className="text-lg font-bold text-text-main font-sans-bold">Order Status</Text>
                        </View>
                        <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: `${getStatusColor(order.status)}18` }}>
                            <Text className="text-xs font-bold font-sans-bold" style={{ color: getStatusColor(order.status) }}>
                                {order.status === 'Cooking' ? '🔥 Cooking' : order.status}
                            </Text>
                        </View>
                    </View>

                    {/* Progress Steps */}
                    {!isCancelled && (
                        <View className="flex-row items-start mb-6">
                            {STATUS_STEPS.map((step, index) => {
                                const stepIdx = STATUS_ORDER.indexOf(step.key);
                                const isDone = currentStepIndex > stepIdx || isCompleted;
                                const isCurrent = !isCompleted && step.key === order.status;
                                const isReached = isDone || isCurrent;
                                const stepColor = isReached ? getStatusColor(step.key) : '#D4D4D4';
                                const StepIcon = isDone ? Check : step.icon;
                                const prevStepIdx = index > 0 ? STATUS_ORDER.indexOf(STATUS_STEPS[index - 1].key) : -1;
                                const isSegmentFilled = index > 0 && (currentStepIndex > prevStepIdx || isCompleted);

                                return (
                                    <React.Fragment key={step.key}>
                                        {index > 0 && (
                                            <View
                                                style={{
                                                    flex: 1,
                                                    height: 2,
                                                    marginTop: 23,
                                                    borderRadius: 1,
                                                    backgroundColor: isSegmentFilled ? getStatusColor(STATUS_STEPS[index - 1].key) : '#E9E4E1',
                                                }}
                                            />
                                        )}
                                        <View className="items-center" style={{ width: 60 }}>
                                            <View
                                                className="w-12 h-12 rounded-full items-center justify-center"
                                                style={{
                                                    backgroundColor: isReached ? `${stepColor}18` : '#F3F1EF',
                                                    borderWidth: isCurrent ? 2 : 0,
                                                    borderColor: stepColor,
                                                }}
                                            >
                                                <StepIcon size={20} color={stepColor} />
                                            </View>
                                            <Text
                                                numberOfLines={1}
                                                className={`text-xs mt-2 text-center font-sans ${isReached ? 'font-semibold text-text-main' : 'text-text-sub'}`}
                                            >
                                                {step.label}
                                            </Text>
                                        </View>
                                    </React.Fragment>
                                );
                            })}
                        </View>
                    )}

                    {isCancelled && (
                        <View className="bg-red-50 rounded-2xl p-4 flex-row items-center gap-3">
                            <Text style={{ fontSize: 24 }}>❌</Text>
                            <View className="flex-1">
                                <Text className="text-sm font-bold text-red-600 font-sans-bold">Order Cancelled</Text>
                                <Text className="text-xs text-red-500 font-sans">This order was cancelled.</Text>
                            </View>
                        </View>
                    )}

                    {isCompleted && (
                        <View className="bg-green-50 rounded-2xl p-4 flex-row items-center gap-3">
                            <Text style={{ fontSize: 24 }}>✅</Text>
                            <View className="flex-1">
                                <Text className="text-sm font-bold text-green-700 font-sans-bold">Order Completed</Text>
                                <Text className="text-xs text-green-600 font-sans">Enjoy your meal! 🍽️</Text>
                            </View>
                        </View>
                    )}

                    {/* ETA — only for active orders */}
                    {isActive && getEstimatedReady() && (
                        <View className="bg-kente-green/10 rounded-2xl p-4 flex-row items-center gap-3 mt-2">
                            <Clock size={24} color="#007A33" />
                            <View>
                                <Text className="text-sm text-text-sub font-sans">Estimated ready time</Text>
                                <Text className="text-xl font-bold text-kente-green font-sans-bold">{getEstimatedReady()}</Text>
                            </View>
                        </View>
                    )}

                    {/* Pickup Location — shows when order is Ready */}
                    {order.status === 'Ready' && (cookLocation || cookLandmark) && (
                        <View className="bg-green-50 rounded-2xl p-4 mt-3 border border-green-200">
                            <View className="flex-row items-center gap-2 mb-2">
                                <MapPin size={18} color="#007A33" />
                                <Text className="font-bold text-kente-green font-sans-bold text-base">Pickup Location</Text>
                            </View>
                            {cookLocation && (
                                <Text className="text-sm text-text-main font-sans mb-1">{cookLocation}</Text>
                            )}
                            {cookLandmark && (
                                <Text className="text-sm text-text-sub font-sans italic">📍 {cookLandmark}</Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Order Items */}
                <View className="bg-surface mx-6 mt-4 rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 }}>
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-2">
                            <Receipt size={18} color="#BF592B" />
                            <Text className="text-lg font-bold text-text-main font-sans-bold">Your Order</Text>
                        </View>
                        <View className="w-6 h-6 rounded-full bg-clay-primary items-center justify-center">
                            <Text className="text-white text-xs font-sans-bold">{order.order_items?.length || 0}</Text>
                        </View>
                    </View>

                    {order.order_items?.map((item: any, index: number) => {
                        const orderDeadline = item.listings?.order_deadline;
                        const booked = potOrderCounts[item.listings?.id] || 0;
                        const totalSeats = (item.listings?.portions_available || 0) + booked;
                        return (
                            <View key={item.id || index} className={index > 0 ? 'border-t border-gray-100' : ''}>
                                <View className="flex-row gap-4 py-3">
                                    <Image source={getDishImage(item.listings?.title, item.listings?.image)} className="w-20 h-20 rounded-xl" />
                                    <View className="flex-1">
                                        <Text className="font-bold text-text-main font-sans-bold text-base">
                                            {item.listings?.title || 'Meal'}
                                        </Text>
                                        <Text className="text-sm text-text-sub font-sans mt-0.5">Qty: {item.quantity}</Text>
                                        <Text className="text-lg font-bold text-text-main mt-2 font-sans-bold">
                                            ₵{(item.price_at_purchase * item.quantity).toFixed(2)}
                                        </Text>
                                    </View>
                                </View>
                                {orderDeadline && (
                                    <View className="bg-clay-primary/5 rounded-2xl p-3 mb-3 flex-row items-center gap-2">
                                        <Package size={14} color="#D65A31" />
                                        <Text className="text-xs text-text-main font-sans flex-1">
                                            <Text className="font-bold">{formatPotCountdown(orderDeadline)}</Text>
                                            {` · ${item.listings.portions_available} of ${totalSeats} seats remaining`}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}

                    {/* Order Total */}
                    <View className="mt-2 pt-4 border-t border-gray-100 flex-row justify-between items-center">
                        <Text className="font-bold text-text-main font-sans-bold">Total</Text>
                        <Text className="text-xl font-bold text-clay-primary font-sans-bold">₵{order.total?.toFixed(2)}</Text>
                    </View>
                </View>

                {/* Delivery Info */}
                {(order.delivery_method || order.delivery_address || order.notes) && (
                    <View className="bg-surface mx-6 mt-4 rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 }}>
                        <View className="flex-row items-center gap-2 mb-4">
                            <MapPin size={18} color="#BF592B" />
                            <Text className="text-lg font-bold text-text-main font-sans-bold">Delivery</Text>
                        </View>
                        {order.delivery_method && (
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-sm text-text-sub font-sans">Method</Text>
                                <Text className="font-bold text-text-main font-sans-bold">{order.delivery_method}</Text>
                            </View>
                        )}
                        {order.delivery_address && (
                            <View className="mb-2">
                                <Text className="text-sm text-text-sub font-sans mb-1">Address</Text>
                                <Text className="font-sans text-text-main">{order.delivery_address}</Text>
                            </View>
                        )}
                        {order.notes && (
                            <View>
                                <Text className="text-sm text-text-sub font-sans mb-1">Notes</Text>
                                <Text className="font-sans text-text-main">{order.notes}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Payment Info */}
                <View className="bg-surface mx-6 mt-4 rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 }}>
                    <View className="flex-row items-center gap-2 mb-4">
                        <CreditCard size={18} color="#BF592B" />
                        <Text className="text-lg font-bold text-text-main font-sans-bold">Payment</Text>
                    </View>

                    <View className="flex-row items-center gap-3 mb-3">
                        <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center">
                            <ShieldCheck size={20} color="#007A33" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm text-text-sub font-sans">Status</Text>
                            <Text className="font-bold text-kente-green font-sans-bold">
                                {order.payment_status === 'success' ? 'Paid ✓' : order.payment_status || 'Pending'}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-3 mb-3">
                        <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center">
                            <CreditCard size={20} color="#3B82F6" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm text-text-sub font-sans">Method</Text>
                            <Text className="font-bold text-text-main font-sans-bold">
                                {getPaymentLabel(order.payment_method)}
                            </Text>
                        </View>
                    </View>

                    {order.payment_reference && (
                        <View className="bg-gray-50 rounded-xl p-3 mt-1">
                            <Text className="text-[10px] text-text-sub font-sans uppercase tracking-wider">Reference</Text>
                            <Text className="text-xs text-text-main font-sans mt-0.5" numberOfLines={1}>
                                {order.payment_reference}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Cook Info */}
                {cook && (
                    <View className="bg-surface mx-6 mt-4 rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 }}>
                        <View className="flex-row items-center gap-2 mb-4">
                            <ChefHat size={18} color="#BF592B" />
                            <Text className="text-lg font-bold text-text-main font-sans-bold">Your Host</Text>
                        </View>
                        <View className="flex-row items-center gap-4 mb-4">
                            {cook.kitchen_image_url || cook.avatar_url ? (
                                <Image source={{ uri: cook.kitchen_image_url || cook.avatar_url }} className="w-16 h-16 rounded-full border-2 border-clay-primary/20" />
                            ) : (
                                <View className="w-16 h-16 rounded-full bg-clay-primary/15 items-center justify-center border-2 border-clay-primary/20">
                                    <ChefHat size={28} color="#D65A31" />
                                </View>
                            )}
                            <View className="flex-1">
                                <Text className="font-bold text-text-main text-lg font-sans-bold">{cookKitchenName || cook.full_name || 'Home Host'}</Text>
                                {cookKitchenName && cook.full_name && (
                                    <Text className="text-xs text-text-sub font-sans">by {cook.full_name}</Text>
                                )}
                                <View className="flex-row items-center gap-2 mt-1">
                                    <Star size={14} color="#FFCD00" fill="#FFCD00" />
                                    <Text className="text-sm text-text-main font-sans">{cook.rating ? Number(cook.rating).toFixed(1) : 'New'}</Text>
                                    <Text className="text-sm text-text-sub font-sans">• {cook.served_count || 0}+ served</Text>
                                </View>
                                {cookLocation && (
                                    <View className="flex-row items-center gap-1 mt-1">
                                        <MapPin size={12} color="#D65A31" />
                                        <Text className="text-xs text-text-sub font-sans">{cookLocation}</Text>
                                    </View>
                                )}
                                {cookLandmark && (
                                    <Text className="text-xs text-text-sub font-sans italic mt-0.5">📍 {cookLandmark}</Text>
                                )}
                            </View>
                        </View>

                        {/* Call + Directions */}
                        {(cook.phone || (cookLat && cookLng)) && (
                            <View className="flex-row gap-3">
                                {cook.phone && (
                                    <TouchableOpacity
                                        className="flex-1 bg-gray-50 py-3 rounded-xl flex-row items-center justify-center gap-2 border border-gray-100"
                                        onPress={() => Linking.openURL(`tel:${cook.phone}`)}
                                    >
                                        <Phone size={16} color="#231915" />
                                        <Text className="text-text-main font-bold font-sans-bold text-sm">Call Host</Text>
                                    </TouchableOpacity>
                                )}
                                {cookLat && cookLng && (
                                    <TouchableOpacity
                                        className="flex-1 bg-kente-green/10 py-3 rounded-xl flex-row items-center justify-center gap-2"
                                        onPress={() => Linking.openURL(`https://maps.apple.com/?daddr=${cookLat},${cookLng}`)}
                                    >
                                        <Navigation size={16} color="#007A33" />
                                        <Text className="text-kente-green font-bold font-sans-bold text-sm">Directions</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                )}

                {/* Leave a Review — only once the order is Completed */}
                {isCompleted && cook && (
                    <View className="bg-surface mx-6 mt-4 rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 }}>
                        {existingReview ? (
                            <View>
                                <Text className="text-lg font-bold text-text-main font-sans-bold mb-2">Your Review</Text>
                                <View className="flex-row gap-1 mb-2">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <Star key={n} size={18} color="#FFCD00" fill={n <= existingReview.rating ? '#FFCD00' : 'transparent'} />
                                    ))}
                                </View>
                                {existingReview.comment && (
                                    <Text className="text-sm text-text-sub font-sans leading-relaxed">{existingReview.comment}</Text>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity
                                className="flex-row items-center justify-between"
                                onPress={() => setReviewModalVisible(true)}
                            >
                                <View className="flex-1">
                                    <Text className="text-lg font-bold text-text-main font-sans-bold">Rate your experience</Text>
                                    <Text className="text-sm text-text-sub font-sans mt-0.5">Let {cookKitchenName || cook.full_name || 'the host'} know how it went</Text>
                                </View>
                                <Star size={22} color="#BF592B" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Cancel Order — only for active orders */}
                {isActive && order.status === 'New' && (
                    <TouchableOpacity className="mx-6 mt-4 mb-4 py-3" onPress={handleCancelOrder}>
                        <Text className="text-center text-red-500 font-semibold font-sans-semibold">Cancel Order</Text>
                    </TouchableOpacity>
                )}

                <View className="h-8" />
            </ScrollView>
            </View>

            <Modal visible={reviewModalVisible} transparent animationType="slide" onRequestClose={() => setReviewModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        activeOpacity={1}
                        onPress={() => setReviewModalVisible(false)}
                    />
                    <View className="bg-surface rounded-t-3xl p-6">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-bold text-text-main font-sans-bold">Rate your experience</Text>
                            <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                                <X size={22} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row justify-center gap-2 mb-5">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <TouchableOpacity key={n} onPress={() => setReviewRating(n)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                                    <Star size={36} color="#FFCD00" fill={n <= reviewRating ? '#FFCD00' : 'transparent'} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            placeholder="Add a comment (optional)"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 rounded-xl px-4 py-3 text-text-main font-sans text-base border border-gray-100 mb-4"
                            value={reviewComment}
                            onChangeText={setReviewComment}
                            multiline
                            textAlignVertical="top"
                            style={{ minHeight: 80 }}
                        />

                        <TouchableOpacity
                            onPress={handleSubmitReview}
                            disabled={reviewRating === 0 || submittingReview}
                            className="bg-clay-primary rounded-2xl py-4 flex-row items-center justify-center gap-2"
                            style={{ opacity: reviewRating === 0 || submittingReview ? 0.5 : 1, shadowColor: '#BF592B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                        >
                            {submittingReview
                                ? <ActivityIndicator size="small" color="white" />
                                : <><Check size={18} color="white" /><Text className="text-white font-bold font-sans-bold">Submit Review</Text></>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
