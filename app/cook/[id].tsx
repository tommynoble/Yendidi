import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Share as RNShare } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Share2, Heart, BadgeCheck, MapPin, Star, ChefHat, Clock, Users, Navigation, ChevronDown, ChevronUp, ArrowRight, Leaf, Sun, Moon, Calendar, Utensils, Hourglass } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow, format } from 'date-fns';

const FAVORITE_COOKS_KEY = 'yendidii_favorite_cooks';

export default function CookProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [bioExpanded, setBioExpanded] = useState(false);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        if (!id) return;
        AsyncStorage.getItem(FAVORITE_COOKS_KEY).then(raw => {
            if (raw) setIsFavorite(JSON.parse(raw).includes(id));
        });
    }, [id]);

    const toggleFavorite = async () => {
        const raw = await AsyncStorage.getItem(FAVORITE_COOKS_KEY);
        const current: string[] = raw ? JSON.parse(raw) : [];
        const updated = current.includes(id as string) ? current.filter(c => c !== id) : [...current, id as string];
        await AsyncStorage.setItem(FAVORITE_COOKS_KEY, JSON.stringify(updated));
        setIsFavorite(updated.includes(id as string));
    };

    const { data: cook, isLoading: isCookLoading } = useQuery({
        queryKey: ['cook', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, kitchen_image_url')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    const { data: meals, isLoading: isMealsLoading } = useQuery({
        queryKey: ['cook-meals', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('listings')
                .select('*, profiles(full_name, avatar_url)')
                .eq('cook_id', id)
                .eq('available', true);
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // Fetch cook application for extra details
    const { data: cookApp } = useQuery({
        queryKey: ['cook-application', id],
        queryFn: async () => {
            const { data } = await supabase
                .from('cook_applications')
                .select('kitchen_name, bio, location, location_description, specialties, cooking_frequency, max_session_capacity')
                .eq('user_id', id)
                .eq('status', 'approved')
                .single();
            return data;
        },
        enabled: !!id,
    });

    const { data: reviews, isLoading: isReviewsLoading } = useQuery({
        queryKey: ['cook-reviews', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('reviews')
                .select('*, profiles:user_id (full_name, avatar_url)')
                .eq('cook_id', id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // Upcoming gatherings = "Join the Pot" listings whose session hasn't started yet.
    const now = Date.now();
    const gatherings = (meals || [])
        .filter((m: any) => m.order_deadline && new Date(m.order_deadline).getTime() > now)
        .sort((a: any, b: any) => new Date(a.order_deadline).getTime() - new Date(b.order_deadline).getTime());
    const gatheringIds = gatherings.map((g: any) => g.id);

    // Seats already booked per gathering. `portions_available` is the live remaining
    // count, so booked + remaining reconstructs total capacity (same as listing/[id]).
    const { data: bookedByListing = {} } = useQuery({
        queryKey: ['cook-gathering-booked', id, gatheringIds.join(',')],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('order_items')
                .select('listing_id, quantity, orders!inner(status)')
                .in('listing_id', gatheringIds)
                .neq('orders.status', 'Cancelled');
            if (error) return {} as Record<string, number>;
            const totals: Record<string, number> = {};
            (data || []).forEach((item: any) => {
                totals[item.listing_id] = (totals[item.listing_id] || 0) + item.quantity;
            });
            return totals;
        },
        enabled: gatheringIds.length > 0,
    });

    const isLoading = isCookLoading || isMealsLoading;

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-warm-cream">
                <ActivityIndicator size="large" color="#D65A31" />
            </View>
        );
    }

    if (!cook) {
        return (
            <View className="flex-1 items-center justify-center bg-warm-cream px-6">
                <Text className="text-lg text-text-sub font-sans text-center">Host not found.</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-clay-primary font-bold font-sans-bold">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const kitchenName = cook.kitchen_name || cookApp?.kitchen_name;
    const cookBio = cook.bio || cookApp?.bio;
    const cookLocation = cook.location || cookApp?.location;
    const cookLandmark = cook.location_description || cookApp?.location_description;
    const specialties = cook.specialties || cookApp?.specialties || [];
    const capacity = cookApp?.max_session_capacity;
    const frequencyLabel = cookApp?.cooking_frequency
        ? cookApp.cooking_frequency.replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase())
        : null;
    const joinedDate = new Date(cook.created_at || cook.updated_at);

    const menuMeals = (meals || []).filter((m: any) => !gatheringIds.includes(m.id));
    const visibleReviews = showAllReviews ? reviews : reviews?.slice(0, 2);
    const photos = Array.from(new Set(
        [cook.kitchen_image_url, ...((meals || []).flatMap((m: any) => (m.image ? m.image.split(',').map((s: string) => s.trim()) : [])))]
            .filter(Boolean)
    ));

    const handleShare = () => {
        RNShare.share({ message: `Check out ${kitchenName || cook.full_name || 'this kitchen'} on YenDidii!` });
    };

    return (
        <View className="flex-1 bg-warm-cream">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Cover Hero & Action Bar */}
                <View className="h-72 w-full relative overflow-hidden">
                    <Image
                        source={{ uri: cook.kitchen_image_url || cook.avatar_url || 'https://media.screensdesign.com/gasset/175f3a6c-2804-4b82-9c4b-fd2a6a232277.png' }}
                        className="w-full h-full object-cover"
                    />
                    {/* Warm ambient gradient overlay */}
                    <LinearGradient
                        colors={['transparent', 'rgba(35,25,21,0.25)', 'rgba(35,25,21,0.8)']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    />

                    {/* Floating top nav */}
                    <View className="absolute top-12 left-0 right-0 px-5 flex-row items-center justify-between">
                        <TouchableOpacity
                            className="w-10 h-10 rounded-full bg-surface/85 items-center justify-center shadow-md active:scale-95"
                            onPress={() => router.back()}
                        >
                            <ArrowLeft size={20} color="#231915" />
                        </TouchableOpacity>
                        <View className="flex-row items-center gap-2">
                            <TouchableOpacity
                                className="w-10 h-10 rounded-full bg-surface/85 items-center justify-center shadow-md active:scale-95"
                                onPress={handleShare}
                            >
                                <Share2 size={18} color="#231915" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="w-10 h-10 rounded-full bg-surface/85 items-center justify-center shadow-md active:scale-95"
                                onPress={toggleFavorite}
                            >
                                <Heart size={18} color="#BF592B" fill={isFavorite ? '#BF592B' : 'transparent'} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Floating status pill */}
                    <View className="absolute bottom-10 left-5 flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-kente-yellow/90 shadow-sm">
                        <Leaf size={14} color="#231915" fill="#231915" />
                        <Text className="text-[11px] font-semibold text-text-main font-sans-semibold tracking-wide">Home Kitchen</Text>
                    </View>
                </View>

                <View className="px-5 -mt-7 pb-10 gap-4">
                    {/* Host Profile Header Card (overlapping) */}
                    <View className="bg-surface-lowest rounded-2xl p-5 shadow-lg gap-2">
                        <View className="flex-row items-start justify-between gap-3">
                            {/* Avatar with verified badge */}
                            <View>
                                <Image
                                    source={{ uri: cook.avatar_url || cook.kitchen_image_url || 'https://media.screensdesign.com/gasset/7b8349e8-337a-47c1-9718-f6066ab6fd1f.png' }}
                                    className="w-20 h-20 rounded-full shadow-md bg-surface-container"
                                />
                                {cook.verified && (
                                    <View className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-kente-yellow items-center justify-center shadow-md">
                                        <BadgeCheck size={16} color="#231915" />
                                    </View>
                                )}
                            </View>

                            {/* Verified pill & rating */}
                            <View className="items-end gap-1">
                                {cook.verified && (
                                    <View className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-fixed">
                                        <BadgeCheck size={12} color="#7E2C00" />
                                        <Text className="text-[11px] font-bold text-[#7E2C00] uppercase tracking-wider font-sans-bold">Verified Host</Text>
                                    </View>
                                )}
                                <View className="flex-row items-center gap-1 pt-1">
                                    <Star size={16} color="#BF592B" fill="#BF592B" />
                                    <Text className="text-sm font-bold text-text-main font-sans-bold">{cook.rating || 'New'}</Text>
                                    {(reviews?.length || 0) > 0 && (
                                        <Text className="text-sm text-outline font-sans">({reviews?.length} {reviews?.length === 1 ? 'review' : 'reviews'})</Text>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Identity */}
                        <View className="mt-1">
                            <Text className="text-[28px] leading-9 font-bold text-text-main font-sans-bold tracking-tight">
                                {kitchenName || cook.full_name || 'Cook'}
                            </Text>
                            {kitchenName && cook.full_name && (
                                <Text className="text-lg text-clay-primary font-medium font-sans-medium">by {cook.full_name}</Text>
                            )}
                        </View>

                        {/* Setting & meta chips */}
                        <View className="flex-row flex-wrap items-center gap-2 pt-2">
                            <View className="flex-row items-center gap-1 bg-surface-low px-2.5 py-1 rounded-full">
                                <MapPin size={16} color="#BF592B" />
                                <Text className="text-sm font-semibold text-text-sub font-sans-semibold">{cookLocation || 'Ghana'}</Text>
                            </View>
                            {specialties.map((spec: string, i: number) => (
                                <View key={i} className="bg-surface-low px-2.5 py-1 rounded-full">
                                    <Text className="text-sm font-semibold text-text-sub font-sans-semibold">{spec}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Hospitality bar */}
                    <View className="flex-row gap-2">
                        {capacity ? (
                            <View className="flex-1 bg-surface-low rounded-xl p-2.5 items-center gap-1 shadow-sm">
                                <Users size={20} color="#BF592B" fill="#BF592B" />
                                <Text className="text-[11px] font-semibold text-text-main font-sans-semibold text-center">Max {capacity} Seats</Text>
                                <Text className="text-[11px] text-outline font-sans text-center">Per Gathering</Text>
                            </View>
                        ) : null}
                        {frequencyLabel ? (
                            <View className="flex-1 bg-surface-low rounded-xl p-2.5 items-center gap-1 shadow-sm">
                                <Clock size={20} color="#006A3C" />
                                <Text className="text-[11px] font-semibold text-text-main font-sans-semibold text-center">{frequencyLabel}</Text>
                                <Text className="text-[11px] text-outline font-sans text-center">Hosting Rhythm</Text>
                            </View>
                        ) : null}
                        <View className="flex-1 bg-surface-low rounded-xl p-2.5 items-center gap-1 shadow-sm">
                            <ChefHat size={20} color="#84523C" />
                            <Text className="text-[11px] font-semibold text-text-main font-sans-semibold text-center">{cook.served_count || 0}+ Served</Text>
                            <Text className="text-[11px] text-outline font-sans text-center">{meals?.length || 0} {meals?.length === 1 ? 'Dish' : 'Dishes'}</Text>
                        </View>
                    </View>

                    {/* About the Kitchen */}
                    {cookBio && (
                        <View className="bg-surface-low rounded-2xl p-5 shadow-sm gap-4">
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center gap-2">
                                    <ChefHat size={20} color="#BF592B" />
                                    <Text className="text-lg font-bold text-text-main font-sans-bold">About the Kitchen</Text>
                                </View>
                                {!isNaN(joinedDate.getTime()) && (
                                    <View className="px-2 py-0.5 rounded-full bg-tertiary-fixed">
                                        <Text className="text-[11px] font-semibold text-tertiary font-sans-semibold">Joined {format(joinedDate, 'MMM yyyy')}</Text>
                                    </View>
                                )}
                            </View>
                            <View className="gap-2">
                                <Text className="text-base text-text-sub leading-relaxed font-sans" numberOfLines={bioExpanded ? undefined : 3}>
                                    {cookBio}
                                </Text>
                                {cookBio.length > 140 && (
                                    <TouchableOpacity className="flex-row items-center gap-1 self-start active:opacity-75" onPress={() => setBioExpanded(!bioExpanded)}>
                                        <Text className="text-sm font-bold text-clay-primary font-sans-bold">{bioExpanded ? 'Read less' : 'Read more'}</Text>
                                        {bioExpanded ? <ChevronUp size={14} color="#BF592B" /> : <ChevronDown size={14} color="#BF592B" />}
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Find the kitchen card */}
                            {cookLandmark && (
                                <View className="bg-surface-highest/60 rounded-xl p-3 flex-row items-center gap-3">
                                    <View className="w-9 h-9 rounded-full bg-tertiary/15 items-center justify-center">
                                        <Navigation size={18} color="#006A3C" fill="#006A3C" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[11px] text-tertiary uppercase font-bold tracking-wider font-sans-bold">Find the Kitchen</Text>
                                        <Text className="text-sm text-text-main font-semibold font-sans-semibold" numberOfLines={2}>Near: {cookLandmark}</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Upcoming Gatherings */}
                    {gatherings.length > 0 && (
                        <View className="gap-4 pt-2">
                            <View className="flex-row items-end justify-between">
                                <View>
                                    <Text className="text-[11px] text-clay-primary uppercase font-bold tracking-wider font-sans-bold">Join The Table</Text>
                                    <Text className="text-[22px] leading-7 font-bold text-text-main font-sans-bold">Upcoming Gatherings</Text>
                                </View>
                                <View className="bg-primary-fixed px-2.5 py-1 rounded-full">
                                    <Text className="text-[11px] font-bold text-[#7E2C00] font-sans-bold">{gatherings.length} Active</Text>
                                </View>
                            </View>

                            {gatherings.map((g: any, idx: number) => {
                                const start = new Date(g.order_deadline);
                                const hour = start.getHours();
                                const partOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
                                const remaining = g.portions_available || 0;
                                const booked = bookedByListing[g.id] || 0;
                                const total = remaining + booked;
                                const almostFull = remaining > 0 && remaining <= Math.max(2, Math.ceil(total * 0.25));
                                const soldOut = remaining === 0;
                                const accent = idx % 2 === 0 ? '#BF592B' : '#006A3C';
                                const accentText = idx % 2 === 0 ? 'text-clay-primary' : 'text-tertiary';

                                return (
                                    <View key={g.id} className="bg-surface-lowest rounded-2xl p-5 shadow-md gap-4 overflow-hidden">
                                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: accent }} />

                                        <View className="flex-row items-start justify-between gap-3 pt-1">
                                            <View className="flex-1 gap-0.5">
                                                <View className="flex-row items-center gap-2">
                                                    <View className="flex-row items-center gap-1">
                                                        {hour < 17 ? <Sun size={14} color={accent} /> : <Moon size={14} color={accent} />}
                                                        <Text className={`text-[11px] font-bold uppercase tracking-wider font-sans-bold ${accentText}`}>{partOfDay} Gathering</Text>
                                                    </View>
                                                    {almostFull && (
                                                        <View className="bg-error-container px-2 rounded-full">
                                                            <Text className="text-[11px] font-bold text-error-on-container font-sans-bold">Almost Full</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text className="text-lg font-bold text-text-main font-sans-bold">{g.title}</Text>
                                                <View className="flex-row items-center gap-1.5 pt-0.5">
                                                    <Calendar size={16} color="#8A7269" />
                                                    <Text className="text-sm text-text-sub font-sans">{format(start, "EEE, MMM d '@' h:mm a")}</Text>
                                                </View>
                                            </View>
                                            <View className="items-end">
                                                <Text className="text-[22px] leading-7 font-bold text-clay-primary font-sans-bold">GH₵ {g.price}</Text>
                                                <Text className="text-[11px] text-outline font-sans">per seat</Text>
                                            </View>
                                        </View>

                                        {/* Menu highlights */}
                                        {g.description ? (
                                            <View className="bg-surface-low rounded-xl p-3 gap-1.5">
                                                <Text className="text-[11px] text-tertiary uppercase font-bold tracking-wider font-sans-bold">Menu Highlights</Text>
                                                <Text className="text-sm text-text-main leading-snug font-sans" numberOfLines={4}>{g.description}</Text>
                                            </View>
                                        ) : null}

                                        {/* Seat tracker */}
                                        <View className="gap-1.5">
                                            <View className="flex-row items-center justify-between">
                                                <Text className="text-[11px] text-text-sub font-medium font-sans-medium">Availability</Text>
                                                {soldOut || almostFull ? (
                                                    <View className="flex-row items-center gap-1">
                                                        <Hourglass size={12} color="#BA1A1A" />
                                                        <Text className="text-[11px] text-error font-bold font-sans-bold">
                                                            {soldOut ? 'Fully booked' : `Only ${remaining} of ${total} remaining`}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <Text className="text-[11px] text-clay-primary font-bold font-sans-bold">{remaining} of {total} remaining</Text>
                                                )}
                                            </View>
                                            <View className="w-full h-2 rounded-full bg-surface-high overflow-hidden">
                                                <View
                                                    style={{ width: `${total > 0 ? (booked / total) * 100 : 0}%`, backgroundColor: soldOut || almostFull ? '#BA1A1A' : '#BF592B' }}
                                                    className="h-full rounded-full"
                                                />
                                            </View>
                                        </View>

                                        {/* Reserve CTA */}
                                        <TouchableOpacity
                                            disabled={soldOut}
                                            onPress={() => router.push(`/listing/${g.id}`)}
                                            className={`w-full py-3 px-6 rounded-full flex-row items-center justify-center gap-2 shadow-md active:scale-[0.98] ${soldOut ? 'bg-outline-variant' : 'bg-clay-primary'}`}
                                        >
                                            <Utensils size={16} color="white" />
                                            <Text className="text-white text-sm font-bold font-sans-bold">{soldOut ? 'Fully Booked' : 'Reserve a Seat'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Explore Menu */}
                    <View className="gap-4 pt-2">
                        <View>
                            <Text className="text-[11px] text-clay-primary uppercase font-bold tracking-wider font-sans-bold">On The Menu</Text>
                            <Text className="text-[22px] leading-7 font-bold text-text-main font-sans-bold">Explore Menu</Text>
                        </View>

                        {menuMeals.length > 0 ? (
                            <View className="flex-row flex-wrap justify-between">
                                {menuMeals.map((meal: any) => {
                                    const isReady = meal.available;
                                    const readyTime = meal.prep_time_minutes ? `${meal.prep_time_minutes}m` : 'Later';

                                    return (
                                        <View key={meal.id} className="w-[48%] mb-4">
                                            <TouchableOpacity
                                                activeOpacity={0.9}
                                                onPress={() => router.push(`/listing/${meal.id}`)}
                                                className="bg-surface-lowest rounded-2xl overflow-hidden shadow-md"
                                            >
                                                <View className={`relative aspect-[4/3] bg-gray-100 ${!isReady ? 'opacity-80' : ''}`}>
                                                    <Image
                                                        source={{ uri: (meal.image && meal.image.includes(',') ? meal.image.split(',')[0].trim() : meal.image) || 'https://via.placeholder.com/300' }}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {!isReady && (
                                                        <View className="absolute inset-0 bg-black/40 items-center justify-center shadow-sm">
                                                            <Text className="text-white text-sm font-bold font-sans-bold px-2 text-center drop-shadow-md">Paused</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View className="p-3">
                                                    <Text className="font-bold text-text-main font-sans-bold text-base leading-tight mb-1" numberOfLines={2}>{meal.title}</Text>
                                                    <Text className="text-base font-bold text-clay-primary font-sans-bold">₵{meal.price}</Text>
                                                    {!isReady && (
                                                        <Text className="text-clay-primary text-[11px] font-bold font-sans-bold mt-1">
                                                            🕒 Ready {readyTime}
                                                        </Text>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View className="w-full items-center justify-center py-10 bg-surface-low rounded-2xl">
                                <Text className="text-text-main font-bold mb-2 font-sans-bold text-lg">
                                    {gatherings.length > 0 ? 'No other dishes yet' : 'No meals available'}
                                </Text>
                                <Text className="text-text-sub text-base font-sans text-center px-6">
                                    {gatherings.length > 0 ? 'Join an upcoming gathering above.' : "This cook hasn't added any meals to their menu yet."}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Guest Reviews */}
                    <View className="gap-4 pt-2">
                        <View className="flex-row items-center justify-between">
                            <View>
                                <Text className="text-[11px] text-tertiary uppercase font-bold tracking-wider font-sans-bold">Stories From The Hearth</Text>
                                <Text className="text-[22px] leading-7 font-bold text-text-main font-sans-bold">What Guests Are Saying</Text>
                            </View>
                            {cook.rating ? (
                                <View className="flex-row items-center gap-1">
                                    <Star size={16} color="#BF592B" fill="#BF592B" />
                                    <Text className="text-sm font-bold text-clay-primary font-sans-bold">{cook.rating}</Text>
                                </View>
                            ) : null}
                        </View>

                        {isReviewsLoading ? (
                            <View className="py-10 items-center justify-center">
                                <ActivityIndicator size="small" color="#D65A31" />
                            </View>
                        ) : visibleReviews && visibleReviews.length > 0 ? (
                            <>
                                {visibleReviews.map((review: any, idx: number) => (
                                    <View key={review.id} className="bg-surface-low rounded-2xl p-4 shadow-sm gap-2">
                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-row items-center gap-3 flex-1">
                                                {review.profiles?.avatar_url ? (
                                                    <Image source={{ uri: review.profiles.avatar_url }} className="w-9 h-9 rounded-full bg-gray-100" />
                                                ) : (
                                                    <View className={`w-9 h-9 rounded-full items-center justify-center ${idx % 2 === 0 ? 'bg-primary-container' : 'bg-tertiary'}`}>
                                                        <Text className="text-white font-bold font-sans-bold text-sm">
                                                            {(review.profiles?.full_name || 'E')[0].toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                                <View className="flex-1">
                                                    <Text className="text-sm font-bold text-text-main font-sans-bold">{review.profiles?.full_name || 'Eater'}</Text>
                                                    <Text className="text-[11px] text-outline font-sans">
                                                        Verified Guest · {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View className="flex-row items-center">
                                                {[1, 2, 3, 4, 5].map((n) => (
                                                    <Star key={n} size={14} color="#BF592B" fill={n <= review.rating ? '#BF592B' : 'transparent'} />
                                                ))}
                                            </View>
                                        </View>
                                        {review.comment && (
                                            <Text className="text-sm text-text-sub font-sans italic leading-relaxed pt-1">“{review.comment}”</Text>
                                        )}
                                    </View>
                                ))}
                                {(reviews?.length || 0) > 2 && (
                                    <TouchableOpacity
                                        className="w-full py-2.5 rounded-xl bg-surface-high/60 flex-row items-center justify-center gap-1 active:bg-surface-high"
                                        onPress={() => setShowAllReviews(!showAllReviews)}
                                    >
                                        <Text className="text-sm font-bold text-clay-primary font-sans-bold">
                                            {showAllReviews ? 'Show fewer stories' : `View all ${reviews?.length} guest stories`}
                                        </Text>
                                        {showAllReviews ? <ChevronUp size={16} color="#BF592B" /> : <ArrowRight size={16} color="#BF592B" />}
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <View className="py-6 items-center justify-center bg-surface-low rounded-2xl">
                                <Text className="font-bold text-text-main text-lg font-sans-bold mb-2">No reviews yet</Text>
                                <Text className="text-text-sub text-center font-sans">Be the first to order and leave a review.</Text>
                            </View>
                        )}
                    </View>

                    {/* Kitchen Photos */}
                    {photos.length > 1 && (
                        <View className="gap-4 pt-2">
                            <View>
                                <Text className="text-[11px] text-clay-primary uppercase font-bold tracking-wider font-sans-bold">Inside The Kitchen</Text>
                                <Text className="text-[22px] leading-7 font-bold text-text-main font-sans-bold">Kitchen Photos</Text>
                            </View>
                            <View className="flex-row flex-wrap gap-2">
                                {photos.map((uri, i) => (
                                    <Image key={i} source={{ uri }} style={{ width: '32%', aspectRatio: 1, borderRadius: 12 }} className="bg-gray-100" />
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
