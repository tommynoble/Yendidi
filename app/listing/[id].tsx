import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Heart, Clock, Star, Plus, Minus, ChefHat, Flame, ShoppingCart, MapPin, Utensils, Navigation } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Haversine formula → distance in km
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ListingDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { addToCart } = useAppStore();
    const [quantity, setQuantity] = useState(1);
    const [saved, setSaved] = useState(false);
    const [eaterLocation, setEaterLocation] = useState<{ lat: number; lng: number } | null>(null);
    const FAVORITES_KEY = 'yendidii_favorites';

    // Load saved state from AsyncStorage
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

    // Silently try to get eater's location for distance display
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setEaterLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            } catch (_) {}
        })();
    }, []);

    // Fetch the listing + cook profile
    const { data: listing, isLoading, error } = useQuery({
        queryKey: ['listing', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('listings')
                .select('*, profiles(id, full_name, avatar_url, rating, served_count)')
                .eq('id', id as string)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // Fetch cook's application (bio, kitchen name, specialties, location)
    const { data: cookApp } = useQuery({
        queryKey: ['cook-application', listing?.cook_id],
        queryFn: async () => {
            const { data } = await supabase
                .from('cook_applications')
                .select('kitchen_name, bio, location, specialties, cooking_frequency, max_session_capacity')
                .eq('user_id', listing.cook_id)
                .eq('status', 'approved')
                .single();
            return data;
        },
        enabled: !!listing?.cook_id,
    });

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#D65A31" />
            </View>
        );
    }

    if (error || !listing) {
        return (
            <View className="flex-1 items-center justify-center bg-white px-6">
                <Text className="text-lg text-text-sub font-sans text-center mb-4">
                    Sorry, we couldn't find that listing.
                </Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text className="text-clay-primary font-bold font-sans-bold">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const dishImage = listing.image
        ? { uri: listing.image }
        : { uri: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=800' };

    // Compute distance between eater and cook
    const distanceKm =
        eaterLocation && listing.latitude && listing.longitude
            ? getDistanceKm(eaterLocation.lat, eaterLocation.lng, listing.latitude, listing.longitude)
            : null;

    const distanceLabel = distanceKm != null
        ? distanceKm < 1
            ? `${Math.round(distanceKm * 1000)} m away`
            : `${distanceKm.toFixed(1)} km away`
        : listing.location_text || null;

    const handleAddToCart = () => {
        addToCart({
            id: listing.id,
            name: listing.title,
            image: listing.image || '',
            price: Number(listing.price),
            cookId: listing.cook_id,
            cookName: listing.profiles?.full_name || 'Chef',
        }, quantity);

        Alert.alert(
            '🛒 Added to Cart!',
            `${quantity}x ${listing.title} added to your cart.`,
            [
                { text: 'Keep Browsing', style: 'cancel' },
                { text: 'View Cart', onPress: () => router.push('/cart') },
            ]
        );
    };

    return (
        <View className="flex-1 bg-white">
            {/* Floating Back + Save */}
            <View
                className="absolute top-0 left-0 right-0 z-20 flex-row justify-between items-center px-6"
                style={{ paddingTop: insets.top + 8 }}
            >
                <TouchableOpacity
                    className="w-10 h-10 bg-white/90 rounded-full items-center justify-center shadow-sm"
                    onPress={() => router.back()}
                >
                    <ArrowLeft size={20} color="#2D241E" />
                </TouchableOpacity>
                <TouchableOpacity
                    className="w-10 h-10 bg-white/90 rounded-full items-center justify-center shadow-sm"
                    onPress={toggleSaved}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Heart size={20} color={saved ? '#EF4444' : '#2D241E'} fill={saved ? '#EF4444' : 'none'} />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                {/* Hero Image */}
                <View style={{ height: 380 }}>
                    <Image source={dishImage} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.65)']}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180 }}
                    />
                    <View className="absolute bottom-5 left-6 right-6">
                        <Text className="text-white text-2xl font-bold font-sans-bold mb-2" numberOfLines={2}>
                            {listing.title}
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                            <View className="flex-row items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
                                <Star size={11} color="#FFCD00" fill="#FFCD00" />
                                <Text className="text-white text-xs font-bold">{listing.profiles?.rating || '4.8'}</Text>
                            </View>
                            <View className="flex-row items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
                                <Clock size={11} color="white" />
                                <Text className="text-white text-xs">Ready in {listing.prep_time_minutes || 30} min</Text>
                            </View>
                            {listing.portions_available > 0 && (
                                <View className="flex-row items-center gap-1 bg-orange-500/80 px-2 py-0.5 rounded-full">
                                    <Flame size={11} color="white" fill="white" />
                                    <Text className="text-white text-xs font-bold">{listing.portions_available} left</Text>
                                </View>
                            )}
                            {/* Distance / Location badge */}
                            {distanceLabel ? (
                                <View className="flex-row items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full">
                                    <MapPin size={11} color="white" />
                                    <Text className="text-white text-xs">{distanceLabel}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* Price Card */}
                <View className="px-6 -mt-6 relative z-10">
                    <View
                        className="bg-white rounded-3xl p-6 overflow-hidden mb-4"
                        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 }}
                    >
                        {/* Kente Border */}
                        <View className="flex-row h-1 absolute top-0 left-0 right-0">
                            <View className="flex-1 bg-kente-red" />
                            <View className="flex-1 bg-kente-yellow" />
                            <View className="flex-1 bg-kente-yellow" />
                            <View className="flex-1 bg-kente-green" />
                            <View className="flex-1 bg-kente-green" />
                            <View className="flex-1 bg-text-main" />
                        </View>

                        <View className="flex-row items-center justify-between mt-2 mb-3">
                            <Text className="text-3xl font-bold text-clay-primary font-sans-bold">₵{listing.price}</Text>
                            <View className={`px-3 py-1 rounded-full ${listing.available ? 'bg-green-50' : 'bg-gray-100'}`}>
                                <Text className={`text-xs font-bold ${listing.available ? 'text-green-600' : 'text-gray-500'}`}>
                                    {listing.available ? '● Available Now' : '● Not Available'}
                                </Text>
                            </View>
                        </View>

                        {listing.description ? (
                            <Text className="text-text-sub font-sans leading-relaxed text-sm mb-4">
                                {listing.description}
                            </Text>
                        ) : null}

                        {/* Stats row */}
                        <View className="flex-row gap-3">
                            <View className="flex-1 bg-gray-50 rounded-2xl p-3 items-center">
                                <Clock size={18} color="#D65A31" />
                                <Text className="text-xs font-bold text-text-main mt-1 font-sans-bold">{listing.prep_time_minutes || 30} min</Text>
                                <Text className="text-[9px] text-text-sub font-sans">Cook Time</Text>
                            </View>
                            <View className="flex-1 bg-gray-50 rounded-2xl p-3 items-center">
                                <ShoppingCart size={18} color="#D65A31" />
                                <Text className="text-xs font-bold text-text-main mt-1 font-sans-bold">{listing.portions_available || 0}</Text>
                                <Text className="text-[9px] text-text-sub font-sans">Portions Left</Text>
                            </View>
                            <View className="flex-1 bg-gray-50 rounded-2xl p-3 items-center">
                                <Utensils size={18} color="#D65A31" />
                                <Text className="text-xs font-bold text-text-main mt-1 font-sans-bold text-center" numberOfLines={1}>
                                    {listing.category || 'Custom'}
                                </Text>
                                <Text className="text-[9px] text-text-sub font-sans">Category</Text>
                            </View>
                        </View>
                    </View>

                    {/* ── About the Cook ── */}
                    <View
                        className="bg-white rounded-3xl p-6 overflow-hidden mb-4"
                        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 }}
                    >
                        <Text className="text-base font-bold text-text-main font-sans-bold mb-4">About the Cook</Text>

                        <View className="flex-row items-center gap-4 mb-4">
                            {listing.profiles?.avatar_url ? (
                                <Image source={{ uri: listing.profiles.avatar_url }} className="w-16 h-16 rounded-2xl" />
                            ) : (
                                <View className="w-16 h-16 rounded-2xl bg-clay-primary/15 items-center justify-center">
                                    <ChefHat size={30} color="#D65A31" />
                                </View>
                            )}
                            <View className="flex-1">
                                <Text className="font-bold text-text-main text-base font-sans-bold">
                                    {listing.profiles?.full_name || 'Home Cook'}
                                </Text>
                                {cookApp?.kitchen_name ? (
                                    <Text className="text-xs text-clay-primary font-bold mt-0.5">{cookApp.kitchen_name}</Text>
                                ) : null}
                                <View className="flex-row items-center gap-3 mt-1">
                                    <View className="flex-row items-center gap-1">
                                        <Star size={11} color="#D97706" fill="#D97706" />
                                        <Text className="text-xs text-text-sub font-sans">{listing.profiles?.rating || '4.8'}</Text>
                                    </View>
                                    <Text className="text-xs text-text-sub font-sans">
                                        {listing.profiles?.served_count || 0}+ meals served
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Bio */}
                        {cookApp?.bio ? (
                            <Text className="text-sm text-text-sub font-sans leading-relaxed mb-4">
                                "{cookApp.bio}"
                            </Text>
                        ) : null}

                        {/* Location */}
                        {cookApp?.location ? (
                            <View className="flex-row items-center gap-2 mb-3">
                                <MapPin size={14} color="#D65A31" />
                                <Text className="text-sm text-text-sub font-sans">{cookApp.location}</Text>
                            </View>
                        ) : null}

                        {/* Specialties */}
                        {cookApp?.specialties && cookApp.specialties.length > 0 ? (
                            <View>
                                <Text className="text-xs font-bold text-text-main font-sans-bold mb-2">Specialties</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {cookApp.specialties.map((s: string, i: number) => (
                                        <View key={i} className="bg-orange-50 border border-orange-100 px-3 py-1 rounded-full">
                                            <Text className="text-xs text-clay-primary font-bold">{s}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : null}

                        {/* Cooking frequency */}
                        {cookApp?.cooking_frequency ? (
                            <View className="mt-3 pt-3 border-t border-gray-50 flex-row items-center gap-2">
                                <Utensils size={13} color="#9CA3AF" />
                                <Text className="text-xs text-text-sub font-sans">Cooks {cookApp.cooking_frequency}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Order Bar */}
            <View
                className="absolute bottom-0 left-0 right-0 bg-white px-6 pt-4 border-t border-gray-100"
                style={{ paddingBottom: insets.bottom + 8 }}
            >
                <View className="flex-row items-center gap-4">
                    <View className="flex-row items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2">
                        <TouchableOpacity
                            onPress={() => setQuantity(q => Math.max(1, q - 1))}
                            className="w-8 h-8 rounded-full bg-white items-center justify-center shadow-sm"
                        >
                            <Minus size={16} color="#2D241E" />
                        </TouchableOpacity>
                        <Text className="text-lg font-bold text-text-main w-6 text-center font-sans-bold">{quantity}</Text>
                        <TouchableOpacity
                            onPress={() => setQuantity(q => q + 1)}
                            className="w-8 h-8 rounded-full bg-clay-primary items-center justify-center"
                        >
                            <Plus size={16} color="white" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        className="flex-1 bg-clay-primary rounded-2xl py-4 items-center flex-row justify-center gap-2"
                        style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
                        onPress={handleAddToCart}
                        disabled={!listing.available}
                    >
                        <ShoppingCart size={18} color="white" />
                        <Text className="text-white font-bold text-base font-sans-bold">
                            Add to Cart · ₵{(Number(listing.price) * quantity).toFixed(2)}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
