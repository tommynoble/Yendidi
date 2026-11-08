import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, Dimensions, Share, StyleSheet, Modal, FlatList } from 'react-native';
const { width, height } = Dimensions.get('window');
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft, Heart, Star, Plus, Minus, ChefHat, Flame,
    ShoppingCart, MapPin, Utensils, Navigation, Share2, Upload, Pencil,
    Sparkles, Shield, Check, Wifi, Music, Car, Droplet,
    Info, ChevronRight, CheckCircle2, Coffee, Users as UsersIcon, Leaf,
    Wheat, Soup, Apple, Fish, Cake, Sprout, X
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
    'Rice Dishes': { bg: palette.surface, border: '#F2DFD7', text: palette.ink, iconBg: 'rgba(194, 83, 39,0.1)', iconColor: palette.accent, icon: Wheat },
    'Soups & Stews': { bg: palette.surface, border: '#F2DFD7', text: palette.ink, iconBg: 'rgba(194, 83, 39,0.1)', iconColor: palette.accent, icon: Soup },
    'Grills & Kebabs': { bg: palette.surface, border: '#F2DFD7', text: palette.ink, iconBg: 'rgba(194, 83, 39,0.1)', iconColor: palette.accent, icon: Flame },
    'Traditional Snacks': { bg: palette.surface, border: '#F2DFD7', text: palette.ink, iconBg: 'rgba(194, 83, 39,0.1)', iconColor: palette.accent, icon: Apple },
    'Seafood': { bg: '#EBF5FF', border: '#CCE5FF', text: palette.ink, iconBg: 'rgba(0,102,204,0.1)', iconColor: '#0066CC', icon: Fish },
    'Pastries': { bg: '#FFF0F5', border: '#FFD2E5', text: palette.ink, iconBg: 'rgba(194, 83, 39,0.1)', iconColor: palette.accent, icon: Cake },
    'Vegan': { bg: '#FFF1EC', border: 'rgba(194, 83, 39,0.3)', text: palette.ink, iconBg: 'rgba(194, 83, 39,0.12)', iconColor: palette.accent, icon: Leaf },
    'Vegetarian': { bg: '#FFF1EC', border: 'rgba(194, 83, 39,0.3)', text: palette.ink, iconBg: 'rgba(194, 83, 39,0.12)', iconColor: palette.accent, icon: Sprout }
};

