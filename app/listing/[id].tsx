import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Share, StyleSheet, Modal, FlatList } from 'react-native';
const { width, height } = Dimensions.get('window');
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft, Heart, Clock, Star, Plus, Minus, ChefHat, Flame,
    ShoppingCart, MapPin, Utensils, Navigation, Share2, Upload, Pencil,
    Sparkles, Shield, Check, Wifi, Music, Car, Droplet, MessageSquare,
    Info, ChevronRight, CheckCircle2, Coffee, Users as UsersIcon, Leaf,
    Wheat, Soup, Apple, Fish, Cake, Sprout, Images, X
} from 'lucide-react-native';

const CATEGORY_TAG_STYLES: { 
    [key: string]: { 
        bg: string; 
        border: string; 
        text: string; 
        iconBg: string; 
        iconColor: string; 
        icon: React.ComponentType<any> 
    } 
} = {
    'Rice Dishes': { bg: '#FFF1EC', border: '#F2DFD7', text: '#231915', iconBg: 'rgba(191,89,43,0.1)', iconColor: '#BF592B', icon: Wheat },
    'Soups & Stews': { bg: '#FFF1EC', border: '#F2DFD7', text: '#231915', iconBg: 'rgba(191,89,43,0.1)', iconColor: '#BF592B', icon: Soup },
    'Grills & Kebabs': { bg: '#FFF1EC', border: '#F2DFD7', text: '#231915', iconBg: 'rgba(191,89,43,0.1)', iconColor: '#BF592B', icon: Flame },
    'Traditional Snacks': { bg: '#FFF1EC', border: '#F2DFD7', text: '#231915', iconBg: 'rgba(191,89,43,0.1)', iconColor: '#BF592B', icon: Apple },
    'Seafood': { bg: '#EBF5FF', border: '#CCE5FF', text: '#231915', iconBg: 'rgba(0,102,204,0.1)', iconColor: '#0066CC', icon: Fish },
    'Pastries': { bg: '#FFF0F5', border: '#FFD2E5', text: '#231915', iconBg: 'rgba(191,89,43,0.1)', iconColor: '#BF592B', icon: Cake },
    'Vegan': { bg: '#F0FFF8', border: '#B2DFCC', text: '#231915', iconBg: 'rgba(0,106,60,0.1)', iconColor: '#006A3C', icon: Leaf },
    'Vegetarian': { bg: '#F0FFF8', border: '#B2DFCC', text: '#231915', iconBg: 'rgba(0,106,60,0.1)', iconColor: '#006A3C', icon: Sprout }
};

const DEFAULT_TAG_STYLE = { bg: '#FFF8F6', border: '#F2DFD7', text: '#231915', iconBg: 'rgba(132,82,60,0.1)', iconColor: '#8A7269', icon: Utensils };
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDishImage } from '@/constants/Images';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import CartToast from '@/components/CartToast';

const DINE_IN_1 = require('@/assets/images/dine_in_1.jpg');
const DINE_IN_2 = require('@/assets/images/dine_in_2.jpg');
const DINE_IN_3 = require('@/assets/images/dine_in_3.jpg');

