import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Clock, Users, Star, ShieldCheck, MapPin, Share2, Heart, Plus, Minus, Info, Flame, ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';

const { width } = Dimensions.get('window');

export default function SessionDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [quantity, setQuantity] = useState(1);

    const { data: session, isLoading } = useQuery({
        queryKey: ['session-detail', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('meal_sessions')
                .select(`
                    *,
                    profiles:cook_id (*),
                    listings:listing_id (*)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!id
    });

    if (isLoading || !session) {
        return (
            <View className="flex-1 justify-center items-center bg-warm-cream">
                <ActivityIndicator color="#D65A31" />
            </View>
        );
    }

    const dishName = session.listings?.title || session.title || 'Local Dish';
    const sessionTitle = session.title || session.listings?.title;
    const sessionImage = session.listings?.image || 'https://i.imgur.com/yF9WbdD.png';

    const deadlineStr = formatDistanceToNow(new Date(session.request_deadline), { addSuffix: true });
    const slotsLeft = session.total_slots - session.filled_slots;
    const progress = (session.filled_slots / session.total_slots) * 100;

    const handleReserve = () => {
        Alert.alert(
            "Confirm Reservation",
            `Reserve ${quantity} plate(s) of ${dishName} for ₵${(session.price_per_plate * quantity).toFixed(2)}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Join the Pot",
                    onPress: () => {
                        Alert.alert("Success!", "You have joined the pot. Looking forward to a great meal!");
                        router.back();
                    },
                    style: "default"
                }
            ]
        );
    };

    return (
        <View className="flex-1 bg-warm-cream">
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Hero Image */}
                <View className="relative h-[300px] w-full bg-gray-200">
                    <Image
                        source={{ uri: sessionImage }}
                        className="w-full h-full object-cover"
                    />
                    <LinearGradient
                        colors={['rgba(0,0,0,0.4)', 'transparent']}
                        className="absolute inset-0 h-24"
                    />

                    <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0 px-6 flex-row justify-between items-center">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 rounded-full bg-white/90 items-center justify-center shadow-sm"
                        >
                            <ArrowLeft size={20} color="#1A1A1A" />
                        </TouchableOpacity>
                        <View className="flex-row gap-3">
                            <TouchableOpacity className="w-10 h-10 rounded-full bg-white/90 items-center justify-center shadow-sm">
                                <Share2 size={20} color="#1A1A1A" />
                            </TouchableOpacity>
                            <TouchableOpacity className="w-10 h-10 rounded-full bg-white/90 items-center justify-center shadow-sm">
                                <Heart size={20} color="#1A1A1A" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>

                    <View className="absolute bottom-6 left-6">
                        <View className="bg-clay-primary px-4 py-1.5 rounded-full shadow-sm flex-row items-center gap-2">
                            <Flame size={14} color="white" fill="white" />
                            <Text className="text-white font-bold text-xs uppercase tracking-wider font-sans-bold">Active Meal Drop</Text>
                        </View>
                    </View>
                </View>

                {/* Content */}
                <View className="px-6 -mt-4 bg-warm-cream rounded-t-[40px] pt-8 pb-32">
                    <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1 mr-4">
                            <Text className="text-2xl font-bold text-text-main font-sans-bold leading-tight mb-1">{sessionTitle}</Text>
                            <Text className="text-text-sub text-base font-sans">{dishName}</Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-2xl font-bold text-clay-primary font-sans-bold">₵{session.price_per_plate}</Text>
                            <Text className="text-[10px] text-text-sub font-sans uppercase font-bold">per plate</Text>
                        </View>
                    </View>

                    {/* Deadline Alert */}
                    <View className="flex-row items-center gap-2 bg-orange-50 p-3 rounded-2xl border border-orange-100 mt-4 mb-6">
                        <Clock size={16} color="#D65A31" />
                        <Text className="text-xs text-amber-800 font-sans font-medium">
                            Requests close <Text className="font-bold">{deadlineStr}</Text>
                        </Text>
                    </View>

                    {/* Progress Card */}
                    <View className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-8">
                        <View className="flex-row justify-between items-center mb-3">
                            <View className="flex-row items-center gap-2">
                                <Users size={16} color="#6B7280" />
                                <Text className="text-sm font-bold text-text-main font-sans-bold">Current Status</Text>
                            </View>
                            <Text className="text-sm font-bold text-clay-primary font-sans-bold">
                                {session.filled_slots}/{session.total_slots} filled
                            </Text>
                        </View>

                        <View className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                            <View
                                className="h-full bg-clay-primary rounded-full shadow-sm shadow-clay-primary/30"
                                style={{ width: `${progress}%` }}
                            />
                        </View>

                        <Text className="text-xs text-text-sub text-center font-sans">
                            {slotsLeft} more spots to hit the minimum pot target
                        </Text>
                    </View>

                    {/* Session Info */}
                    <View className="flex-row gap-4 mb-8">
                        <View className="flex-1 bg-white p-4 rounded-3xl border border-gray-100 shadow-xs">
                            <Clock size={20} color="#D65A31" className="mb-2" />
                            <Text className="text-[10px] text-text-sub font-sans uppercase font-bold">Ready By</Text>
                            <Text className="text-sm font-bold text-text-main font-sans-bold mt-1">
                                {format(new Date(session.session_date), 'EEE, MMM d')}
                            </Text>
                            <Text className="text-xs text-text-sub font-sans">{session.start_time.slice(0, 5)} PM</Text>
                        </View>
                        <View className="flex-1 bg-white p-4 rounded-3xl border border-gray-100 shadow-xs">
                            <MapPin size={20} color="#D65A31" className="mb-2" />
                            <Text className="text-[10px] text-text-sub font-sans uppercase font-bold">Location</Text>
                            <Text className="text-sm font-bold text-text-main font-sans-bold mt-1" numberOfLines={1}>
                                {session.profiles?.location?.split(',')[0] || 'Nearby'}
                            </Text>
                            <Text className="text-xs text-text-sub font-sans">Pick up available</Text>
                        </View>
                    </View>

                    {/* Cook Info */}
                    <Text className="font-bold text-text-main text-lg font-sans-bold mb-4">The Host</Text>
                    <TouchableOpacity className="flex-row items-center bg-white p-4 rounded-3xl border border-gray-100 shadow-xs mb-8">
                        <Image
                            source={{ uri: session.profiles?.avatar_url || 'https://via.placeholder.com/60' }}
                            className="w-12 h-12 rounded-full border-2 border-orange-50"
                        />
                        <View className="flex-1 ml-4">
                            <View className="flex-row items-center gap-1.5">
                                <Text className="font-bold text-text-main text-base font-sans-bold">{session.profiles?.full_name}</Text>
                                <ShieldCheck size={14} color="#059669" />
                            </View>
                            <View className="flex-row items-center gap-1 mt-0.5">
                                <Star size={12} color="#D97706" fill="#D97706" />
                                <Text className="text-xs font-bold text-amber-700 font-sans-bold">{session.profiles?.rating}</Text>
                                <Text className="text-gray-300">•</Text>
                                <Text className="text-xs text-text-sub font-sans">{session.profiles?.served_count || '50+'} served</Text>
                            </View>
                        </View>
                        <ChevronRight size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    {/* About Session */}
                    <Text className="font-bold text-text-main text-lg font-sans-bold mb-3">About this Pot</Text>
                    <Text className="text-text-sub text-base leading-relaxed font-sans mb-8">
                        {session.description || `${session.profiles?.full_name} is hosting this community meal for ${dishName}. Join to enjoy an authentic, home-cooked experience.`}
                    </Text>
                </View>
            </ScrollView>

            {/* Bottom Sticky Action */}
            <View className="absolute bottom-0 left-0 right-0 bg-white p-6 pb-10 border-t border-gray-100 shadow-2xl flex-row items-center justify-between">
                <View className="flex-row items-center bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-100">
                    <TouchableOpacity
                        onPress={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                    >
                        <Minus size={18} color={quantity <= 1 ? "#D1D5DB" : "#D65A31"} />
                    </TouchableOpacity>
                    <Text className="mx-5 font-bold text-lg text-text-main font-sans-bold">{quantity}</Text>
                    <TouchableOpacity
                        onPress={() => setQuantity(Math.min(slotsLeft, quantity + 1))}
                        disabled={quantity >= slotsLeft}
                    >
                        <Plus size={18} color={quantity >= slotsLeft ? "#D1D5DB" : "#D65A31"} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    onPress={handleReserve}
                    className="flex-1 ml-6 bg-clay-primary h-14 rounded-2xl items-center justify-center shadow-lg shadow-clay-primary/40 flex-row gap-2"
                >
                    <Text className="text-white font-bold text-lg font-sans-bold">Join the Pot</Text>
                    <ChevronRight size={18} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );
}