const DEFAULT_TAG_STYLE = { bg: palette.surface, border: '#F2DFD7', text: palette.ink, iconBg: 'rgba(132,82,60,0.1)', iconColor: palette.muted, icon: Utensils };
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
import SeatStack from '@/components/SeatStack';
import ShimmerImage from '@/components/ShimmerImage';
import { SESSION_SERVING_CAP } from '@/lib/schedule';
import { formatPotCountdown } from '@/lib/countdown';
import TimeLocationCards from '@/components/TimeLocationCards';
import { palette, type, fonts } from '@/constants/theme';
import { REQUIRE_ID_TO_BOOK, canBook, idVerificationHref, setAfterIdGate } from '@/lib/idVerification';
import RibbonBadgeIcon from '@/components/RibbonBadgeIcon';
import SectionHeader from '@/components/SectionHeader';
import CourseList, { Course } from '@/components/CourseList';
import TableGuests from '@/components/TableGuests';
import GatheringNotes from '@/components/GatheringNotes';
import { format } from 'date-fns';

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
    const [selectedOption] = useState<'standard' | 'vip' | 'takeaway'>('standard');
    const [mapVisible, setMapVisible] = useState(false);
    const [cartToast, setCartToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
    const [photoTourVisible, setPhotoTourVisible] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const photoTourScrollRef = useRef<ScrollView>(null);
    const heroSliderRef = useRef<ScrollView>(null);
    const lightboxRef = useRef<FlatList>(null);
    const sectionOffsets = useRef<Record<string, number>>({});
    const FAVORITES_KEY = 'yendidii_favorites';

    // "Tap to confirm" on the date card. Deliberately not saved: leaving the page resets it, so guests confirm again on return.
    const [confirmed, setConfirmed] = useState(false);
    const toggleConfirmed = () => setConfirmed(c => !c);

    // Keep the pot countdown/seats card and the order-deadline gate live while
    // this screen stays open, instead of a snapshot frozen at first render.
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(interval);
    }, []);

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
                .select('*, profiles(id, full_name, avatar_url, kitchen_image_url, rating, served_count, verified, location, location_description)')
                .eq('id', id as string)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // "Join the Pot" — real count of seats already booked for this scheduled session.
    // `portions_available` already live-decrements as bookings come in (see cart.tsx),
    // so it IS the remaining-seats count; booked + remaining reconstructs total capacity.
    const { data: potBookedCount = 0 } = useQuery({
        queryKey: ['listing-order-count', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('order_items')
                .select('quantity, orders!inner(status)')
                .eq('listing_id', id as string)
                .neq('orders.status', 'Cancelled');

            if (error) {
                console.error('Error fetching pot booked count:', error);
                return 0;
            }
            return (data || []).reduce((sum: number, item: any) => sum + item.quantity, 0);
        },
        enabled: !!id && !!listing && !!listing.order_deadline,
    });

    // Fetch cook's application (bio, kitchen name, specialties, location)
    const { data: cookApp } = useQuery({
        queryKey: ['cook-application', listing?.cook_id],
        queryFn: async () => {
            const { data } = await supabase
                .from('cook_applications')
                .select('kitchen_name, bio, location, location_description, specialties, cooking_frequency, max_session_capacity')
                .eq('user_id', listing.cook_id)
                .eq('status', 'approved')
                .single();
            return data;
        },
        enabled: !!listing?.cook_id,
    });

    // Review count for the "★ rating · N reviews" line
    const { data: reviewCount } = useQuery({
        queryKey: ['cook-review-count', listing?.cook_id],
        queryFn: async () => {
            const { count } = await supabase
                .from('reviews')
                .select('id', { count: 'exact', head: true })
                .eq('cook_id', listing.cook_id);
            return count || 0;
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

    const deadlinePassed = !!listing?.order_deadline && new Date(listing.order_deadline).getTime() < now;
    // "Event started" only means something if the pot actually filled — a
    // deadline that passed with the session still mostly empty is a
    // different, more honest state, not a success worth the same copy.
    const potTotalSeats = (listing?.portions_available || 0) + potBookedCount;
    const potFilledEnough = potTotalSeats > 0 && potBookedCount >= potTotalSeats / 2;
    const potDidNotFill = deadlinePassed && !potFilledEnough;

    const handleAddToCart = async () => {
        if (!listing) return;
        if (deadlinePassed) return;
        // Soft gate: browsing is free, but the first booking needs a verified ID (or "Maybe later" for now).
        if (REQUIRE_ID_TO_BOOK && !(await canBook())) {
            // After "Maybe later": add the seats and go straight to the cart to pay.
            setAfterIdGate(() => { addToCartNow(); router.push('/cart'); });
            router.push(idVerificationHref(`/listing/${listing.id}`));
            return;
        }
        addToCartNow();
    };

    const addToCartNow = () => {
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
            console.error('Error sharing:', error);
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
            <View className="flex-1 items-center justify-center bg-surface">
                <ActivityIndicator size="large" color="#D65A31" />
            </View>
        );
    }

    if (error || !listing) {
        return (
            <View className="flex-1 items-center justify-center bg-surface px-6">
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
        <View style={{ flex: 1, backgroundColor: palette.canvas }}>
            {/* Floating Top Navigation Overlay */}
            <View
                style={{
                    position: 'absolute',
                    left: 20,
                    right: 20,
                    top: insets.top + 8,
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
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: palette.ink,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.18,
                        shadowRadius: 6,
                        elevation: 4
                    }}
                    onPress={() => router.back()}
                >
                    <ArrowLeft size={20} color="white" />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(0,0,0,0.35)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: palette.ink,
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.18,
                            shadowRadius: 6,
                            elevation: 4
                        }}
                        onPress={handleShare}
                    >
                        <Share2 size={18} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(0,0,0,0.35)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: palette.ink,
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.18,
                            shadowRadius: 6,
                            elevation: 4
                        }}
                        onPress={toggleSaved}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Heart size={18} color={saved ? palette.accent : 'white'} fill={saved ? palette.accent : 'transparent'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView 
                style={{ flex: 1 }} 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ paddingBottom: 130 }}
            >
                {/* Hero Image Slider — curved bottom layout */}
                <View style={{ height: 400, width: '100%', position: 'relative' }}>
                    <ScrollView
                        ref={heroSliderRef}
                        horizontal
                        pagingEnabled
                        directionalLockEnabled
                        nestedScrollEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={(e) => {
                            const contentOffset = e.nativeEvent.contentOffset.x;
                            const index = Math.round(contentOffset / width);
                            setActiveImageIndex(index);
                        }}
                        onMomentumScrollEnd={(e) => {
                            const index = Math.round(e.nativeEvent.contentOffset.x / width);
                            setActiveImageIndex(index);
                        }}
                        scrollEventThrottle={16}
                        style={{ width: '100%', height: '100%' }}
                    >
                        {sliderImages.map((img: any, index: number) => (
                            <Pressable
                                key={index}
                                style={{ width, height: '100%' }}
                                onPress={() => setPhotoTourVisible(true)}
                            >
                                <ShimmerImage source={img} style={{ width, height: '100%' }} />
                            </Pressable>
                        ))}
                    </ScrollView>

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

                </View>

                {/* White Content Card curving over the image */}
                <View
                    style={{
                        backgroundColor: palette.canvas,
                        borderTopLeftRadius: 36,
                        borderTopRightRadius: 36,
                        marginTop: -32,
                        paddingHorizontal: 20,
                        paddingTop: 40,
                        shadowColor: palette.ink,
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.07,
                        shadowRadius: 12,
                        elevation: 2
                    }}
                >
                    {/* Title */}
                    <Text style={{ ...type.hero, color: palette.ink, lineHeight: 32, textAlign: 'left', marginBottom: 12 }}>
                        {listing.title}
                    </Text>

                    {/* Food description */}
                    {!!listing.description?.trim() && (
                        <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.bodyText, lineHeight: 22, textAlign: 'left', marginBottom: 18 }}>
                            {listing.description.trim()}
                        </Text>
                    )}

                    {/* Avatar Stack — who's already in */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10, marginBottom: 6 }}>
                        <SeatStack id={listing.id} booked={Math.max(0, SESSION_SERVING_CAP - (listing.portions_available ?? SESSION_SERVING_CAP))} size={36} />
                        <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.muted }}>
                            Already at the table
                        </Text>
                    </View>

                    {/* Rating, Reviews & Prep Time Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Star size={14} color={palette.accent} fill={palette.accent} />
                            <Text style={{ ...type.body, fontFamily: fonts.bold, color: palette.ink }}>
                                {listing.profiles?.rating ? Number(listing.profiles.rating).toFixed(1) : 'New'}
                            </Text>
                        </View>
                        {(reviewCount ?? 0) > 0 && (
                            <>
                                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(122, 92, 83, 0.5)', marginHorizontal: 3 }} />
                                <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.ink }}>
                                    {reviewCount} review{reviewCount === 1 ? '' : 's'}
                                </Text>
                            </>
                        )}
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(122, 92, 83, 0.5)', marginHorizontal: 3 }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Flame size={14} color={palette.accent} strokeWidth={2.75} />
                            <Text style={{ ...type.body, fontFamily: fonts.bold, color: palette.accent }}>
                                {listing.portions_available} seat{listing.portions_available === 1 ? '' : 's'} left
                            </Text>
                        </View>
                    </View>

                    {/* Thin Divider */}
                    <View style={{ height: 1, backgroundColor: 'rgba(86,66,59,0.15)', marginBottom: 14 }} />

                    {/* Hosted By Row */}
                    <TouchableOpacity
                        onPress={() => router.push(`/cook/${listing.cook_id}`)}
                        activeOpacity={0.8}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}
                    >
                        <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: '#FFDBCE', alignItems: 'center', justifyContent: 'center' }}>
                            {(listing.profiles?.avatar_url || listing.profiles?.kitchen_image_url) ? (
                                <Image
                                    source={{ uri: listing.profiles?.avatar_url || listing.profiles?.kitchen_image_url }}
                                    style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#F2DFD7' }}
                                />
                            ) : (
                                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#F2DFD7', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 21, color: '#944421' }}>
                                        {(listing.profiles?.full_name || cookApp?.kitchen_name || 'H').trim().charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <View style={{ position: 'absolute', bottom: 1, right: 1, width: 21, height: 21, borderRadius: 10.5, backgroundColor: '#FFCD00', alignItems: 'center', justifyContent: 'center' }}>
                                <RibbonBadgeIcon height={13} />
                            </View>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ ...type.cardTitleSmall, color: palette.ink, textAlign: 'left' }} numberOfLines={1}>
                                Hosted by {cookApp?.kitchen_name || listing.profiles?.full_name || 'the host'}
                            </Text>
                            <Text style={{ ...type.meta, color: palette.bodyText, textAlign: 'left' }}>
                                Verified Host · {listing.profiles?.served_count > 0 ? `${listing.profiles.served_count}+ served` : 'New Host'}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Highlights — three boxes, all from the event's real details */}
                    {(() => {
                        const where = (listing.location_text || cookApp?.location || listing.profiles?.location || '').split(',')[0].trim();
                        const courseCount = [listing.drinks, listing.starter, listing.main_dish, listing.sides_dessert].filter((v) => (v || '').trim()).length;
                        const highlights = [
                            { icon: <MapPin size={16} color={palette.accent} />, title: where || 'Local gathering', sub: 'Hosted in their home' },
                            { icon: <Utensils size={16} color={palette.accent} />, title: courseCount > 0 ? `${courseCount}-Course Menu` : 'Home-cooked', sub: courseCount > 0 ? 'Set by your host' : 'Made by your host' },
                            { icon: <Shield size={16} color={palette.accent} />, title: 'Verified Host', sub: 'Approved by YenDidii' },
                        ];
                        return (
                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
                                {highlights.map((h) => (
                                    <View key={h.title} style={{ flex: 1, backgroundColor: palette.surface, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', gap: 4 }}>
                                        {h.icon}
                                        <View style={{ alignItems: 'center' }}>
                                            <Text style={{ ...type.meta, fontFamily: 'PlusJakartaSans_600SemiBold', color: palette.ink, textAlign: 'center' }} numberOfLines={1}>{h.title}</Text>
                                            <Text style={{ ...type.micro, fontFamily: 'PlusJakartaSans_500Medium', color: palette.bodyText, textAlign: 'center' }} numberOfLines={1}>{h.sub}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        );
                    })()}

                    {/* Hearth experience, host highlight, time & location */}
                    {(() => {
                        const start = listing.order_deadline ? new Date(listing.order_deadline) : null;
                        const scheduled = !!start && !isNaN(start.getTime());
                        // Placeholder date until sessions have real dates; swap in the booking's date when it exists.
                        const hostLocation = listing.location_text || cookApp?.location || listing.profiles?.location || 'Ghana';
                        // Nearby landmark line; placeholder until hosts add one.
                        const landmark = (cookApp?.location_description || listing.profiles?.location_description || '').trim();
                        const nearby = landmark ? (/^near\b/i.test(landmark) ? landmark : `Near ${landmark}`) : 'Near Ecobank';

                        return (
                            <View style={{ gap: 28, marginBottom: 28 }}>
                                <TimeLocationCards
                                    confirmed={confirmed}
                                    onConfirmPress={toggleConfirmed}
                                    dateTitle={scheduled ? format(start as Date, 'EEEE, MMM d') : 'Saturday, Nov 14'}
                                    timeLine={scheduled ? format(start as Date, 'h:mm a') : '6:00 PM'}
                                    locationTitle={hostLocation}
                                    locationTag="Private Residence"
                                    locationLine={nearby}
                                />
                            </View>
                        );
                    })()}

                    {/* Courses come only from what the host entered. No main dish entered means no Main Course card. */}
                    {(() => {
                        const drinks = (listing.drinks || '').trim();
                        const starter = (listing.starter || '').trim();
                        const mainDish = (listing.main_dish || '').trim();
                        const sides = (listing.sides_dessert || '').trim();
                        const cats = listing.category ? listing.category.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
                        const courses: Course[] = [
                            ...(drinks ? [{ title: drinks, tag: 'Drinks' }] : []),
                            ...(starter ? [{ title: starter, tag: 'Starter' }] : []),
                            ...(mainDish ? [{
                                title: mainDish,
                                tag: 'Main Course',
                                highlight: true,
                                chips: cats.length > 0 ? cats : undefined,
                            }] : []),
                            ...(sides ? [{ title: sides, tag: 'Sides & Dessert' }] : []),
                        ];
                        if (courses.length === 0) return null;
                        return (
                            <>
                                {/* Thin Divider */}
                                <View style={{ height: 1, backgroundColor: 'rgba(86,66,59,0.15)', marginBottom: 20 }} />
                                <SectionHeader
                                    inset={false}
                                    title="On the Table"
                                    subtitle={mainDish ? (courses.length === 1 ? `Led by ${mainDish}` : `${courses.length} courses, led by ${mainDish}`) : `${courses.length} ${courses.length === 1 ? 'course' : 'courses'} from the host`}
                                    badge={courses.length > 1 ? `${courses.length} Courses` : undefined}
                                    extraBottom={12}
                                />
                                <View style={{ marginBottom: 24 }}>
                                    <CourseList courses={courses} />
                                </View>
                            </>
                        );
                    })()}

                    {/* Thin Divider */}
                    <View style={{ height: 1, backgroundColor: 'rgba(86,66,59,0.15)', marginBottom: 14 }} />

                    {/* Sample UI content — real guests will come from bookings later */}
                    <SectionHeader
                        inset={false}
                        title="Who's at the Table"
                        subtitle="4 seats claimed • 4 spaces waiting"
                        badge="Friendly crowd"
                        extraBottom={12}
                    />
                    <View style={{ marginBottom: 24 }}>
                        <TableGuests
                            showHeader={false}
                            seatsClaimed={4}
                            spacesWaiting={4}
                            guests={[
                                { name: 'Kwesi O.', role: 'Architect' },
                                { name: 'Abena M.', role: 'Designer' },
                                { name: 'Nana K.', role: 'Musician' },
                                { name: 'Sarah T.', role: 'Traveler' },
                            ]}
                        />
                    </View>

                    {/* Gathering notes: the atmosphere and dietary tags the host picked. Hidden when none. */}
                    {(() => {
                        const atmosphere: string[] = listing.atmosphere_tags || [];
                        const dietary: string[] = listing.dietary_tags || [];
                        return (
                            <>
                                {/* Thin Divider */}
                                <View style={{ height: 1, backgroundColor: 'rgba(86,66,59,0.15)', marginBottom: 14 }} />
                                <SectionHeader
                                    inset={false}
                                    title="Gathering Notes"
                                    subtitle="Atmosphere and dietary details to know before you come"
                                    extraBottom={12}
                                />
                                <View style={{ marginBottom: 24 }}>
                                    <GatheringNotes
                                        notes={[
                                            ...(atmosphere.length > 0 ? [{ label: 'Atmosphere', text: atmosphere.join(', ') }] : []),
                                            ...(dietary.length > 0
                                                ? [{ label: 'Dietary', text: `${dietary.join(', ')}. Stated by the host, so please confirm any allergies with them before booking.` }]
                                                : [{ label: 'Allergies', text: 'Tell the host about any allergies or dietary needs when you book.' }]),
                                        ]}
                                    />
                                </View>
                            </>
                        );
                    })()}

                    {/* Thin Divider */}
                    <View style={{ height: 1, backgroundColor: '#F2DFD7', marginTop: 4, marginBottom: 8 }} />

                    {/* The host's own photos. Heading is the drinks they included; hidden when they added no photos. */}
                    {(() => {
                        const hostPhotos: string[] = listing.image ? listing.image.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
                        if (hostPhotos.length === 0) return null;
                        const drinks = (listing.drinks || '').trim();
                        return (
                            <View style={{ marginBottom: 20 }}>
                                <SectionHeader
                                    inset={false}
                                    title={drinks || 'Step Into the Hearth'}
                                    subtitle="See what dining at this home looks and feels like"
                                    extraBottom={8}
                                />
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 12, paddingRight: 20 }}
                                >
                                    {hostPhotos.map((img, i) => (
                                        <View key={`${img}-${i}`} style={{ width: 220, height: 140, borderRadius: 18, overflow: 'hidden', shadowColor: palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 }}>
                                            <Image
                                                source={getDishImage(listing.title, img)}
                                                style={{ width: '100%', height: '100%' }}
                                                resizeMode="cover"
                                            />
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        );
                    })()}


                </View>
            </ScrollView>

            {/* Bottom sticky checkout bar */}
            <View
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: palette.surface,
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
                            <Text style={{ ...type.cardTitleSmall, color: palette.ink }}>Preview Mode</Text>
                            <Text style={{ ...type.meta, fontFamily: fonts.regular, color: palette.muted, marginTop: 2 }}>This is how eaters see your dining experience.</Text>
                        </View>
                        <TouchableOpacity
                            style={{
                                backgroundColor: palette.accent,
                                borderRadius: 16,
                                paddingVertical: 12,
                                paddingHorizontal: 20,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                shadowColor: palette.accent,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 10,
                                elevation: 5
                            }}
                            onPress={() => router.push(`/(tabs)/cook?edit_id=${listing.id}`)}
                            activeOpacity={0.9}
                        >
                            <Pencil size={16} color="white" />
                            <Text style={{ ...type.cardTitleSmall, color: 'white' }}>Edit Event</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Quantity Counter */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 14,
                            backgroundColor: palette.canvas,
                            borderRadius: 16,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderWidth: 1,
                            borderColor: '#F2DFD7',
                            height: 52
                        }}>
                            <TouchableOpacity
                                onPress={() => setQuantity(q => Math.max(1, q - 1))}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    backgroundColor: palette.surface,
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Minus size={16} color={palette.accent} strokeWidth={2.5} />
                            </TouchableOpacity>
                            <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink, minWidth: 16, textAlign: 'center' }}>
                                {quantity}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setQuantity(q => q + 1)}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    backgroundColor: palette.accent,
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
                                backgroundColor: palette.accent,
                                borderRadius: 16,
                                height: 52,
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                shadowColor: palette.accent,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 10,
                                elevation: 5
                            }}
                            onPress={handleAddToCart}
                            disabled={!listing.available || deadlinePassed}
                            activeOpacity={0.9}
                        >
                            <Text style={{ ...type.card, fontFamily: fonts.extrabold, color: 'white' }}>
                                {deadlinePassed ? 'Orders Closed' : 'Reserve seats'}
                            </Text>
                            <Text style={{ ...type.micro, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                                Total GHS {(currentPrice * quantity).toFixed(2)}
                            </Text>
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
                <View style={{ flex: 1, backgroundColor: palette.surface, paddingTop: insets.top }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
                        <TouchableOpacity onPress={() => setPhotoTourVisible(false)} style={{ padding: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <ArrowLeft size={22} color={palette.ink} />
                        </TouchableOpacity>
                        <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink }}>Photo tour</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                            <TouchableOpacity onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Share2 size={19} color={palette.ink} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={toggleSaved} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Heart size={19} color={saved ? palette.accent : palette.ink} fill={saved ? palette.accent : 'transparent'} />
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
                            <Text style={{ ...type.meta, lineHeight: 16, color: palette.ink, marginTop: 8, textAlign: 'center' }}>
                                The Dish
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => scrollToSection('dining')} activeOpacity={0.85} style={{ alignItems: 'center', width: 96 }}>
                            <Image source={DINE_IN_PHOTOS[0].image} style={{ width: 96, height: 124, borderRadius: 16 }} resizeMode="cover" />
                            <Text style={{ ...type.meta, lineHeight: 16, color: palette.ink, marginTop: 8, textAlign: 'center' }}>
                                Dining{'\n'}Experience
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Full photo list */}
                    <ScrollView ref={photoTourScrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 32 }}>
                        <View onLayout={(e) => { sectionOffsets.current.dish = e.nativeEvent.layout.y; }}>
                            <Text style={{ ...type.section, color: palette.ink, paddingHorizontal: 20, marginBottom: 16 }}>
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
                            <Text style={{ ...type.section, color: palette.ink, paddingHorizontal: 20, marginBottom: 4 }}>
                                Dining Experience
                            </Text>
                            {DINE_IN_PHOTOS.map((photo, index) => (
                                <View key={index} style={{ marginTop: 16 }}>
                                    <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.bodyText, paddingHorizontal: 20, marginBottom: 12 }}>
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
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.surface, zIndex: 100 }}>
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
                                        backgroundColor: palette.surface,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        shadowColor: palette.ink,
                                        shadowOffset: { width: 0, height: 3 },
                                        shadowOpacity: 0.18,
                                        shadowRadius: 6,
                                        elevation: 4
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <X size={20} color={palette.ink} />
                                </TouchableOpacity>
                                <View
                                    style={{
                                        backgroundColor: palette.surface,
                                        paddingHorizontal: 12,
                                        paddingVertical: 8,
                                        borderRadius: 9999,
                                        shadowColor: palette.ink,
                                        shadowOffset: { width: 0, height: 3 },
                                        shadowOpacity: 0.18,
                                        shadowRadius: 6,
                                        elevation: 4
                                    }}
                                >
                                    <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: palette.ink }}>
                                        {lightboxIndex + 1} / {allPhotos.length}
                                    </Text>
                                </View>
                            </View>

                            {/* Bottom caption */}
                            <View style={{ position: 'absolute', bottom: insets.bottom + 24, left: 20, right: 20, alignItems: 'center' }}>
                                <Text style={{ ...type.meta, fontFamily: fonts.bold, color: palette.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                                    {allPhotos[lightboxIndex]?.section}
                                </Text>
                                {allPhotos[lightboxIndex]?.caption && (
                                    <Text style={{ ...type.card, fontFamily: fonts.medium, color: palette.ink }}>
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
