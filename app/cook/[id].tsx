import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MoreHorizontal, BadgeCheck, MapPin, Star, Plus, ChefHat, Clock, Users, Navigation } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';


export default function CookProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('Menu');

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
                <Text className="text-lg text-text-sub font-sans text-center">Cook not found.</Text>
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

    return (
        <View className="flex-1 bg-warm-cream">
            {/* Header Nav (Absolute) */}
            <View className="absolute top-0 left-0 right-0 z-20 flex-row justify-between items-center p-6 pt-12">
                <TouchableOpacity
                    className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full items-center justify-center active:bg-black/40"
                    onPress={() => router.back()}
                >
                    <ArrowLeft size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                    className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full items-center justify-center active:bg-black/40"
                >
                    <MoreHorizontal size={20} color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Cover Photo — Kitchen Image */}
                <View className="h-[240px] w-full relative">
                    <Image
                        source={{ uri: cook.kitchen_image_url || cook.avatar_url || 'https://media.screensdesign.com/gasset/175f3a6c-2804-4b82-9c4b-fd2a6a232277.png' }}
                        className="w-full h-full object-cover"
                    />
                    <View className="absolute inset-0 bg-black/20" />
                </View>

                {/* Profile Info Container */}
                <View className="bg-warm-cream -mt-6 rounded-t-[32px] relative z-10 px-6 pt-16 pb-6">
                    {/* Avatar Overlap */}
                    <View className="absolute -top-12 left-6 p-1 bg-warm-cream rounded-full">
                        <Image
                            source={{ uri: cook.kitchen_image_url || cook.avatar_url || 'https://media.screensdesign.com/gasset/7b8349e8-337a-47c1-9718-f6066ab6fd1f.png' }}
                            className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-gray-100"
                        />
                    </View>

                    {/* Verified Badge */}
                    <View className="absolute top-4 right-6 items-end">
                        {cook.verified && (
                            <View className="flex-row items-center gap-1.5 px-3 py-1.5 bg-green-100 rounded-full border border-green-200 mb-1">
                                <BadgeCheck size={12} color="#007A33" />
                                <Text className="text-xs font-bold text-kente-green font-sans-bold">Verified Cook</Text>
                            </View>
                        )}
                        <Text className="text-xs text-text-sub font-sans">Joined {new Date(cook.created_at || cook.updated_at).toLocaleDateString()}</Text>
                    </View>

                    {/* Name Block */}
                    <View className="mb-4">
                        <Text className="text-2xl font-bold text-text-main mb-0.5 font-sans-bold">
                            {kitchenName || cook.full_name || 'Cook'}
                        </Text>
                        {kitchenName && cook.full_name && (
                            <Text className="text-sm text-text-sub font-sans mb-1">by {cook.full_name}</Text>
                        )}
                        <View className="flex-row items-center gap-1">
                            <MapPin size={12} color="#6D6D6D" />
                            <Text className="text-text-sub text-sm font-sans">{cookLocation || 'Ghana'}</Text>
                        </View>
                        {cookLandmark && (
                            <View className="flex-row items-start gap-1 mt-1 pr-4">
                                <Navigation size={12} color="#D65A31" style={{ marginTop: 2 }} />
                                <Text className="text-text-sub text-sm font-sans italic flex-1">Near: {cookLandmark}</Text>
                            </View>
                        )}
                    </View>

                    {/* Specialties Tags */}
                    {specialties.length > 0 && (
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {specialties.map((spec: string, i: number) => (
                                <View key={i} className="bg-clay-primary/10 px-3 py-1.5 rounded-full border border-clay-primary/20">
                                    <Text className="text-xs font-bold text-clay-primary font-sans-bold">{spec}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Stats Row */}
                    <View className="flex-row justify-between bg-white p-4 rounded-2xl shadow-sm mb-6 border border-gray-100">
                        <View className="flex-1 items-center border-r border-gray-100">
                            <Text className="text-lg font-bold text-text-main font-sans-bold">{cook.rating || 'New'}</Text>
                            <Text className="text-[10px] text-text-sub uppercase tracking-wide font-sans">Rating</Text>
                        </View>
                        <View className="flex-1 items-center border-r border-gray-100">
                            <Text className="text-lg font-bold text-text-main font-sans-bold">{cook.served_count || 0}+</Text>
                            <Text className="text-[10px] text-text-sub uppercase tracking-wide font-sans">Served</Text>
                        </View>
                        <View className="flex-1 items-center">
                            <Text className="text-lg font-bold text-text-main font-sans-bold">{meals?.length || 0}</Text>
                            <Text className="text-[10px] text-text-sub uppercase tracking-wide font-sans">Dishes</Text>
                        </View>
                    </View>

                    {/* Bio */}
                    {cookBio && (
                        <View className="mb-8">
                            <Text className="text-sm font-bold text-text-main mb-2 font-sans-bold">About the Kitchen</Text>
                            <Text className="text-sm text-text-sub leading-relaxed font-sans">
                                {cookBio}
                            </Text>
                        </View>
                    )}

                    {/* Tabs */}
                    <View className="flex-row border-b border-gray-200 mb-6 mt-4">
                        {['Menu', 'Reviews', 'Photos'].map(tab => (
                            <TouchableOpacity
                                key={tab}
                                className={`flex-1 pb-3 ${activeTab === tab ? 'border-b-2 border-clay-primary' : ''}`}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Text className={`text-center text-sm ${activeTab === tab ? 'font-bold text-clay-primary' : 'font-medium text-text-sub'} font-sans`}>
                                    {tab}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Explore Menu Header */}
                    <Text className="text-2xl font-bold font-sans-bold text-text-main mb-4">Explore Menu</Text>

                    {/* Content Area Based on Active Tab */}
                    {activeTab === 'Menu' && (
                        <View className="flex-row flex-wrap justify-between">
                            {meals && meals.length > 0 ? (
                                meals.map((meal: any) => {
                                    const isReady = meal.available;
                                    const readyTime = meal.prep_time_minutes ? `${meal.prep_time_minutes}m` : 'Later';

                                    return (
                                        <View key={meal.id} className="w-[48%] mb-6">
                                            <TouchableOpacity
                                                activeOpacity={0.9}
                                                onPress={() => router.push(`/listing/${meal.id}`)}
                                                className={`rounded-2xl overflow-hidden mb-2 relative aspect-[4/3] bg-gray-100 shadow-sm ${!isReady ? 'opacity-80' : ''}`}
                                            >
                                                <Image
                                                    source={{ uri: (meal.image && meal.image.includes(',') ? meal.image.split(',')[0].trim() : meal.image) || 'https://via.placeholder.com/300' }}
                                                    className="w-full h-full object-cover"
                                                />

                                                {!isReady && (
                                                    <View className="absolute inset-0 bg-black/40 items-center justify-center shadow-sm">
                                                        <Text className="text-white text-sm font-bold font-sans-bold px-2 text-center drop-shadow-md">Paused</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>

                                            <View className="px-1 mt-1">
                                                <Text className="font-bold text-text-main font-sans-bold text-base leading-tight mb-1" numberOfLines={2}>{meal.title}</Text>
                                                <Text className="text-base font-medium text-text-sub font-sans">₵{meal.price}</Text>

                                                {!isReady && (
                                                    <Text className="text-clay-primary text-[11px] font-bold font-sans-bold mt-1">
                                                        🕒 Ready {readyTime}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <View className="w-full items-center justify-center py-10 mt-4 bg-gray-50 rounded-3xl border border-gray-100">
                                    <Text className="text-text-main font-bold mb-2 font-sans-bold text-lg">No meals available</Text>
                                    <Text className="text-text-sub text-base font-sans text-center px-6">
                                        This cook hasn't added any meals to their menu yet.
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {activeTab === 'Reviews' && (
                        <View className="py-6 items-center justify-center bg-gray-50 rounded-3xl border border-gray-100">
                            <Text className="font-bold text-text-main text-lg font-sans-bold mb-2">Reviews</Text>
                            <Text className="text-text-sub text-center font-sans">User reviews will appear here.</Text>
                        </View>
                    )}

                    {activeTab === 'Photos' && (
                        <View className="py-6 items-center justify-center bg-gray-50 rounded-3xl border border-gray-100">
                            <Text className="font-bold text-text-main text-lg font-sans-bold mb-2">Photos</Text>
                            <Text className="text-text-sub text-center font-sans">Gallery coming soon.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