const DINE_IN_PHOTOS = [
    { image: DINE_IN_3, caption: 'True local flavors' },
    { image: DINE_IN_2, caption: 'Authentic dining seating' },
    { image: DINE_IN_1, caption: 'Traditional food preparation' },
];

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
    const { addToCart, isCookMode, getCartCount } = useAppStore();
    const [quantity, setQuantity] = useState(1);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [saved, setSaved] = useState(false);
    const [eaterLocation, setEaterLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedOption, setSelectedOption] = useState<'standard' | 'vip' | 'takeaway'>('standard');
    const [mapVisible, setMapVisible] = useState(false);
    const [cartToast, setCartToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
    const [photoTourVisible, setPhotoTourVisible] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const photoTourScrollRef = useRef<ScrollView>(null);
    const lightboxRef = useRef<FlatList>(null);
    const sectionOffsets = useRef<Record<string, number>>({});
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
        const imgs = listing.image ? listing.image.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        if (imgs.length > 0) {
            return imgs.map((img: string) => getDishImage(listing.title, img));
        }
        return [
            getDishImage(listing.title, null),
            { uri: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800' }, // Cozy kitchen workspace (no people)
            { uri: 'https://images.unsplash.com/photo-1529566652340-2c41a226ce81?w=800' }  // Cozy table setup (no people)
        ];
    }, [listing]);

    // Flat, swipeable sequence for the photo tour lightbox — dish photos first, then the dine-in gallery
    const allPhotos = useMemo(() => [
        ...sliderImages.map((img: any) => ({ image: img, caption: null as string | null, section: 'The Dish' })),
        ...DINE_IN_PHOTOS.map((p) => ({ image: p.image, caption: p.caption as string | null, section: 'Dining Experience' })),
    ], [sliderImages]);

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
        if (option === 'takeaway') {
            const discount = basePrice > 30 ? 15 : basePrice * 0.15;
            return Math.max(0, basePrice - discount);
        }
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

        setCartToast({ visible: true, message: `${quantity}x ${listing.title} (${optionName}) added to your cart.` });
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

    const scrollToSection = (key: string) => {
        const y = sectionOffsets.current[key];
        if (y !== undefined) {
            photoTourScrollRef.current?.scrollTo({ y: y - 12, animated: true });
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
        <View style={{ flex: 1, backgroundColor: '#FFF8F6' }}>
            {/* Floating Top Navigation Overlay */}
            <View
                style={{
                    position: 'absolute',
                    left: 20,
                    right: 20,
                    top: insets.top + 12,
                    zIndex: 20,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <TouchableOpacity
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'white',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#231915',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.1,
                        shadowRadius: 6,
                        elevation: 4
                    }}
                    onPress={() => router.back()}
                >
                    <ArrowLeft size={20} color="#231915" />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'white',
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#231915',
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: 4
                        }}
                        onPress={handleShare}
                    >
                        <Share2 size={18} color="#231915" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'white',
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#231915',
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: 4
                        }}
                        onPress={toggleSaved}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Heart size={18} color={saved ? '#BA1A1A' : '#231915'} fill={saved ? '#BA1A1A' : 'transparent'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView 
                style={{ flex: 1 }} 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ paddingBottom: 130 }}
            >
                {/* Hero Image Slider — curved bottom layout */}
                <View style={{ height: 490, width: '100%', position: 'relative' }}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={(e) => {
                            const contentOffset = e.nativeEvent.contentOffset.x;
                            const index = Math.round(contentOffset / width);
                            setActiveImageIndex(index);
                        }}
                        scrollEventThrottle={16}
                        style={{ width: '100%', height: '100%' }}
                    >
                        {sliderImages.map((img: any, index: number) => (
                            <TouchableOpacity key={index} activeOpacity={0.9} onPress={() => setPhotoTourVisible(true)}>
                                <Image
                                    source={img}
                                    style={{ width, height: '100%' }}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* See all photos */}
                    <TouchableOpacity
                        onPress={() => setPhotoTourVisible(true)}
                        style={{
                            position: 'absolute',
                            bottom: 48,
                            left: 24,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 9999,
                            zIndex: 10
                        }}
                    >
                        <Images size={14} color="white" />
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: 'white' }}>
                            See all photos
                        </Text>
                    </TouchableOpacity>

                    {/* Pagination dots indicator */}
                    {sliderImages.length > 1 && (
                        <View
                            style={{
                                position: 'absolute',
                                bottom: 48,
                                left: 0,
                                right: 0,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 6,
                                zIndex: 10
                            }}
                        >
                            {sliderImages.map((_: any, idx: number) => (
                                <View
                                    key={idx}
                                    style={{
                                        width: idx === activeImageIndex ? 16 : 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: idx === activeImageIndex ? 'white' : 'rgba(255, 255, 255, 0.5)'
                                    }}
                                />
                            ))}
                        </View>
                    )}

                    <View
                        style={{
                            position: 'absolute',
                            bottom: 48,
                            right: 24,
                            backgroundColor: '#BF592B',
                            paddingHorizontal: 18,
                            paddingVertical: 10,
                            borderRadius: 9999,
                            shadowColor: '#231915',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 8,
                            elevation: 5,
                            zIndex: 10
                        }}
                    >
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: 'white' }}>
                            GHS {currentPrice.toFixed(2)}
                        </Text>
                    </View>
                </View>

                {/* White Content Card curving over the image */}
                <View 
                    style={{ 
                        backgroundColor: '#FCFBFA', 
                        borderTopLeftRadius: 36, 
                        borderTopRightRadius: 36, 
                        marginTop: -32, 
                        paddingHorizontal: 20, 
                        paddingTop: 28,
                        shadowColor: '#231915',
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.04,
                        shadowRadius: 12,
                        elevation: 2
                    }}
                >
                    {/* Title & Best Seller Badge Section */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: '#231915', flex: 1, marginRight: 16, lineHeight: 32 }}>
                            {listing.title}
                        </Text>
                        <View style={{ backgroundColor: '#FFF1EC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#BF592B' }}>Best Seller</Text>
                        </View>
                    </View>

                    {/* Rating & Prep Time Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Star size={14} color="#BF592B" fill="#BF592B" />
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#BF592B' }}>
                                {listing.profiles?.rating || '4.8'}
                            </Text>
                        </View>
                        <Text style={{ color: '#DDC1B6', marginHorizontal: 2 }}>•</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Clock size={14} color="#56423B" />
                            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#56423B' }}>
                                Ready in {listing.prep_time_minutes || 30} min
                            </Text>
                        </View>
                    </View>

                    {/* Description */}
                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#56423B', lineHeight: 22, marginBottom: 20 }}>
                        {listing.description || "Authentic Ghanaian food served fresh. Cooked with traditional recipes passed down through generations in a clean host kitchen."}
                    </Text>

                    {/* Info Tags */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                        {(() => {
                            const cats = listing.category ? listing.category.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                            const finalCats = cats.length > 0 ? cats : ['Spicy Hearth'];
                            return finalCats.map((catName: string) => {
                                const style = CATEGORY_TAG_STYLES[catName] || DEFAULT_TAG_STYLE;
                                const IconComponent = style.icon;
                                return (
                                    <View key={catName} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: style.bg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: style.border }}>
                                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: style.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                                            <IconComponent size={12} color={style.iconColor} />
                                        </View>
                                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: style.text }}>
                                            {catName}
                                        </Text>
                                    </View>
                                );
                            });
                        })()}

                        {/* Always include Earthenware as a premium tag if not already selected */}
                        {!listing.category?.includes('Earthenware') && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF8F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#F2DFD7' }}>
                                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(132,82,60,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Utensils size={12} color="#8A7269" />
                                </View>
                                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#231915' }}>
                                    Earthenware
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Thin Divider */}
                    <View style={{ height: 1, backgroundColor: '#F2DFD7', marginVertical: 20 }} />

                    {/* Dine-In Experience Preview */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#231915', letterSpacing: 0.5, marginBottom: 14 }}>
                            Your Dine-In Experience Preview
                        </Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 12, paddingRight: 20 }}
                        >
                            {/* Card 1: Eating Kenkey */}
                            <View style={{ width: 220, height: 140, borderRadius: 18, overflow: 'hidden', position: 'relative', shadowColor: '#231915', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
                                <Image 
                                    source={DINE_IN_3} 
                                    style={{ width: '100%', height: '100%' }} 
                                    resizeMode="cover" 
                                />
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                                    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 55, paddingHorizontal: 10, paddingBottom: 10, justifyContent: 'flex-end' }}
                                >
                                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: 'white', lineHeight: 14 }}>
                                        True local flavors
                                    </Text>
                                </LinearGradient>
                            </View>

                            {/* Card 2: Group Dining */}
                            <View style={{ width: 220, height: 140, borderRadius: 18, overflow: 'hidden', position: 'relative', shadowColor: '#231915', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
                                <Image 
                                    source={DINE_IN_2} 
                                    style={{ width: '100%', height: '100%' }} 
                                    resizeMode="cover" 
                                />
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                                    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 55, paddingHorizontal: 10, paddingBottom: 10, justifyContent: 'flex-end' }}
                                >
                                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: 'white', lineHeight: 14 }}>
                                        Authentic dining seating
                                    </Text>
                                </LinearGradient>
                            </View>

                            {/* Card 3: Preparation */}
                            <View style={{ width: 220, height: 140, borderRadius: 18, overflow: 'hidden', position: 'relative', shadowColor: '#231915', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
                                <Image 
                                    source={DINE_IN_1} 
                                    style={{ width: '100%', height: '100%' }} 
                                    resizeMode="cover" 
                                />
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                                    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 55, paddingHorizontal: 10, paddingBottom: 10, justifyContent: 'flex-end' }}
                                >
                                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: 'white', lineHeight: 14 }}>
                                        Traditional food preparation
                                    </Text>
                                </LinearGradient>
                            </View>
                        </ScrollView>
                    </View>

                    {/* Thin Divider */}
                    <View style={{ height: 1, backgroundColor: '#F2DFD7', marginVertical: 20 }} />

                    {/* Dining Options */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#231915', letterSpacing: 0.5, marginBottom: 14 }}>
                            Dining Options
                        </Text>
                        <View style={{ flexDirection: 'column', gap: 14 }}>
                            {/* Pickup Option */}
                            <TouchableOpacity
                                onPress={() => setSelectedOption('takeaway')}
                                style={{
                                    backgroundColor: selectedOption === 'takeaway' ? '#FFF1EC' : 'white',
                                    borderWidth: 1.5,
                                    borderColor: selectedOption === 'takeaway' ? '#BF592B' : '#F2DFD7',
                                    borderRadius: 20,
                                    padding: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    position: 'relative',
                                    shadowColor: '#231915',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.04,
                                    shadowRadius: 6,
                                    elevation: 2
                                }}
                                activeOpacity={0.9}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
                                    <View style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 22,
                                        backgroundColor: selectedOption === 'takeaway' ? '#BF592B' : '#FFF1EC',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: selectedOption === 'takeaway' ? 0 : 1,
                                        borderColor: '#F2DFD7'
                                    }}>
                                        <ShoppingCart size={20} color={selectedOption === 'takeaway' ? 'white' : '#BF592B'} />
                                    </View>
                                    <View style={{ marginLeft: 14, flex: 1 }}>
                                        <Text style={{ 
                                            fontFamily: 'PlusJakartaSans_700Bold', 
                                            fontSize: 16, 
                                            color: selectedOption === 'takeaway' ? '#BF592B' : '#231915', 
                                            textTransform: 'uppercase' 
                                        }}>
                                            Pickup
                                        </Text>
                                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#8A7269', marginTop: 3 }} numberOfLines={2}>
                                            Order ready in 60 min. No service charge.
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ 
                                        fontFamily: 'PlusJakartaSans_700Bold', 
                                        fontSize: 15, 
                                        color: selectedOption === 'takeaway' ? '#BF592B' : '#231915' 
                                    }}>
                                        GHS {getOptionPrice('takeaway').toFixed(2)}
                                    </Text>
                                </View>
                                {selectedOption === 'takeaway' && (
                                    <View style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, backgroundColor: '#BF592B', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'white' }}>
                                        <Check size={12} color="white" strokeWidth={3} />
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Dine-In Option */}
                            <TouchableOpacity
                                onPress={() => setSelectedOption('standard')}
                                style={{
                                    backgroundColor: selectedOption === 'standard' ? '#FFF1EC' : 'white',
                                    borderWidth: 1.5,
                                    borderColor: selectedOption === 'standard' ? '#BF592B' : '#F2DFD7',
                                    borderRadius: 20,
                                    padding: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    position: 'relative',
                                    shadowColor: '#231915',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.04,
                                    shadowRadius: 6,
                                    elevation: 2
                                }}
                                activeOpacity={0.9}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
                                    <View style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 22,
                                        backgroundColor: selectedOption === 'standard' ? '#BF592B' : '#FFF1EC',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: selectedOption === 'standard' ? 0 : 1,
                                        borderColor: '#F2DFD7'
                                    }}>
                                        <Utensils size={20} color={selectedOption === 'standard' ? 'white' : '#BF592B'} />
                                    </View>
                                    <View style={{ marginLeft: 14, flex: 1 }}>
                                        <Text style={{ 
                                            fontFamily: 'PlusJakartaSans_700Bold', 
                                            fontSize: 16, 
                                            color: selectedOption === 'standard' ? '#BF592B' : '#231915', 
                                            textTransform: 'uppercase' 
                                        }}>
                                            Dine-In
                                        </Text>
                                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#8A7269', marginTop: 3 }} numberOfLines={2}>
                                            Authentic experience. Savor your meal in our handcrafted earthenware.
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ 
                                        fontFamily: 'PlusJakartaSans_700Bold', 
                                        fontSize: 15, 
                                        color: selectedOption === 'standard' ? '#BF592B' : '#231915' 
                                    }}>
                                        GHS {getOptionPrice('standard').toFixed(2)}
                                    </Text>
                                </View>
                                {selectedOption === 'standard' && (
                                    <View style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, backgroundColor: '#BF592B', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'white' }}>
                                        <Check size={12} color="white" strokeWidth={3} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Thin Divider */}
                    <View style={{ height: 1, backgroundColor: '#F2DFD7', marginVertical: 20 }} />

                    {/* Chef Section */}
                    <View style={{ marginBottom: 28 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#231915', letterSpacing: 0.5, marginBottom: 14 }}>
                            Chef
                        </Text>
                        <TouchableOpacity
                            onPress={() => router.push(`/cook/${listing.cook_id}`)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#FFF1EC',
                                borderRadius: 24,
                                padding: 16,
                                borderWidth: 1,
                                borderColor: '#F2DFD7'
                            }}
                            activeOpacity={0.8}
                        >
                            <View style={{ position: 'relative' }}>
                                <Image 
                                    source={{ uri: listing.profiles?.avatar_url || 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150' }} 
                                    style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#F2DFD7' }} 
                                />
                                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: '#006A3C', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'white' }}>
                                    <Check size={9} color="white" strokeWidth={3} />
                                </View>
                            </View>
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#231915' }}>
                                    {cookApp?.kitchen_name || listing.profiles?.full_name || "Tamara's Kitchen"}
                                </Text>
                                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#8A7269', marginTop: 2 }} numberOfLines={1}>
                                    Expertly chef and clean • 15y exp.
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <Star key={s} size={12} color="#BF592B" fill="#BF592B" />
                                    ))}
                                </View>
                            </View>
                            <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F2DFD7' }}>
                                <MessageSquare size={20} color="#231915" />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom sticky checkout bar */}
            <View
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    borderTopWidth: 1.5,
                    borderTopColor: '#F2DFD7',
                    paddingHorizontal: 20,
                    paddingTop: 16,
                    paddingBottom: insets.bottom + 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    zIndex: 30
                }}
            >
                {isOwner && isCookMode ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                        <View style={{ flex: 1, marginRight: 16 }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#231915' }}>Preview Mode</Text>
                            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#56423B', marginTop: 2 }}>This is how eaters see your dining experience.</Text>
                        </View>
                        <TouchableOpacity
                            style={{
                                backgroundColor: '#BF592B',
                                borderRadius: 16,
                                paddingVertical: 12,
                                paddingHorizontal: 20,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                shadowColor: '#BF592B',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 10,
                                elevation: 5
                            }}
                            onPress={() => router.push(`/(tabs)/cook?edit_id=${listing.id}`)}
                            activeOpacity={0.9}
                        >
                            <Pencil size={16} color="white" />
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: 'white' }}>Edit Dish</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Quantity Counter */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 14,
                            backgroundColor: '#FFF1EC',
                            borderRadius: 9999,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderWidth: 1,
                            borderColor: '#F2DFD7',
                            height: 52
                        }}>
                            <TouchableOpacity
                                onPress={() => setQuantity(q => Math.max(1, q - 1))}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Minus size={16} color="#BF592B" strokeWidth={2.5} />
                            </TouchableOpacity>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#231915', minWidth: 16, textAlign: 'center' }}>
                                {quantity}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setQuantity(q => q + 1)}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: '#BF592B',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Plus size={16} color="white" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>

                        {/* Booking CTA button */}
                        <TouchableOpacity
                            style={{
                                flex: 1,
                                backgroundColor: '#BF592B',
                                borderRadius: 9999,
                                height: 52,
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                shadowColor: '#BF592B',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 10,
                                elevation: 5
                            }}
                            onPress={handleAddToCart}
                            disabled={!listing.available}
                            activeOpacity={0.9}
                        >
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: 'white' }}>
                                {selectedOption === 'takeaway' ? 'Reserve & Pickup' : 'Reserve & Dine-In'}
                            </Text>
                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                                Total: GHS {(currentPrice * quantity).toFixed(2)}
                            </Text>
                        </TouchableOpacity>

                        {/* Cart shortcut */}
                        <TouchableOpacity
                            onPress={() => router.push('/cart')}
                            style={{
                                width: 52,
                                height: 52,
                                borderRadius: 26,
                                backgroundColor: '#BF592B',
                                alignItems: 'center',
                                justifyContent: 'center',
                                shadowColor: '#BF592B',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 10,
                                elevation: 5
                            }}
                        >
                            <ShoppingCart size={20} color="white" />
                            {getCartCount() > 0 && (
                                <View style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#231915', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: 'white', fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold' }}>{getCartCount()}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </View>

            <CartToast
                visible={cartToast.visible}
                message={cartToast.message}
                bottomOffset={insets.bottom + 92}
                onPress={() => router.push('/cart')}
                onHide={() => setCartToast((prev) => ({ ...prev, visible: false }))}
            />

            {/* Photo tour */}
            <Modal visible={photoTourVisible} animationType="slide" onRequestClose={() => setPhotoTourVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'white', paddingTop: insets.top }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
                        <TouchableOpacity onPress={() => setPhotoTourVisible(false)} style={{ padding: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <ArrowLeft size={22} color="#231915" />
                        </TouchableOpacity>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915' }}>Photo tour</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                            <TouchableOpacity onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Share2 size={19} color="#231915" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={toggleSaved} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Heart size={19} color={saved ? '#BA1A1A' : '#231915'} fill={saved ? '#BA1A1A' : 'transparent'} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Section thumbnail nav */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ flexGrow: 0, flexShrink: 0, height: 204 }}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingTop: 4, paddingBottom: 16 }}
                    >
                        <TouchableOpacity onPress={() => scrollToSection('dish')} activeOpacity={0.85} style={{ alignItems: 'center', width: 96 }}>
                            <Image source={sliderImages[0]} style={{ width: 96, height: 124, borderRadius: 16 }} resizeMode="cover" />
                            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 16, color: '#231915', marginTop: 8, textAlign: 'center' }}>
                                The Dish
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => scrollToSection('dining')} activeOpacity={0.85} style={{ alignItems: 'center', width: 96 }}>
                            <Image source={DINE_IN_PHOTOS[0].image} style={{ width: 96, height: 124, borderRadius: 16 }} resizeMode="cover" />
                            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 16, color: '#231915', marginTop: 8, textAlign: 'center' }}>
                                Dining{'\n'}Experience
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Full photo list */}
                    <ScrollView ref={photoTourScrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 32 }}>
                        <View onLayout={(e) => { sectionOffsets.current.dish = e.nativeEvent.layout.y; }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, color: '#231915', paddingHorizontal: 20, marginBottom: 16 }}>
                                The Dish
                            </Text>
                            {sliderImages.map((img: any, index: number) => (
                                <TouchableOpacity key={index} activeOpacity={0.9} onPress={() => setLightboxIndex(index)} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                                    <Image
                                        source={img}
                                        style={{ width: '100%', height: 300, borderRadius: 24 }}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View onLayout={(e) => { sectionOffsets.current.dining = e.nativeEvent.layout.y; }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, color: '#231915', paddingHorizontal: 20, marginBottom: 4 }}>
                                Dining Experience
                            </Text>
                            {DINE_IN_PHOTOS.map((photo, index) => (
                                <View key={index} style={{ marginTop: 16 }}>
                                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#56423B', paddingHorizontal: 20, marginBottom: 12 }}>
                                        {photo.caption}
                                    </Text>
                                    <TouchableOpacity activeOpacity={0.9} onPress={() => setLightboxIndex(sliderImages.length + index)} style={{ paddingHorizontal: 20 }}>
                                        <Image
                                            source={photo.image}
                                            style={{ width: '100%', height: 300, borderRadius: 24 }}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Swipeable lightbox */}
                    {lightboxIndex !== null && (
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFF8F6', zIndex: 100 }}>
                            <FlatList
                                ref={lightboxRef}
                                data={allPhotos}
                                keyExtractor={(_, i) => String(i)}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                initialScrollIndex={lightboxIndex}
                                getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
                                onMomentumScrollEnd={(e) => {
                                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                                    setLightboxIndex(idx);
                                }}
                                renderItem={({ item }) => (
                                    <View style={{ width, height, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                                        <Image
                                            source={item.image}
                                            style={{ width: width - 32, height: height * 0.7, borderRadius: 24 }}
                                            resizeMode="contain"
                                        />
                                    </View>
                                )}
                            />

                            {/* Top controls */}
                            <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <TouchableOpacity
                                    onPress={() => setLightboxIndex(null)}
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: 'white',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        shadowColor: '#231915',
                                        shadowOffset: { width: 0, height: 3 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 6,
                                        elevation: 4
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <X size={20} color="#231915" />
                                </TouchableOpacity>
                                <View
                                    style={{
                                        backgroundColor: 'white',
                                        paddingHorizontal: 12,
                                        paddingVertical: 8,
                                        borderRadius: 9999,
                                        shadowColor: '#231915',
                                        shadowOffset: { width: 0, height: 3 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 6,
                                        elevation: 4
                                    }}
                                >
                                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#231915' }}>
                                        {lightboxIndex + 1} / {allPhotos.length}
                                    </Text>
                                </View>
                            </View>

                            {/* Bottom caption */}
                            <View style={{ position: 'absolute', bottom: insets.bottom + 24, left: 20, right: 20, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#BF592B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                                    {allPhotos[lightboxIndex]?.section}
                                </Text>
                                {allPhotos[lightboxIndex]?.caption && (
                                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: '#231915' }}>
                                        {allPhotos[lightboxIndex]?.caption}
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </Modal>
        </View>
    );
}
