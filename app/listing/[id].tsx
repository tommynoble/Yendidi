import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Share, StyleSheet } from 'react-native';
const { width } = Dimensions.get('window');
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
    ArrowLeft, Heart, Clock, Star, Plus, Minus, ChefHat, Flame, 
    ShoppingCart, MapPin, Utensils, Navigation, Share2, Upload, Pencil,
    Sparkles, Shield, Check, Wifi, Music, Car, Droplet, MessageSquare, 
    Info, ChevronRight, CheckCircle2, Coffee, Users as UsersIcon
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDishImage } from '@/constants/Images';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

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
    const { addToCart, isCookMode } = useAppStore();
    const [quantity, setQuantity] = useState(1);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [saved, setSaved] = useState(false);
    const [eaterLocation, setEaterLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedOption, setSelectedOption] = useState<'standard' | 'vip' | 'takeaway'>('standard');
    const [mapVisible, setMapVisible] = useState(false);
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
        let cancelled = false;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted' || cancelled) return;
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (!cancelled) setEaterLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            } catch (_) {}
        })();
        return () => { cancelled = true; };
    }, []);

    // Fetch the listing + cook profile
    const { data: listing, isLoading, error } = useQuery({
        queryKey: ['listing', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('listings')
                .select('*, profiles(id, full_name, avatar_url, kitchen_image_url, rating, served_count)')
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

    // Check if current user is the owner of this listing
    const { data: currentUser } = useQuery({
        queryKey: ['current-user'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            return user;
        }
    });

    const isOwner = currentUser?.id === listing?.cook_id;

    const dishImage = useMemo(() => {
        if (!listing) return { uri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800' };
        return getDishImage(listing.title, listing.image);
    }, [listing]);

    // Create array of images for slider (food, kitchen workspace, dining table)
    const sliderImages = useMemo(() => {
        if (!listing) return [];
        return [
            dishImage,
            { uri: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800' }, // Cozy kitchen workspace (no people)
            { uri: 'https://images.unsplash.com/photo-1529566652340-2c41a226ce81?w=800' }  // Cozy table setup (no people)
        ];
    }, [listing, dishImage]);

    // Compute distance between eater and cook
    const distanceKm = useMemo(() => {
        if (eaterLocation && listing?.latitude && listing?.longitude) {
            return getDistanceKm(eaterLocation.lat, eaterLocation.lng, listing.latitude, listing.longitude);
        }
        return null;
    }, [eaterLocation, listing]);

    const distanceLabel = useMemo(() => {
        if (distanceKm != null) {
            return distanceKm < 1
                ? `${Math.round(distanceKm * 1000)} m away`
                : `${distanceKm.toFixed(1)} km away`;
        }
        return listing?.location_text || null;
    }, [distanceKm, listing]);

    // Pricing calculation
    const basePrice = useMemo(() => Number(listing?.price || 0), [listing]);

    const getOptionPrice = useCallback((option: 'standard' | 'vip' | 'takeaway') => {
        return basePrice;
    }, [basePrice]);

    const currentPrice = getOptionPrice(selectedOption);

    const optionName = useMemo(() => {
        if (selectedOption === 'vip') return "Chef's Table VIP";
        if (selectedOption === 'takeaway') return "Takeaway / Express";
        return "Standard Dining Spot";
    }, [selectedOption]);

    const mapCoordinates = useMemo(() => {
        const lat = listing?.latitude || 5.6037;
        const lng = listing?.longitude || -0.1870;
        return {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
        };
    }, [listing]);

    const handleAddToCart = () => {
        if (!listing) return;
        addToCart({
            id: listing.id, // Keep base listing.id to match backend validation constraints
            name: `${listing.title} (${optionName})`,
            image: listing.image || '',
            price: currentPrice,
            cookId: listing.cook_id,
            cookName: listing.profiles?.full_name || 'Chef',
        }, quantity);

        Alert.alert(
            '🛒 Added to Cart!',
            `${quantity}x ${listing.title} (${optionName}) added to your cart.`,
            [
                { text: 'Keep Browsing', style: 'cancel' },
                { text: 'View Cart', onPress: () => router.push('/cart') },
            ]
        );
    };

    const handleShare = async () => {
        if (!listing) return;
        try {
            await Share.share({
                title: `${listing.title} on YɛnDidii`,
                message: `Join me to dine with the chef for "${listing.title}" on YɛnDidii! 🤤\n\nOpen this link to view experience:\nyendidii://listing/${listing.id}`,
            });
        } catch (error) {
            console.log('Error sharing:', error);
        }
    };

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

    return (
        <View className="flex-1 bg-[#FCFBFA]">
            {/* Floating Top Navigation Overlay */}
            <View
                className="absolute left-0 right-0 z-20 flex-row justify-between items-center px-6"
                style={{ top: insets.top + 12 }}
            >
                <TouchableOpacity
                    className="w-10 h-10 bg-white/90 rounded-full items-center justify-center shadow-sm"
                    onPress={() => router.back()}
                >
                    <ArrowLeft size={20} color="#2D241E" />
                </TouchableOpacity>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        className="w-10 h-10 bg-white/90 rounded-full items-center justify-center shadow-sm"
                        onPress={handleShare}
                        activeOpacity={0.8}
                    >
                        <Upload size={19} color="#2D241E" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="w-10 h-10 bg-white/90 rounded-full items-center justify-center shadow-sm"
                        onPress={toggleSaved}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.8}
                    >
                        <Heart size={20} color={saved ? '#D65A31' : '#2D241E'} fill={saved ? '#D65A31' : 'transparent'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
                {/* Hero Image Slider — curved top banner */}
                <View style={{ height: 360, marginTop: insets.top, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(e) => {
                            const slideIndex = Math.round(e.nativeEvent.contentOffset.x / width);
                            setActiveImageIndex(slideIndex);
                        }}
                    >
                        {sliderImages.map((img, index) => (
                            <Image key={index} source={img} style={{ width, height: 360 }} resizeMode="cover" />
                        ))}
                    </ScrollView>
                    
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 }}
                        pointerEvents="none"
                    />

                    {/* Image Pager Dots */}
                    <View className="absolute bottom-[90px] left-0 right-0 flex-row justify-center gap-1.5" pointerEvents="none">
                        {sliderImages.map((_, index) => (
                            <View 
                                key={index} 
                                className={`h-1.5 rounded-full ${index === activeImageIndex ? 'w-4 bg-clay-primary' : 'w-1.5 bg-white/50'}`} 
                            />
                        ))}
                    </View>

                    {/* Overlay Details */}
                    <View className="absolute bottom-6 left-6 right-6" pointerEvents="none">
                        <Text className="text-white text-2xl font-bold font-sans-bold mb-2.5 leading-tight" numberOfLines={2}>
                            {listing.title}
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                            <View className="flex-row items-center gap-1 bg-white/25 px-2.5 py-0.5 rounded-full">
                                <Star size={11} color="#FFCD00" fill="#FFCD00" />
                                <Text className="text-white text-xs font-bold font-sans-semibold">{listing.profiles?.rating || '4.8'}</Text>
                            </View>
                            <View className="flex-row items-center gap-1 bg-white/25 px-2.5 py-0.5 rounded-full">
                                <Clock size={11} color="white" />
                                <Text className="text-white text-xs font-sans">{listing.prep_time_minutes || 30} mins prep</Text>
                            </View>
                            {listing.portions_available > 0 && (
                                <View className="flex-row items-center gap-1 bg-[#FF4500]/80 px-2.5 py-0.5 rounded-full">
                                    <Flame size={11} color="white" fill="white" />
                                    <Text className="text-white text-xs font-bold font-sans-semibold">{listing.portions_available} left</Text>
                                </View>
                            )}
                            {distanceLabel ? (
                                <View className="flex-row items-center gap-1 bg-black/40 px-2.5 py-0.5 rounded-full">
                                    <MapPin size={11} color="white" />
                                    <Text className="text-white text-xs font-sans">{distanceLabel}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* Price, Status, and Overview */}
                <View className="px-6 -mt-6 relative z-10">
                    <View
                        className="bg-white rounded-3xl p-6 mb-5"
                        style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' }}
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-baseline gap-1">
                                <Text className="text-3xl font-bold text-clay-primary font-sans-bold tracking-tight">₵{listing.price}</Text>
                                <Text className="text-xs text-text-sub font-sans">base price</Text>
                            </View>
                            <View className={`px-3 py-1 rounded-full flex-row items-center gap-1.5 ${listing.available ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
                                <View className={`w-1.5 h-1.5 rounded-full ${listing.available ? 'bg-green-600' : 'bg-gray-400'}`} />
                                <Text className={`text-[10px] font-bold tracking-wider uppercase ${listing.available ? 'text-green-700' : 'text-gray-500 font-sans-bold'}`}>
                                    {listing.available ? 'Dining Open' : 'Fully Booked'}
                                </Text>
                            </View>
                        </View>

                        {/* Thin Divider */}
                        <View className="h-[1px] bg-gray-100 my-4" />

                        {listing.description ? (
                            <>
                                <Text className="text-text-sub font-sans leading-relaxed text-sm">
                                    {listing.description}
                                </Text>
                                {/* Thin Divider */}
                                <View className="h-[1px] bg-gray-100 my-4" />
                            </>
                        ) : null}

                        {/* Summary Badges Row */}
                        <View className="flex-row gap-2.5">
                            <View className="flex-1 bg-[#FFF9F5] border border-[#FFEDD5] rounded-2xl p-3 items-center justify-center">
                                <Clock size={18} color="#D65A31" strokeWidth={2.5} />
                                <Text className="text-xs font-bold text-text-main mt-1.5 font-sans-bold">{listing.prep_time_minutes || 30}m</Text>
                                <Text className="text-[9px] text-text-sub font-sans uppercase tracking-wider">Cooking Time</Text>
                            </View>
                            <View className="flex-1 bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl p-3 items-center justify-center">
                                <ShoppingCart size={18} color="#10B981" strokeWidth={2.5} />
                                <Text className="text-xs font-bold text-text-main mt-1.5 font-sans-bold">{listing.portions_available || 0}</Text>
                                <Text className="text-[9px] text-text-sub font-sans uppercase tracking-wider">Seats Left</Text>
                            </View>
                            <View className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 items-center justify-center">
                                <Utensils size={18} color="#475569" strokeWidth={2.5} />
                                <Text className="text-xs font-bold text-text-main mt-1.5 font-sans-bold text-center" numberOfLines={1}>
                                    {listing.category || 'Traditional'}
                                </Text>
                                <Text className="text-[9px] text-text-sub font-sans uppercase tracking-wider">Style</Text>
                            </View>
                        </View>
                    </View>

                    {/* Choose Your Dining Experience Section */}
                    <View className="mb-8">
                        <View className="flex-row items-center gap-2 mb-4 px-1">
                            <Text className="text-xl font-bold text-text-main font-sans-bold">Choose Your Experience Option</Text>
                        </View>

                        {/* Package Card 1: Standard */}
                        <TouchableOpacity
                            onPress={() => setSelectedOption('standard')}
                            className={`bg-white rounded-3xl p-5 mb-4 border-2 transition-all ${selectedOption === 'standard' ? 'border-clay-primary bg-orange-50/10' : 'border-gray-100'}`}
                            style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 }}
                            activeOpacity={0.9}
                        >
                            <View className="flex-row justify-between items-center mb-2.5">
                                <View className="flex-row items-center gap-3">
                                    <View className={`w-8 h-8 rounded-full items-center justify-center ${selectedOption === 'standard' ? 'bg-orange-100' : 'bg-gray-100'}`}>
                                        <UsersIcon size={16} color={selectedOption === 'standard' ? '#D65A31' : '#6B7280'} />
                                    </View>
                                    <View>
                                        <Text className="font-bold text-text-main text-sm font-sans-bold">Standard Spot</Text>
                                        <Text className="text-sm text-text-sub font-sans">Communal Dining Table</Text>
                                    </View>
                                </View>
                            </View>
                            <Text className="text-sm text-text-sub font-sans leading-relaxed pl-11">
                                Dine at the communal host table. Share stories with other guests over hot plates, background music, and a cold Sobolo.
                            </Text>
                        </TouchableOpacity>

                        {/* Package Card 2: VIP */}
                        <TouchableOpacity
                            onPress={() => setSelectedOption('vip')}
                            className={`bg-white rounded-3xl p-5 mb-4 border-2 transition-all ${selectedOption === 'vip' ? 'border-clay-primary bg-orange-50/10' : 'border-gray-100'}`}
                            style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 }}
                            activeOpacity={0.9}
                        >
                            <View className="flex-row justify-between items-center mb-2.5">
                                <View className="flex-row items-center gap-3">
                                    <View className={`w-8 h-8 rounded-full items-center justify-center ${selectedOption === 'vip' ? 'bg-orange-100' : 'bg-gray-100'}`}>
                                        <Sparkles size={15} color={selectedOption === 'vip' ? '#D65A31' : '#6B7280'} fill={selectedOption === 'vip' ? '#D65A31' : 'transparent'} />
                                    </View>
                                    <View>
                                        <Text className="font-bold text-text-main text-sm font-sans-bold">Chef's Table VIP</Text>
                                        <Text className="text-sm text-text-sub font-sans">Premium Seating & Perks</Text>
                                    </View>
                                </View>
                            </View>
                            <Text className="text-sm text-text-sub font-sans leading-relaxed pl-11">
                                Premium front-row kitchen counter seats. Customize your spices, chat with the chef, and get a signature take-home spice pack.
                            </Text>
                        </TouchableOpacity>

                        {/* Package Card 3: Takeaway */}
                        <TouchableOpacity
                            onPress={() => setSelectedOption('takeaway')}
                            className={`bg-white rounded-3xl p-5 border-2 transition-all ${selectedOption === 'takeaway' ? 'border-clay-primary bg-orange-50/10' : 'border-gray-100'}`}
                            style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 }}
                            activeOpacity={0.9}
                        >
                            <View className="flex-row justify-between items-center mb-2.5">
                                <View className="flex-row items-center gap-3">
                                    <View className={`w-8 h-8 rounded-full items-center justify-center ${selectedOption === 'takeaway' ? 'bg-orange-100' : 'bg-gray-100'}`}>
                                        <Utensils size={15} color={selectedOption === 'takeaway' ? '#D65A31' : '#6B7280'} />
                                    </View>
                                    <View>
                                        <Text className="font-bold text-text-main text-sm font-sans-bold">Takeaway Express</Text>
                                        <Text className="text-sm text-text-sub font-sans">Packed to go</Text>
                                    </View>
                                </View>
                            </View>
                            <Text className="text-sm text-text-sub font-sans leading-relaxed pl-11">
                                Skip the sitting experience. The cook will pack your hot portion in an insulated eco-box takeaway container for pickup.
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* About the Experience Section & Image Collage */}
                    <View
                        className="bg-white rounded-3xl p-6 mb-5"
                        style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' }}
                    >
                        <Text className="text-[11px] tracking-widest uppercase font-bold text-[#A3A3A3] font-sans-bold mb-3.5">The Dining Experience</Text>

                        {/* 3-Image Grid Collage (Atmosphere / Listing Photos) */}
                        <View className="flex-row gap-2 mt-1" style={{ height: 200 }}>
                            {/* Left large photo (60% width) */}
                            <View className="w-[60%] h-full rounded-2xl overflow-hidden bg-gray-100">
                                <Image source={dishImage} className="w-full h-full object-cover" />
                            </View>
                            {/* Right stacked photos (38% width) */}
                            <View className="w-[38%] h-full flex-col justify-between">
                                <View className="h-[48%] rounded-2xl overflow-hidden bg-gray-100">
                                    <Image 
                                        source={{ uri: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400' }} 
                                        className="w-full h-full object-cover" 
                                    />
                                </View>
                                <View className="h-[48%] rounded-2xl overflow-hidden bg-gray-100">
                                    <Image 
                                        source={{ uri: 'https://images.unsplash.com/photo-1529566652340-2c41a226ce81?w=400' }} 
                                        className="w-full h-full object-cover" 
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Thin Divider */}
                        <View className="h-[1px] bg-gray-100 my-4" />

                        {/* Chef Profile Header (Without Images) */}
                        <TouchableOpacity 
                            onPress={() => router.push(`/cook/${listing.cook_id}`)}
                            className="flex-row items-center justify-between"
                            activeOpacity={0.8}
                        >
                            <View className="flex-1">
                                <Text className="font-bold text-text-main text-[16px] font-sans-bold leading-tight">
                                    {cookApp?.kitchen_name || listing.profiles?.full_name || 'Ghanaian Host'}
                                </Text>
                                <Text className="text-xs text-text-sub font-sans mt-0.5">Hosted by Chef {listing.profiles?.full_name || 'Ama'}</Text>
                                <View className="flex-row items-center gap-2.5 mt-1">
                                    <View className="flex-row items-center gap-0.5">
                                        <Star size={10} color="#D97706" fill="#D97706" />
                                        <Text className="text-sm text-text-sub font-sans-semibold font-bold">{listing.profiles?.rating || '4.8'}</Text>
                                    </View>
                                    <Text className="text-gray-300 text-[10px]">•</Text>
                                    <Text className="text-sm text-text-sub font-sans">
                                        {listing.profiles?.served_count || 0}+ hosts served
                                    </Text>
                                </View>
                            </View>
                            <ChevronRight size={18} color="#A3A3A3" />
                        </TouchableOpacity>

                        {/* Thin Divider */}
                        <View className="h-[1px] bg-gray-100 my-4" />

                        {/* Bio / BACKSTORY */}
                        <Text className="text-sm text-text-sub font-sans leading-relaxed">
                            {cookApp?.bio ? `"${cookApp.bio}"` : "Join the host kitchen for an authentic Ghanaian home-dining session. Enjoy seasoned recipes passed down through generations, cooked in a clean, welcoming environment."}
                        </Text>
                    </View>

                    {/* What this Experience Offers (Amenities) Section (Inspired by Screenshot 2) */}
                    <View
                        className="bg-white rounded-3xl p-6 mb-8"
                        style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' }}
                    >
                        <Text className="text-xl font-bold text-text-main font-sans-bold mb-5">What this experience offers</Text>
                        
                        <View className="flex-row flex-wrap gap-y-5">
                            <View className="w-1/2 flex-row items-center gap-3.5">
                                <Flame size={18} color="#D65A31" fill="#D65A31" />
                                <View className="flex-1">
                                    <Text className="text-sm font-bold text-text-main font-sans-bold">Ghanaian Spices</Text>
                                    <Text className="text-sm text-text-sub font-sans leading-relaxed">Adjustable spice levels</Text>
                                </View>
                            </View>

                            <View className="w-1/2 flex-row items-center gap-3.5">
                                <Coffee size={18} color="#D65A31" />
                                <View className="flex-1">
                                    <Text className="text-sm font-bold text-text-main font-sans-bold">Sobolo Beverage</Text>
                                    <Text className="text-sm text-text-sub font-sans leading-relaxed">Homemade local drink</Text>
                                </View>
                            </View>

                            <View className="w-1/2 flex-row items-center gap-3.5">
                                <Music size={18} color="#D65A31" />
                                <View className="flex-1">
                                    <Text className="text-sm font-bold text-text-main font-sans-bold">African Beats</Text>
                                    <Text className="text-sm text-text-sub font-sans leading-relaxed">Afrobeats background play</Text>
                                </View>
                            </View>

                            <View className="w-1/2 flex-row items-center gap-3.5">
                                <Utensils size={17} color="#D65A31" />
                                <View className="flex-1">
                                    <Text className="text-sm font-bold text-text-main font-sans-bold">Veranda Dining</Text>
                                    <Text className="text-sm text-text-sub font-sans leading-relaxed">Outdoor garden seating</Text>
                                </View>
                            </View>

                            <View className="w-1/2 flex-row items-center gap-3.5">
                                <MessageSquare size={17} color="#D65A31" />
                                <View className="flex-1">
                                    <Text className="text-sm font-bold text-text-main font-sans-bold">Host Chat</Text>
                                    <Text className="text-sm text-text-sub font-sans leading-relaxed">Stories & cooking tips</Text>
                                </View>
                            </View>

                            <View className="w-1/2 flex-row items-center gap-3.5">
                                <Droplet size={18} color="#D65A31" />
                                <View className="flex-1">
                                    <Text className="text-sm font-bold text-text-main font-sans-bold">Hand Washing</Text>
                                    <Text className="text-sm text-text-sub font-sans leading-relaxed">Traditional setup provided</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Where You'll Be Map Section (Inspired by Screenshot 4) */}
                    <View
                        className="bg-white rounded-3xl p-6 mb-8"
                        style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' }}
                    >
                        <Text className="text-xl font-bold text-text-main font-sans-bold">Where you'll be</Text>

                        {/* Thin Divider */}
                        <View className="h-[1px] bg-gray-100 my-3.5" />

                        <Text className="text-sm text-text-sub font-sans mt-1.5 leading-relaxed">
                            {cookApp?.location || listing.location_text || 'East Legon, near ANC Mall, Accra, Ghana'}
                        </Text>

                        {/* Map — loaded on demand to avoid blocking initial render */}
                        <View className="rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 mt-4" style={{ height: 200 }}>
                            {mapVisible ? (
                                <MapView
                                    provider={PROVIDER_DEFAULT}
                                    initialRegion={mapCoordinates}
                                    scrollEnabled={false}
                                    zoomEnabled={false}
                                    pitchEnabled={false}
                                    rotateEnabled={false}
                                    style={StyleSheet.absoluteFillObject}
                                >
                                    <Marker coordinate={{ latitude: mapCoordinates.latitude, longitude: mapCoordinates.longitude }}>
                                        <View className="w-9 h-9 bg-clay-primary rounded-full items-center justify-center border-2 border-white shadow-md">
                                            <ChefHat size={16} color="white" />
                                        </View>
                                    </Marker>
                                </MapView>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => setMapVisible(true)}
                                    className="w-full h-full items-center justify-center bg-gray-100"
                                    activeOpacity={0.8}
                                >
                                    <View className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm mb-2">
                                        <MapPin size={22} color="#D65A31" />
                                    </View>
                                    <Text className="text-sm text-text-sub font-sans">Tap to view map</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Things to Know Section (Inspired by Screenshot 1) */}
                    <View
                        className="bg-white rounded-3xl p-6 mb-2"
                        style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' }}
                    >
                        <Text className="text-xl font-bold text-text-main font-sans-bold mb-5">Things to know</Text>

                        {/* Booking requirements */}
                        <View className="flex-row items-start gap-4 mb-4 pb-4 border-b border-gray-100">
                            <CheckCircle2 size={18} color="#D65A31" className="mt-0.5" />
                            <View className="flex-1">
                                <Text className="text-sm font-bold text-text-main font-sans-bold">Booking expectations</Text>
                                <Text className="text-sm text-text-sub font-sans mt-1 leading-relaxed">
                                    Akwaaba spirit! Arrive with a big appetite and love for meeting fellow food lovers.
                                </Text>
                            </View>
                        </View>

                        {/* Rules */}
                        <View className="flex-row items-start gap-4 mb-4 pb-4 border-b border-gray-100">
                            <Clock size={18} color="#D65A31" className="mt-0.5" />
                            <View className="flex-1">
                                <Text className="text-sm font-bold text-text-main font-sans-bold">Dining house rules</Text>
                                <Text className="text-sm text-text-sub font-sans mt-1 leading-relaxed">
                                    Dine starts strictly on time. Traditional handwashing before eating is encouraged.
                                </Text>
                            </View>
                        </View>

                        {/* Safety & property */}
                        <View className="flex-row items-start gap-4">
                            <Shield size={18} color="#D65A31" className="mt-0.5" />
                            <View className="flex-1">
                                <Text className="text-sm font-bold text-text-main font-sans-bold">Health & safety</Text>
                                <Text className="text-sm text-text-sub font-sans mt-1 leading-relaxed">
                                    Sanitized home kitchen. Outdoor garden/veranda dining. Notify host of allergies in advance.
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom sticky checkout bar */}
            <View
                className="absolute bottom-0 left-0 right-0 bg-[#FFF9F5] px-6 pt-4 border-t border-[#FFEDD5] z-30"
                style={{ paddingBottom: insets.bottom + 8, shadowColor: '#2D241E', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 8 }}
            >
                {isOwner && isCookMode ? (
                    <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-4">
                            <Text className="text-sm font-bold text-text-main font-sans-bold">Preview Mode</Text>
                            <Text className="text-xs text-text-sub font-sans mt-0.5">This is how eaters see your dining experience.</Text>
                        </View>
                        <TouchableOpacity
                            className="bg-clay-primary rounded-2xl py-3 px-6 items-center flex-row gap-2 active:scale-95"
                            onPress={() => router.push(`/(tabs)/cook?edit_id=${listing.id}`)}
                        >
                            <Pencil size={16} color="white" />
                            <Text className="text-white font-bold text-sm font-sans-bold">Edit Dish</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View className="flex-row items-center gap-4">
                        {/* Quantity Counter */}
                        <View className="flex-row items-center gap-3 bg-white border border-[#FFEDD5] shadow-sm rounded-2xl px-3 py-2">
                            <TouchableOpacity
                                onPress={() => setQuantity(q => Math.max(1, q - 1))}
                                className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 items-center justify-center active:bg-gray-100"
                            >
                                <Minus size={15} color="#2D241E" />
                            </TouchableOpacity>
                            <Text className="text-base font-bold text-text-main w-5 text-center font-sans-bold">{quantity}</Text>
                            <TouchableOpacity
                                onPress={() => setQuantity(q => q + 1)}
                                className="w-8 h-8 rounded-full bg-clay-primary items-center justify-center active:opacity-90"
                            >
                                <Plus size={15} color="white" />
                            </TouchableOpacity>
                        </View>

                        {/* Booking CTA button */}
                        <TouchableOpacity
                            className="flex-1 bg-clay-primary rounded-2xl py-4 items-center flex-row justify-center gap-2 active:opacity-95"
                            style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
                            onPress={handleAddToCart}
                            disabled={!listing.available}
                        >
                            <ShoppingCart size={18} color="white" />
                            <Text className="text-white font-bold text-base font-sans-bold">
                                Reserve Spot · ₵{(currentPrice * quantity).toFixed(2)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}
