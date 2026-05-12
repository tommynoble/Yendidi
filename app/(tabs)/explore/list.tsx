import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Dimensions, Switch, ActivityIndicator, Alert, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, MessageCircle, ChefHat, Flame, Sparkles, Clock, ArrowRight, Trash2, Plus, Map, List } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '@/lib/store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

// Data constants
const { width } = Dimensions.get('window');

const FOOD_STORIES = [
    { id: '1', name: 'Aunty Ama', image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&q=80', hasNew: true },
    { id: '2', name: 'Chef Kofi', image: 'https://images.unsplash.com/photo-1607631568010-a87245c0daf8?w=100&q=80', hasNew: true },
    { id: '3', name: 'Mama Efua', image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=100&q=80', hasNew: false },
    { id: '4', name: 'Nana Yaa', image: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=100&q=80', hasNew: true },
];

const FOOD_REELS = [
    { id: '1', title: 'How to make the perfect Jollof', chef: 'Aunty Ama', chefImage: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=60&q=80', image: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=600&q=80', likes: '2.4k', comments: '89', duration: '2:30' },
    { id: '2', title: 'Secret to fluffy Banku', chef: 'Chef Kofi', chefImage: 'https://images.unsplash.com/photo-1607631568010-a87245c0daf8?w=60&q=80', image: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=600&q=80', likes: '1.8k', comments: '56', duration: '1:45' },
];

const DID_YOU_KNOW = [
    { id: '1', fact: 'Jollof rice originated from the Wolof people of Senegal, but Ghana has perfected it! 🇬🇭', emoji: '🍚' },
    { id: '2', fact: 'Waakye gets its unique color from dried millet leaves (waakye leaves) or sorghum leaves.', emoji: '🌿' },
    { id: '3', fact: 'Fufu is traditionally pounded by two people - one turning, one pounding. It\'s a dance!', emoji: '🥁' },
];

const TRENDING_NOW = [
    { id: '1', name: 'Waakye', searches: '1.2k searches today', image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200&q=80' },
    { id: '2', name: 'Kelewele', searches: '890 searches today', image: 'https://images.unsplash.com/photo-1596797882870-8c33deeac224?w=200&q=80' },
    { id: '3', name: 'Kontomire Stew', searches: '756 searches today', image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=200&q=80' },
];

const WHATS_NEW = [
    { id: '1', title: 'New Cook Alert! 🎉', description: 'Mama Adwoa from Kumasi just joined with her famous Emo Tuo & Groundnut Soup', time: '2 hours ago', type: 'new_cook' },
    { id: '2', title: 'Special Offer 🥗', description: 'Get 10% off Kelewele for the next 2 hours!', time: '3 hours ago', type: 'promo' },
];

export default function ExploreListScreen() {
    const router = useRouter();
    const { isCookMode } = useAppStore();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();

    const { data: userSession } = useQuery({
        queryKey: ['session'],
        queryFn: async () => {
            const { data } = await supabase.auth.getUser();
            return data.user;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: myMenu = [], isLoading: menuLoading } = useQuery({
        queryKey: ['my-menu', userSession?.id],
        queryFn: async () => {
            if (!userSession?.id) return [];
            const { data, error } = await supabase
                .from('listings')
                .select('*')
                .eq('cook_id', userSession.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!userSession?.id,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch real approved cooks for the Stories row
    const { data: realCooks = [] } = useQuery({
        queryKey: ['approved-cooks-stories'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .eq('role', 'COOK')
                .eq('cook_application_status', 'approved')
                .limit(10);
            if (error) return [];
            return (data || []).map((c: any) => ({
                id: c.id,
                name: c.full_name?.split(' ')[0] || 'Chef',
                avatar_url: c.avatar_url,
            }));
        },
        staleTime: 5 * 60 * 1000,
    });


    const toggleProductAvailability = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase.from('listings').update({ available: !currentStatus }).eq('id', id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['my-menu', userSession?.id] });
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }
    };

    const deleteProduct = async (id: string) => {
        Alert.alert('Delete Dish', 'Are you sure you want to remove this dish?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        const { error } = await supabase.from('listings').delete().eq('id', id);
                        if (error) throw error;
                        queryClient.invalidateQueries({ queryKey: ['my-menu', userSession?.id] });
                    } catch (err: any) {
                        Alert.alert('Error', err.message);
                    }
                }
            }
        ]);
    };

    // COOK MODE — My Menu
    if (isCookMode) {
        return (
            <View className="flex-1 bg-warm-cream" style={{ paddingTop: insets.top }}>
                {/* Header */}
                <View className="px-6 pt-3 pb-4 bg-white border-b border-gray-100 flex-row justify-between items-center">
                    <View>
                        <Text className="text-2xl font-bold text-text-main font-sans-bold">My Menu</Text>
                        <Text className="text-sm text-text-sub font-sans">
                            {menuLoading ? 'Loading...' : `${myMenu.length} dish${myMenu.length !== 1 ? 'es' : ''} posted`}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/cook')}
                        className="bg-clay-primary w-11 h-11 rounded-full items-center justify-center shadow-sm"
                        style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                    >
                        <Plus size={24} color="white" strokeWidth={2.5} />
                    </TouchableOpacity>
                </View>

                {/* Body */}
                {menuLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color="#D65A31" />
                        <Text className="text-text-sub mt-3 font-sans">Loading your menu...</Text>
                    </View>
                ) : myMenu.length === 0 ? (
                    /* Empty State */
                    <View className="flex-1 items-center justify-center px-8">
                        <View className="w-24 h-24 bg-clay-primary/10 rounded-full items-center justify-center mb-5">
                            <ChefHat size={48} color="#D65A31" />
                        </View>
                        <Text className="text-2xl font-bold text-text-main font-sans-bold text-center mb-2">Your menu is empty</Text>
                        <Text className="text-text-sub font-sans text-center leading-relaxed mb-8">
                            You haven't posted any dishes yet. Tap the button below to add your first listing!
                        </Text>
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/cook')}
                            className="bg-clay-primary px-8 py-4 rounded-2xl flex-row items-center gap-3"
                            style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
                        >
                            <Plus size={20} color="white" />
                            <Text className="text-white font-bold text-base font-sans-bold">Post Your First Dish</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView
                        className="flex-1"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
                    >
                        {myMenu.map((dish: any) => (
                            <View
                                key={dish.id}
                                className="bg-white rounded-3xl mb-5 overflow-hidden"
                                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }}
                            >
                                {/* Cover Image */}
                                <View className="relative">
                                    {dish.image ? (
                                        <Image
                                            source={{ uri: dish.image }}
                                            style={{ width: '100%', height: 160 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={{ width: '100%', height: 160, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                                            <ChefHat size={48} color="#D4D4D4" />
                                            <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 8 }}>No photo</Text>
                                        </View>
                                    )}
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.55)']}
                                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 }}
                                    />
                                    {/* Category Badge */}
                                    <View className="absolute top-3 left-3 bg-black/40 px-3 py-1 rounded-full">
                                        <Text className="text-white text-[10px] font-bold uppercase tracking-wider">
                                            {dish.category || 'Custom'}
                                        </Text>
                                    </View>
                                    {/* Availability Badge */}
                                    <View className={`absolute top-3 right-3 px-3 py-1 rounded-full ${dish.available ? 'bg-green-500' : 'bg-gray-400'}`}>
                                        <Text className="text-white text-[10px] font-bold">
                                            {dish.available ? '● Live' : '● Paused'}
                                        </Text>
                                    </View>
                                    {/* Price */}
                                    <Text className="absolute bottom-3 left-4 text-white text-xl font-bold" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
                                        ₵{dish.price}
                                    </Text>
                                </View>

                                {/* Card Body */}
                                <View className="p-4">
                                    <View className="flex-row justify-between items-start mb-1">
                                        <Text className="text-lg font-bold text-text-main font-sans-bold flex-1 pr-2" numberOfLines={2}>
                                            {dish.title || dish.name}
                                        </Text>
                                        <Switch
                                            value={dish.available}
                                            onValueChange={() => toggleProductAvailability(dish.id, dish.available)}
                                            trackColor={{ false: '#D1D5DB', true: '#D65A31' }}
                                            thumbColor="#FFFFFF"
                                            ios_backgroundColor="#D1D5DB"
                                        />
                                    </View>
                                    {dish.description ? (
                                        <Text className="text-text-sub text-sm font-sans leading-relaxed mt-1 mb-3" numberOfLines={2}>
                                            {dish.description}
                                        </Text>
                                    ) : null}

                                    <View className="flex-row items-center gap-4 mb-4">
                                        <View className="flex-row items-center gap-1.5">
                                            <View className="w-1.5 h-1.5 rounded-full bg-clay-primary" />
                                            <Text className="text-xs text-text-sub font-sans">{dish.portions_available || 0} portions left</Text>
                                        </View>
                                        <View className="flex-row items-center gap-1.5">
                                            <View className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                            <Text className="text-xs text-text-sub font-sans">{dish.prep_time_minutes || 30} min cook time</Text>
                                        </View>
                                    </View>

                                    {/* Actions */}
                                    <View className="flex-row gap-3 pt-3 border-t border-gray-50">
                                        <TouchableOpacity
                                            className="flex-1 flex-row items-center justify-center gap-2 py-2.5 bg-gray-50 rounded-xl border border-gray-100"
                                            onPress={() => router.push('/(tabs)/cook')}
                                        >
                                            <Plus size={15} color="#6B7280" />
                                            <Text className="text-sm font-semibold text-gray-600 font-sans">Post Again</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            className="flex-row items-center justify-center gap-2 py-2.5 px-4 bg-red-50 rounded-xl"
                                            onPress={() => deleteProduct(dish.id)}
                                        >
                                            <Trash2 size={15} color="#DC2626" />
                                            <Text className="text-sm font-semibold text-red-600 font-sans">Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        );
    }

    // EATER MODE
    return (
        <View className="flex-1 bg-warm-cream" style={{ paddingTop: insets.top }}>

            {/* HEADER OVERLAY (always on top) */}
            <View
                className="px-6 pt-3 pb-4 flex-row justify-between items-center bg-white border-b border-gray-100"
                style={{
                    zIndex: 50,
                    elevation: 10,
                }}
            >
                <View>
                    <Text className="text-xl font-bold text-text-main font-sans-bold">Discover</Text>
                    <Text className="text-sm text-text-sub font-sans">Explore Ghanaian food culture</Text>
                </View>
                <View className="flex-row bg-gray-100 p-1 rounded-full">
                    <TouchableOpacity
                        className="p-2 rounded-full"
                        onPress={() => router.push('/(tabs)/explore/map')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Map size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="p-2 rounded-full"
                        style={{ backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
                        activeOpacity={1}
                    >
                        <List size={20} color="#D65A31" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Stories Row — Real Cooks */}
                <View className="bg-white pb-4 pt-4">
                    {realCooks.length > 0 ? (
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={realCooks}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item: cook }) => (
                                <TouchableOpacity
                                    className="items-center"
                                    activeOpacity={0.7}
                                    onPress={() => router.push(`/(tabs)/explore/map`)}
                                >
                                    <View style={{ width: 68, height: 68, borderRadius: 34, padding: 2, backgroundColor: '#D65A31' }}>
                                        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'white', overflow: 'hidden', backgroundColor: '#F3F4F6' }}>
                                            {cook.avatar_url ? (
                                                <Image source={{ uri: cook.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                            ) : (
                                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0EB' }}>
                                                    <ChefHat size={28} color="#D65A31" />
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <Text className="text-xs text-text-main mt-2 font-sans-medium" numberOfLines={1} style={{ maxWidth: 64 }}>{cook.name}</Text>
                                </TouchableOpacity>
                            )}
                            initialNumToRender={5}
                            maxToRenderPerBatch={5}
                            windowSize={3}
                        />
                    ) : (
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={FOOD_STORIES}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item: story }) => (
                                <TouchableOpacity className="items-center" activeOpacity={0.7}>
                                    <View style={{ width: 68, height: 68, borderRadius: 34, padding: 2, backgroundColor: story.hasNew ? '#D65A31' : '#E5E7EB' }}>
                                        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'white', overflow: 'hidden' }}>
                                            <Image source={{ uri: story.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                        </View>
                                    </View>
                                    <Text className="text-xs text-text-main mt-2 font-sans-medium">{story.name}</Text>
                                </TouchableOpacity>
                            )}
                            initialNumToRender={4}
                            maxToRenderPerBatch={4}
                            windowSize={3}
                        />
                    )}
                </View>

                {/* Food Reels / Videos */}
                <View className="mt-4 px-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-2">
                            <Play size={20} color="#D65A31" fill="#D65A31" />
                            <Text className="text-lg font-bold text-text-main font-sans-bold">Kitchen Stories</Text>
                        </View>
                        <TouchableOpacity>
                            <Text className="text-sm font-semibold text-clay-primary font-sans-semibold">See All</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={FOOD_REELS}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ gap: 12 }}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item: reel }) => (
                            <TouchableOpacity className="rounded-3xl overflow-hidden" style={{ width: width * 0.55, height: 280 }} activeOpacity={0.9}>
                                <Image source={{ uri: reel.image }} className="w-full h-full absolute" />
                                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} className="absolute bottom-0 left-0 right-0 h-32" />

                                <View className="absolute top-3 right-3 bg-black/60 px-2 py-1 rounded-full flex-row items-center gap-1">
                                    <Clock size={10} color="white" />
                                    <Text className="text-white text-xs font-sans-medium">{reel.duration}</Text>
                                </View>

                                <View className="absolute inset-0 items-center justify-center">
                                    <View className="w-14 h-14 bg-white/30 rounded-full items-center justify-center">
                                        <Play size={24} color="white" fill="white" />
                                    </View>
                                </View>

                                <View className="absolute bottom-0 left-0 right-0 p-4">
                                    <Text className="text-white font-semibold text-sm font-sans-semibold" numberOfLines={2}>{reel.title}</Text>
                                    <View className="flex-row items-center gap-2 mt-2">
                                        <Image source={{ uri: reel.chefImage }} className="w-6 h-6 rounded-full" />
                                        <Text className="text-white/80 text-xs font-sans">{reel.chef}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                        initialNumToRender={2}
                        maxToRenderPerBatch={3}
                        windowSize={3}
                    />
                </View>

                {/* Did You Know */}
                <View className="mt-8 px-6">
                    <View className="flex-row items-center gap-2 mb-4">
                        <Sparkles size={20} color="#FFCD00" />
                        <Text className="text-lg font-bold text-text-main font-sans-bold">Did You Know?</Text>
                    </View>

                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={DID_YOU_KNOW}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ gap: 12 }}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity className="bg-white p-4 rounded-3xl" style={{ width: width * 0.75, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }} activeOpacity={0.7}>
                                <Text className="text-3xl mb-2">{item.emoji}</Text>
                                <Text className="text-text-main text-sm leading-5 font-sans">{item.fact}</Text>
                            </TouchableOpacity>
                        )}
                        initialNumToRender={2}
                        maxToRenderPerBatch={3}
                        windowSize={3}
                    />
                </View>

                {/* Trending Now */}
                <View className="mt-8 px-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-2">
                            <Flame size={20} color="#C8102E" />
                            <Text className="text-lg font-bold text-text-main font-sans-bold">Trending Now</Text>
                        </View>
                    </View>

                    {TRENDING_NOW.map((item, index) => (
                        <TouchableOpacity key={item.id} className="flex-row items-center gap-4 mb-3 bg-white p-3 rounded-2xl" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }} activeOpacity={0.7}>
                            <Text className="text-2xl font-bold text-clay-primary w-8 font-sans-bold">{index + 1}</Text>
                            <Image source={{ uri: item.image }} className="w-14 h-14 rounded-xl" />
                            <View className="flex-1">
                                <Text className="font-semibold text-text-main font-sans-semibold">{item.name}</Text>
                                <Text className="text-xs text-text-sub mt-0.5 font-sans">{item.searches}</Text>
                            </View>
                            <ArrowRight size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* What's New */}
                <View className="mt-8 px-6 mb-8">
                    <View className="flex-row items-center gap-2 mb-4">
                        <ChefHat size={20} color="#007A33" />
                        <Text className="text-lg font-bold text-text-main font-sans-bold">What's New</Text>
                    </View>

                    {WHATS_NEW.map((item) => (
                        <TouchableOpacity key={item.id} className="bg-white p-4 rounded-3xl mb-3" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }} activeOpacity={0.7}>
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1">
                                    <Text className="font-semibold text-text-main font-sans-semibold">{item.title}</Text>
                                    <Text className="text-sm text-text-sub mt-1 font-sans">{item.description}</Text>
                                </View>
                            </View>
                            <Text className="text-xs text-text-sub mt-3 font-sans">{item.time}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View className="h-24" />
            </ScrollView>
        </View>
    );
}
