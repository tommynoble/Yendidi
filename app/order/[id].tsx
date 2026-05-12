import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Phone, MapPin, Clock, Star, Check, ChefHat, Navigation, ShieldCheck, CreditCard, Package } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
                            profiles (
                                id,
                                full_name,
                                avatar_url,
                                phone,
                                rating,
                                served_count,
                                location
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

    // Get cook info from first order item
    const cook = order.order_items?.[0]?.listings?.profiles;
    const cookLocation = cook?.location || order.order_items?.[0]?.listings?.location_text || null;
    const currentStepIndex = STATUS_ORDER.indexOf(order.status);
    const isActive = ['New', 'Accepted', 'Cooking', 'Ready'].includes(order.status);
    const isCompleted = order.status === 'Completed';
    const isCancelled = order.status === 'Cancelled';

    return (
        <SafeAreaView className="flex-1 bg-warm-cream" edges={['top']}>
            {/* Header */}
            <View className="bg-white px-6 py-4 flex-row items-center justify-between border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()} className="p-1">
                    <ArrowLeft size={24} color="#2D241E" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-text-main font-sans-bold">Order Details</Text>
                <View className="w-8" />
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                {/* Status Card */}
                <View className="bg-white mx-6 mt-4 rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
                    <View className="flex-row items-center justify-between mb-5">
                        <Text className="text-lg font-bold text-text-main font-sans-bold">Order Status</Text>
                        <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: `${getStatusColor(order.status)}18` }}>
                            <Text className="text-xs font-bold font-sans-bold" style={{ color: getStatusColor(order.status) }}>
                                {order.status === 'Cooking' ? '🔥 Cooking' : order.status}
                            </Text>
                        </View>
                    </View>

                    {/* Progress Steps */}
                    {!isCancelled && (
                        <>
                            <View className="flex-row items-center justify-between mb-2">
                                {STATUS_STEPS.map((step, index) => {
                                    const stepIdx = STATUS_ORDER.indexOf(step.key);
                                    const isReached = currentStepIndex >= stepIdx;
                                    const stepColor = isReached ? getStatusColor(step.key) : '#D4D4D4';
                                    return (
                                        <View key={step.key} className="items-center flex-1">
                                            <View
                                                className={`w-12 h-12 rounded-full items-center justify-center ${isReached ? '' : 'bg-gray-100'}`}
                                                style={isReached ? { backgroundColor: `${stepColor}18` } : {}}
                                            >
                                                <step.icon size={20} color={stepColor} />
                                            </View>
                                            <Text className={`text-xs mt-2 font-sans ${isReached ? 'font-semibold text-text-main' : 'text-text-sub'}`}>
                                                {step.label}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            {/* Progress Line */}
                            <View className="flex-row items-center mx-6 -mt-10 mb-8">
                                <View className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <View
                                        className="h-full rounded-full"
                                        style={{
                                            width: isCompleted ? '100%' : `${(Math.max(0, currentStepIndex) / (STATUS_STEPS.length - 1)) * 100}%`,
                                            backgroundColor: getStatusColor(order.status)
                                        }}
                                    />
                                </View>
                            </View>
                        </>
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
                </View>

                {/* Order Items */}
                <View className="bg-white mx-6 mt-4 rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
                    <Text className="text-lg font-bold text-text-main mb-4 font-sans-bold">Your Order</Text>

                    {order.order_items?.map((item: any, index: number) => (
                        <View key={item.id || index} className={`flex-row gap-4 ${index > 0 ? 'mt-4 pt-4 border-t border-gray-100' : ''}`}>
                            {item.listings?.image ? (
                                <Image source={{ uri: item.listings.image }} className="w-20 h-20 rounded-xl" />
                            ) : (
                                <View className="w-20 h-20 rounded-xl bg-gray-100 items-center justify-center">
                                    <ChefHat size={28} color="#D4D4D4" />
                                </View>
                            )}
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
                    ))}

                    {/* Order Total */}
                    <View className="mt-4 pt-4 border-t border-gray-100 flex-row justify-between items-center">
                        <Text className="font-bold text-text-main font-sans-bold">Total</Text>
                        <Text className="text-xl font-bold text-clay-primary font-sans-bold">₵{order.total?.toFixed(2)}</Text>
                    </View>
                </View>

                {/* Payment Info */}
                <View className="bg-white mx-6 mt-4 rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
                    <Text className="text-lg font-bold text-text-main mb-4 font-sans-bold">Payment</Text>

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
                    <View className="bg-white mx-6 mt-4 rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
                        <Text className="text-lg font-bold text-text-main mb-4 font-sans-bold">Your Cook</Text>
                        <View className="flex-row items-center gap-4 mb-4">
                            {cook.avatar_url ? (
                                <Image source={{ uri: cook.avatar_url }} className="w-16 h-16 rounded-full" />
                            ) : (
                                <View className="w-16 h-16 rounded-full bg-clay-primary/15 items-center justify-center">
                                    <ChefHat size={28} color="#D65A31" />
                                </View>
                            )}
                            <View className="flex-1">
                                <Text className="font-bold text-text-main text-lg font-sans-bold">{cook.full_name || 'Home Cook'}</Text>
                                <View className="flex-row items-center gap-2 mt-1">
                                    <Star size={14} color="#FFCD00" fill="#FFCD00" />
                                    <Text className="text-sm text-text-main font-sans">{cook.rating || '4.8'}</Text>
                                    <Text className="text-sm text-text-sub font-sans">• {cook.served_count || 0}+ served</Text>
                                </View>
                                {cookLocation && (
                                    <View className="flex-row items-center gap-1 mt-1">
                                        <MapPin size={12} color="#D65A31" />
                                        <Text className="text-xs text-text-sub font-sans">{cookLocation}</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Call Cook */}
                        {cook.phone && (
                            <TouchableOpacity
                                className="bg-gray-50 py-3 rounded-xl flex-row items-center justify-center gap-2 border border-gray-100"
                                onPress={() => Linking.openURL(`tel:${cook.phone}`)}
                            >
                                <Phone size={18} color="#2D241E" />
                                <Text className="text-text-main font-bold font-sans-bold">Call Cook</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Get Directions */}
                {cookLocation && (
                    <TouchableOpacity
                        className="bg-white mx-6 mt-4 rounded-3xl p-5 flex-row items-center justify-between"
                        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}
                        onPress={() => {
                            const query = encodeURIComponent(cookLocation);
                            Linking.openURL(`https://maps.apple.com/?q=${query}`);
                        }}
                    >
                        <View className="flex-row items-center gap-3">
                            <View className="w-12 h-12 bg-kente-green/10 rounded-full items-center justify-center">
                                <Navigation size={20} color="#007A33" />
                            </View>
                            <View>
                                <Text className="font-bold text-text-main font-sans-bold">Get Directions</Text>
                                <Text className="text-xs text-text-sub font-sans">{cookLocation}</Text>
                            </View>
                        </View>
                        <ArrowLeft size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                )}

                {/* Order Meta */}
                <View className="mx-6 mt-4 px-2">
                    <Text className="text-xs text-text-sub font-sans">
                        Ordered {formatDate(order.created_at)}
                    </Text>
                </View>

                {/* Cancel Order — only for active orders */}
                {isActive && order.status === 'New' && (
                    <TouchableOpacity className="mx-6 mt-4 mb-4 py-3" onPress={handleCancelOrder}>
                        <Text className="text-center text-red-500 font-semibold font-sans-semibold">Cancel Order</Text>
                    </TouchableOpacity>
                )}

                <View className="h-8" />
            </ScrollView>
        </SafeAreaView>
    );
}
