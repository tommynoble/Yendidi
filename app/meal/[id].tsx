import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Share as RNShare } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Share, Heart, Clock, ChevronRight, MapPin, Navigation, Star, Plus, Minus, Flame, Users, ShoppingCart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { format } from 'date-fns';
import { formatPotCountdown } from '@/lib/countdown';
import { getDishImage } from '@/constants/Images';
import CartToast from '@/components/CartToast';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'yendidii_favorites';

const { width } = Dimensions.get('window');

// Hook to fetch the main dish from Supabase
const useMainDish = (id: string) => {
    return useQuery({
        queryKey: ['main-dish', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('main_dishes')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });
};

// Hook to fetch listings for a generic dish
const useListings = (dishName: string) => {
    return useQuery({
        queryKey: ['listings', dishName],
        queryFn: async () => {
            if (!dishName) return [];
            // Simple generic search matching the first word (e.g. "Jollof", "Waakye", "Fufu")
            const keyword = dishName.split(' ')[0];
            const { data, error } = await supabase
                .from('listings')
                .select(`
                  *,
                  profiles (full_name, avatar_url, rating, served_count)
                `)
                .ilike('title', `%${keyword}%`)
                .eq('available', true);

            if (error) throw error;
            return data || [];
        },
        enabled: !!dishName,
    });
};

export default function MealDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { addToCart, cartItems, getCartTotal, getCartCount } = useAppStore();

    const { data: mainDish, isLoading: isLoadingDish } = useMainDish(id as string);
    const { data: listings = [], isLoading: isLoadingListings, error } = useListings(mainDish?.name || '');

    // "Join the Pot" — how many seats are already booked for each scheduled listing here,
    // so eaters can see remaining capacity (portions_available already live-decrements it).
    const listingIds = listings.map((l: any) => l.id);
    const { data: potOrderCounts = {} } = useQuery({
        queryKey: ['listing-order-counts', listingIds],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('order_items')
                .select('listing_id, quantity, orders!inner(status)')
                .in('listing_id', listingIds)
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
        enabled: listingIds.length > 0,
    });

    // State for local quantities for each cook listing
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [cartToast, setCartToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(FAVORITES_KEY).then(raw => {
            if (raw) {
                const ids: string[] = JSON.parse(raw);
                setSaved(ids.includes(id as string));
            }
        });
    }, [id]);

    const toggleSaved = async () => {
        try {
            const raw = await AsyncStorage.getItem(FAVORITES_KEY);
            const ids: string[] = raw ? JSON.parse(raw) : [];
            const isCurrentlySaved = ids.includes(id as string);
            const updated = isCurrentlySaved
                ? ids.filter(i => i !== id)
                : [...ids, id as string];
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
            setSaved(!isCurrentlySaved);
        } catch (_) {}
    };

    const updateLocalQuantity = (id: string, delta: number) => {
        setQuantities(prev => ({
            ...prev,
            [id]: Math.max(1, (prev[id] || 1) + delta)
        }));
    };

    const isLoading = isLoadingDish || isLoadingListings;

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-warm-cream">
                <ActivityIndicator size="large" color="#D65A31" />
            </View>
        );
    }

    if (error || !mainDish) {
        return (
            <View className="flex-1 items-center justify-center bg-warm-cream px-6">
                <Text className="text-lg text-text-sub font-sans text-center">Sorry, we couldn't find that dish.</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-clay-primary font-bold font-sans-bold">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const minPrice = listings.length > 0 ? Math.min(...listings.map((l: any) => Number(l.price))) : 0;
    const ratedListings = listings.filter((l: any) => l.profiles?.rating);
    const avgRating = ratedListings.length > 0
        ? (ratedListings.reduce((sum: number, l: any) => sum + Number(l.profiles.rating), 0) / ratedListings.length).toFixed(1)
        : null;
    const totalServed = listings.reduce((sum: number, l: any) => sum + (l.profiles?.served_count || 0), 0);

    const handleQuickAdd = (cookItem: any) => {
        const qty = quantities[cookItem.id] || 1;
        addToCart({
            id: cookItem.id,
            name: cookItem.title,
            image: cookItem.image || mainDish.base_image_url,
            price: Number(cookItem.price),
            cookId: cookItem.cook_id,
            cookName: cookItem.profiles?.full_name || 'Chef',
        }, qty);

        setCartToast({ visible: true, message: `${qty}x ${cookItem.title} added to your cart.` });
    };

    const handleShare = async () => {
        try {
            await RNShare.share({
                title: `${mainDish.name} on YɛnDidii`,
                message: `Check out ${mainDish.name} on YɛnDidii! 🤤\n\nOpen this link:\nyendidii://meal/${mainDish.id}`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <View className="flex-1 bg-warm-cream">
            {/* Top Nav (Absolute) */}
            <View className="absolute top-0 left-0 right-0 z-20 flex-row justify-between items-center p-6 pt-12">
                <TouchableOpacity
                    className="w-10 h-10 bg-surface/90 rounded-full items-center justify-center shadow-sm active:scale-95"
                    onPress={() => router.back()}
                >
                    <ArrowLeft size={20} color="#2D241E" />
                </TouchableOpacity>
                <View className="flex-row gap-3">
                    <TouchableOpacity className="w-10 h-10 bg-surface/90 rounded-full items-center justify-center shadow-sm active:scale-95" onPress={handleShare}>
                        <Share size={20} color="#2D241E" />
                    </TouchableOpacity>
                    <TouchableOpacity className="w-10 h-10 bg-surface/90 rounded-full items-center justify-center shadow-sm active:scale-95" onPress={toggleSaved}>
                        <Heart size={20} color={saved ? '#EF4444' : '#2D241E'} fill={saved ? '#EF4444' : 'transparent'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1 pb-24" showsVerticalScrollIndicator={false}>
                {/* Hero Image */}
                <View className="w-full h-[400px] relative">
                    <Image
                        source={getDishImage(mainDish.name, mainDish.base_image_url)}
                        className="w-full h-full object-cover"
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.6)']}
                        className="absolute bottom-0 left-0 right-0 h-24"
                    />

                    {/* Image Overlays */}
                    <View className="absolute bottom-12 left-6 flex-row items-center gap-2">
                        {avgRating && (
                            <View className="bg-surface/90 px-3 py-1.5 rounded-full shadow-sm flex-row items-center gap-1">
                                <Star size={12} color="#D97706" fill="#D97706" />
                                <Text className="text-sm font-bold text-text-main">{avgRating}</Text>
                            </View>
                        )}
                        <TouchableOpacity className="bg-surface/90 px-3 py-1.5 rounded-full shadow-sm flex-row items-center gap-1" onPress={toggleSaved}>
                            <Heart size={12} color="#EF4444" fill={saved ? '#EF4444' : 'transparent'} />
                            <Text className="text-sm font-bold text-text-main">{saved ? 'Watching' : 'Watch'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content Body */}
                <View className="px-6 -mt-8 relative z-10">
                    <View className="bg-surface rounded-3xl p-6 shadow-lg overflow-hidden">
                        {/* Kente Border Top */}
                        <View className="flex-row h-1 absolute top-0 left-0 right-0">
                            <View className="flex-1 bg-kente-red" />
                            <View className="flex-1 bg-kente-yellow" />
                            <View className="flex-1 bg-kente-yellow" />
                            <View className="flex-1 bg-kente-green" />
                            <View className="flex-1 bg-kente-green" />
                            <View className="flex-1 bg-text-main" />
                        </View>

                        {/* Title Block */}
                        <View className="flex-row justify-between items-start mb-2 mt-2">
                            <View className="flex-1 mr-4">
                                <Text className="text-2xl font-bold text-text-main leading-tight mb-1 font-sans-bold">{mainDish.name}</Text>

                                {/* Quick Dish Info */}
                                <View className="flex-row items-center gap-1.5 mt-1">
                                    {avgRating && (
                                        <View className="bg-orange-50 px-2 py-0.5 rounded flex-row items-center gap-1">
                                            <Star size={12} color="#D97706" fill="#D97706" />
                                            <Text className="text-xs font-bold text-amber-700 font-sans-bold">{avgRating}</Text>
                                        </View>
                                    )}
                                    <View className="flex-row items-center gap-1">
                                        <Users size={12} color="#6B7280" />
                                        <Text className="text-xs text-text-sub font-sans">{listings.length} {listings.length === 1 ? 'host' : 'hosts'}</Text>
                                    </View>
                                    {totalServed > 0 && (
                                        <>
                                            <Text className="text-gray-300 text-[10px]">•</Text>
                                            <View className="flex-row items-center gap-1">
                                                <Clock size={12} color="#6B7280" />
                                                <Text className="text-xs text-text-sub font-sans">{totalServed}+ served</Text>
                                            </View>
                                        </>
                                    )}
                                </View>
                            </View>
                            <View className="items-end">
                                {minPrice > 0 ? (
                                    <>
                                        <Text className="text-[10px] text-text-sub font-sans mb-0.5">Starting from</Text>
                                        <Text className="text-2xl font-bold text-text-main font-sans-bold">₵{minPrice.toFixed(2)}</Text>
                                    </>
                                ) : (
                                    <Text className="text-sm font-bold text-text-main font-sans-bold">N/A</Text>
                                )}
                            </View>
                        </View>

                        {/* Description */}
                        <Text className="text-text-sub text-base leading-relaxed mb-6 font-sans">
                            {mainDish.description || "A delicious homemade meal prepared with fresh ingredients, perfect for your cravings."}
                        </Text>

                        {/* Ingredients */}
                        <Text className="font-bold text-text-main mb-3 font-sans-bold">Ingredients & Allergens</Text>
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {['Fresh Ingredients', 'Spices'].map((ing, i) => (
                                <View key={i} className="px-3 py-1.5 border border-gray-200 rounded-full">
                                    <Text className="text-xs text-text-sub font-sans">{ing}</Text>
                                </View>
                            ))}
                        </View>

                        <View className="h-[1px] bg-gray-100 w-full mb-6 mt-2" />

                        {/* Marketplace View: Cooks making this dish */}
                        <View className="mb-4">
                            <View className="flex-row items-center gap-2">
                                <Text className="font-bold text-text-main text-lg font-sans-bold">Hosts making this dish</Text>
                                <View className="bg-clay-primary/10 px-2 py-0.5 rounded-full">
                                    <Text className="text-clay-primary font-bold text-xs">{listings.length}</Text>
                                </View>
                            </View>
                            <Text className="text-text-sub text-sm font-sans mt-0.5">Choose who you want to cook it for you</Text>
                        </View>

                        <View className="flex-col gap-3">
                            {listings.length === 0 && !isLoading && (
                                <Text className="text-text-sub text-center py-4 font-sans">No hosts are currently making this dish.</Text>
                            )}

                            {listings.map((cookItem: any, idx: number) => (
                                <View
                                    key={cookItem.id}
                                    className="flex-col p-4 rounded-3xl border border-gray-100 bg-surface shadow-sm"
                                >
                                    <View className="flex-row items-start mb-4">
                                        <View className="relative">
                                            <Image
                                                source={getDishImage(cookItem.title || mainDish.name, cookItem.image || mainDish.base_image_url)}
                                                className="w-24 h-24 rounded-2xl object-cover mr-4 bg-gray-100"
                                            />
                                        </View>

                                        <View className="flex-1">
                                            <View className="flex-row justify-between items-start mb-1">
                                                <View className="bg-orange-50 self-start px-2 py-0.5 rounded flex-row items-center gap-1">
                                                    <Star size={10} color="#D97706" fill="#D97706" />
                                                    <Text className="text-[10px] font-bold text-amber-700 font-sans-bold uppercase">Top Rated Host</Text>
                                                </View>
                                                <Text className="font-bold text-text-main text-lg font-sans-bold">₵{cookItem.price}</Text>
                                            </View>

                                            <Text className="font-bold text-text-main text-lg font-sans-bold leading-tight" numberOfLines={1}>
                                                {cookItem.title}
                                            </Text>

                                            <TouchableOpacity
                                                onPress={() => router.push(`/cook/${cookItem.cook_id}`)}
                                                className="mt-0.5 flex-row items-center gap-1"
                                            >
                                                <Text className="text-sm text-text-sub font-medium font-sans-medium">
                                                    by {cookItem.profiles?.full_name}
                                                </Text>
                                                <Text className="text-gray-300 text-xs">•</Text>
                                                <View className="flex-row items-center gap-0.5">
                                                    <Star size={10} color="#D97706" fill="#D97706" />
                                                    <Text className="text-xs font-bold text-amber-700 font-sans-bold">
                                                        {cookItem.profiles?.rating ? Number(cookItem.profiles.rating).toFixed(1) : 'New'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>

                                            {!cookItem.order_deadline && (
                                                <>
                                                    <View className="flex-row items-center gap-1 mt-1">
                                                        <Clock size={12} color="#6B7280" />
                                                        <Text className="text-xs text-text-sub font-sans">{cookItem.prep_time_minutes || 30} min</Text>
                                                    </View>

                                                    <View className="flex-row items-center gap-1 mt-1">
                                                        <View className="w-4 h-4 rounded-full bg-green-100 items-center justify-center">
                                                            <Text className="text-green-700 text-[8px] font-bold">✓</Text>
                                                        </View>
                                                        <Text className="text-xs font-bold text-green-700 font-sans-bold">{cookItem.available ? 'Ready Now' : 'Cooking'}</Text>
                                                    </View>
                                                </>
                                            )}
                                        </View>
                                    </View>

                                    {cookItem.order_deadline && (() => {
                                        const booked = potOrderCounts[cookItem.id] || 0;
                                        const totalSeats = (cookItem.portions_available || 0) + booked;
                                        return (
                                            <View className="bg-clay-primary/5 rounded-2xl p-3 mb-3 flex-row items-center gap-2">
                                                <Flame size={14} color="#D65A31" />
                                                <Text className="text-xs text-text-main font-sans flex-1">
                                                    <Text className="font-bold">{formatPotCountdown(cookItem.order_deadline)}</Text>
                                                    {` · ${cookItem.portions_available} of ${totalSeats} seats remaining`}
                                                </Text>
                                            </View>
                                        );
                                    })()}

                                    <View className="flex-row items-center justify-between border-t border-gray-50 pt-4">
                                        <Text className="text-text-main font-bold text-xl font-sans-bold">₵{cookItem.price}</Text>

                                        <View className="flex-row items-center gap-3">
                                            <View className="flex-row items-center bg-gray-50 rounded-xl px-2 py-1 border border-gray-100">
                                                <TouchableOpacity
                                                    onPress={() => updateLocalQuantity(cookItem.id, -1)}
                                                    className="w-8 h-8 items-center justify-center rounded-lg active:bg-gray-200"
                                                >
                                                    <Minus size={16} color="#B84521" />
                                                </TouchableOpacity>
                                                <Text className="w-6 text-center font-bold text-text-main font-sans-bold">{quantities[cookItem.id] || 1}</Text>
                                                <TouchableOpacity
                                                    onPress={() => updateLocalQuantity(cookItem.id, 1)}
                                                    className="w-8 h-8 items-center justify-center rounded-lg active:bg-gray-200"
                                                >
                                                    <Plus size={16} color="#B84521" />
                                                </TouchableOpacity>
                                            </View>

                                            <TouchableOpacity
                                                className="bg-clay-primary pl-4 pr-5 py-2.5 rounded-xl shadow-md flex-row items-center gap-2 active:scale-95 transition-all"
                                                onPress={() => handleQuickAdd(cookItem)}
                                            >
                                                <Plus size={16} color="white" />
                                                <Text className="text-white text-sm font-bold font-sans-bold">Add to Cart</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
                <View className="h-24" />
            </ScrollView>

            {/* Floating Cart Button */}
            {getCartCount() > 0 && (
                <View
                    className="absolute bottom-8 left-6 right-6 z-50 shadow-2xl"
                >
                    <TouchableOpacity
                        onPress={() => router.push('/cart')}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={['#D65A31', '#B84521']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            className="flex-row items-center justify-between p-4 rounded-2xl"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="bg-surface/20 p-2 rounded-xl">
                                    <ShoppingCart size={20} color="white" />
                                </View>
                                <View>
                                    <Text className="text-white/80 text-[10px] font-bold uppercase tracking-wider font-sans-bold">Your Cart</Text>
                                    <Text className="text-white text-base font-bold font-sans-bold">{getCartCount()} items</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center gap-2">
                                <Text className="text-white text-lg font-bold font-sans-bold">₵{getCartTotal().toFixed(2)}</Text>
                                <ChevronRight size={20} color="white" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            <CartToast
                visible={cartToast.visible}
                message={cartToast.message}
                bottomOffset={getCartCount() > 0 ? 110 : 24}
                onPress={() => router.push('/cart')}
                onHide={() => setCartToast((prev) => ({ ...prev, visible: false }))}
            />
        </View>
    );
}
