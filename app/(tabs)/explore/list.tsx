import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Dimensions, Switch, ActivityIndicator, Alert, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefHat, Flame, Trash2, Plus, Map, List, Lock, UtensilsCrossed, Pencil, Search } from 'lucide-react-native';
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

const TRENDING_NOW = [
    { id: '1', name: 'Waakye', searches: '1.2k searches today', image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200&q=80' },
    { id: '2', name: 'Kelewele', searches: '890 searches today', image: 'https://images.unsplash.com/photo-1596797882870-8c33deeac224?w=200&q=80' },
    { id: '3', name: 'Kontomire Stew', searches: '756 searches today', image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=200&q=80' },
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
                .or('archived.eq.false,archived.is.null')
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
                .select('id, full_name, avatar_url, kitchen_image_url')
                .eq('role', 'COOK')
                .eq('cook_application_status', 'approved')
                .limit(10);
            if (error) return [];
            return (data || []).map((c: any) => ({
                id: c.id,
                name: c.full_name?.split(' ')[0] || 'Chef',
                avatar_url: c.kitchen_image_url || c.avatar_url,
            }));
        },
        staleTime: 5 * 60 * 1000,
    });


    const toggleProductAvailability = async (id: string, currentStatus: boolean) => {
        // Optimistic UI update — patch cache directly to avoid image flicker
        queryClient.setQueryData(['my-menu', userSession?.id], (old: any[]) =>
            (old || []).map(item => item.id === id ? { ...item, available: !currentStatus } : item)
        );
        try {
            const { error } = await supabase.from('listings').update({ available: !currentStatus }).eq('id', id);
            if (error) {
                // Roll back on failure
                queryClient.setQueryData(['my-menu', userSession?.id], (old: any[]) =>
                    (old || []).map(item => item.id === id ? { ...item, available: currentStatus } : item)
                );
                Alert.alert('Error', error.message);
            }
        } catch (err: any) {
            queryClient.setQueryData(['my-menu', userSession?.id], (old: any[]) =>
                (old || []).map(item => item.id === id ? { ...item, available: currentStatus } : item)
            );
            Alert.alert('Error', err.message);
        }
    };

    const deleteProduct = async (id: string) => {
        Alert.alert('Remove Dish', "This will hide the dish from your menu. It won't affect any existing orders.", [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: async () => {
                    // Optimistic remove from list immediately
                    queryClient.setQueryData(['my-menu', userSession?.id], (old: any[]) =>
                        (old || []).filter(item => item.id !== id)
                    );
                    try {
                        // Soft delete — mark as unavailable and archived rather than hard delete
                        // This prevents FK constraint errors if the item is linked to orders
                        const { error } = await supabase
                            .from('listings')
                            .update({ available: false, archived: true })
                            .eq('id', id);
                        if (error) throw error;
                    } catch (err: any) {
                        // Restore on failure
                        queryClient.invalidateQueries({ queryKey: ['my-menu', userSession?.id] });
                        Alert.alert('Error', err.message);
                    }
                }
            }
        ]);
    };

    // Check cook approval
    const { data: cookProfile, isLoading: isCookProfileLoading } = useQuery({
        queryKey: ['cook-approval-check'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;
            const { data } = await supabase
                .from('profiles')
                .select('role, cook_application_status')
                .eq('id', user.id)
                .single();
            return data;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const isApprovedCook = cookProfile?.role === 'COOK' && cookProfile?.cook_application_status === 'approved';

    // COOK MODE — My Menu
    if (isCookMode) {
        if (isCookProfileLoading) {
            return (
                <View className="flex-1 bg-warm-cream items-center justify-center">
                    <ActivityIndicator size="large" color="#D65A31" />
                </View>
            );
        }

        // LOCKED: Not an approved cook
        if (!isApprovedCook) {
            return (
                <View className="flex-1 bg-warm-cream items-center justify-center px-8" style={{ paddingTop: insets.top }}>
                    <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-6">
                        <Lock size={36} color="#9CA3AF" />
                    </View>
                    <Text className="text-2xl font-bold text-text-main text-center mb-3 font-sans-bold">
                        Menu Locked
                    </Text>
                    <Text className="text-text-sub text-center text-base font-sans mb-8 leading-relaxed">
                        Get approved as a cook to manage your menu and list dishes.
                    </Text>
                    {cookProfile?.cook_application_status === 'pending' ? (
                        <View className="bg-orange-50 rounded-2xl px-6 py-4 border border-orange-100 w-full items-center">
                            <Text className="text-clay-primary font-bold text-base font-sans-bold">⏳ Under Review</Text>
                            <Text className="text-text-sub text-sm font-sans mt-1">We'll notify you once approved</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => router.push('/onboarding/apply-to-cook')}
                            className="bg-clay-primary rounded-2xl px-8 py-4 flex-row items-center gap-3 w-full justify-center"
                        >
                            <UtensilsCrossed size={20} color="white" />
                            <Text className="text-white font-bold text-lg font-sans-bold">Apply to Cook</Text>
                        </TouchableOpacity>
                    )}
                </View>
            );
        }

        return (
            <View className="flex-1 bg-warm-cream">
                {/* Header */}
                <View className="px-6 pb-4 bg-white border-b border-gray-100 flex-row justify-between items-center" style={{ paddingTop: insets.top + 48, shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10, zIndex: 10 }}>
                    <View>
                        <Text className="text-3xl font-bold text-text-main font-sans-bold">My Menu</Text>
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
                                style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 6 }}
                            >
                                {/* Cover Image */}
                                <View className="relative">
                                    {dish.image ? (
                                        <Image
                                            source={{ uri: (dish.image.includes(',') ? dish.image.split(',')[0].trim() : dish.image) }}
                                            style={{ width: '100%', height: 220 }}
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
                                    <View className="flex-row gap-2 pt-3 border-t border-gray-50">
                                        <TouchableOpacity
                                            className="flex-1 flex-row items-center justify-center gap-2 py-2.5 bg-clay-primary/10 rounded-xl"
                                            onPress={() => router.push(`/(tabs)/cook?edit_id=${dish.id}`)}
                                        >
                                            <Pencil size={15} color="#D65A31" />
                                            <Text className="text-sm font-semibold text-clay-primary font-sans">Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            className="flex-1 flex-row items-center justify-center gap-2 py-2.5 bg-gray-50 rounded-xl border border-gray-100"
                                            onPress={() => router.push('/(tabs)/cook')}
                                        >
                                            <Plus size={15} color="#6B7280" />
                                            <Text className="text-sm font-semibold text-gray-600 font-sans">New</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            className="flex-row items-center justify-center gap-2 py-2.5 px-4 bg-red-50 rounded-xl"
                                            onPress={() => deleteProduct(dish.id)}
                                        >
                                            <Trash2 size={15} color="#DC2626" />
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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF8F6' }} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

                {/* HEADER */}
                <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#8A7269', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 2 }}>Explore</Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: '#231915', letterSpacing: -0.5 }}>Ghanaian Kitchens</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                        <TouchableOpacity
                            style={{ width: 40, height: 40, backgroundColor: '#FFF1EC', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
                            onPress={() => router.push('/(tabs)/explore/map')}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Map size={18} color="#BF592B" />
                        </TouchableOpacity>
                        <View style={{ width: 40, height: 40, backgroundColor: '#BF592B', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                            <List size={18} color="white" />
                        </View>
                    </View>
                </View>

                {/* SEARCH BAR */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={{ marginHorizontal: 24, marginBottom: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1EC', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, gap: 10, borderWidth: 1, borderColor: '#F2DFD7' }}
                >
                    <Search size={17} color="#8A7269" />
                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#B0988F', flex: 1 }}>Search kitchens, dishes...</Text>
                </TouchableOpacity>

                {/* CATEGORY CHIPS */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 24, gap: 10, paddingBottom: 4 }}
                    style={{ marginBottom: 28 }}
                >
                    {[
                        { label: 'All Kitchens', active: true },
                        { label: 'Traditional Fufu', active: false },
                        { label: 'Vegan', active: false },
                        { label: 'Gluten-Free', active: false },
                        { label: 'Halal', active: false },
                    ].map((chip) => (
                        <TouchableOpacity
                            key={chip.label}
                            style={{
                                backgroundColor: chip.active ? '#BF592B' : '#FFF1EC',
                                paddingHorizontal: 18,
                                paddingVertical: 9,
                                borderRadius: 9999,
                                borderWidth: 1,
                                borderColor: chip.active ? '#BF592B' : '#DDC1B6',
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={{
                                fontFamily: chip.active ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium',
                                fontSize: 13,
                                color: chip.active ? 'white' : '#56423B',
                            }}>{chip.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* COOK STORIES */}
                <View style={{ marginBottom: 28 }}>
                    <View style={{ paddingHorizontal: 24, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915' }}>Active Cooks</Text>
                        <TouchableOpacity onPress={() => router.push('/(tabs)/explore/map')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#BF592B' }}>See all</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={realCooks.length > 0 ? realCooks : FOOD_STORIES.map(s => ({ id: s.id, name: s.name, avatar_url: s.image }))}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item: cook }) => (
                            <TouchableOpacity
                                style={{ alignItems: 'center' }}
                                activeOpacity={0.75}
                                onPress={() => router.push('/(tabs)/explore/map')}
                            >
                                <View style={{ width: 72, height: 72, borderRadius: 36, padding: 2.5, backgroundColor: '#BF592B' }}>
                                    <View style={{ width: 67, height: 67, borderRadius: 34, borderWidth: 2, borderColor: 'white', overflow: 'hidden', backgroundColor: '#F2DFD7' }}>
                                        {cook.avatar_url ? (
                                            <Image source={{ uri: cook.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                        ) : (
                                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1EC' }}>
                                                <ChefHat size={26} color="#BF592B" />
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#231915', marginTop: 6, maxWidth: 64 }} numberOfLines={1}>{cook.name}</Text>
                            </TouchableOpacity>
                        )}
                        initialNumToRender={5}
                        maxToRenderPerBatch={5}
                        windowSize={3}
                    />
                </View>

                {/* FEATURED EDITORIAL CARDS */}
                <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915' }}>Featured</Text>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}
                    style={{ marginBottom: 32 }}
                    decelerationRate="fast"
                >
                    {/* Main card — Chef's Special with real food image */}
                    <TouchableOpacity
                        style={{ width: width * 0.72, height: 204, borderRadius: 24, overflow: 'hidden' }}
                        activeOpacity={0.9}
                        onPress={() => router.push('/(tabs)/explore/map')}
                    >
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80' }}
                            style={{ position: 'absolute', width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(35,25,21,0.84)']}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 130 }}
                        />
                        <View style={{ position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 }}>
                            <Text style={{ fontSize: 11 }}>⭐</Text>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#231915' }}>4.9</Text>
                        </View>
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18 }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Chef's Special</Text>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: 'white', lineHeight: 26, marginBottom: 12 }}>Authentic Waakye{'\n'}Experience</Text>
                            <View style={{ backgroundColor: '#BF592B', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, alignSelf: 'flex-start' }}>
                                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: 'white' }}>View Menu</Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Medium card — Trending with green overlay */}
                    <TouchableOpacity
                        style={{ width: width * 0.48, height: 204, borderRadius: 24, overflow: 'hidden' }}
                        activeOpacity={0.9}
                        onPress={() => router.push('/(tabs)')}
                    >
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&q=80' }}
                            style={{ position: 'absolute', width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['rgba(0,106,60,0.55)', 'rgba(0,106,60,0.92)']}
                            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
                        />
                        <View style={{ flex: 1, padding: 18, justifyContent: 'flex-end' }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Trending</Text>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: 'white', lineHeight: 22, marginBottom: 14 }}>Weekend{'\n'}Feast Boxes</Text>
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9999, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)' }}>
                                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: 'white' }}>View Menu</Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Small card — Fresh with brown overlay */}
                    <TouchableOpacity
                        style={{ width: width * 0.38, height: 204, borderRadius: 24, overflow: 'hidden' }}
                        activeOpacity={0.9}
                        onPress={() => router.push('/(tabs)')}
                    >
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1596797882870-8c33deeac224?w=300&q=80' }}
                            style={{ position: 'absolute', width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['rgba(132,82,60,0.45)', 'rgba(132,82,60,0.94)']}
                            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
                        />
                        <View style={{ flex: 1, padding: 16, justifyContent: 'flex-end' }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Fresh</Text>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: 'white', lineHeight: 19, marginBottom: 12 }}>100%{'\n'}Home Cooked</Text>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)' }}>
                                <Text style={{ color: 'white', fontSize: 16, lineHeight: 20 }}>→</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </ScrollView>

                {/* POPULAR DISHES HEADER */}
                <View style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Flame size={18} color="#BF592B" fill="#BF592B" />
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915' }}>Popular Dishes</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/explore/map')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#BF592B' }}>See All</Text>
                    </TouchableOpacity>
                </View>

                {/* POPULAR DISHES GRID — white rounded-3xl cards with delivery badge */}
                <View style={{ paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {TRENDING_NOW.concat([
                        { id: '4', name: 'Fufu & Light Soup', searches: '~30 min', image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&q=80' },
                    ]).map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={{
                                width: (width - 52) / 2,
                                backgroundColor: 'white',
                                borderRadius: 24,
                                overflow: 'hidden',
                                shadowColor: '#231915',
                                shadowOffset: { width: 0, height: 3 },
                                shadowOpacity: 0.07,
                                shadowRadius: 12,
                                elevation: 3,
                            }}
                            activeOpacity={0.85}
                            onPress={() => router.push('/(tabs)')}
                        >
                            <View style={{ height: 128, backgroundColor: '#F2DFD7', position: 'relative' }}>
                                <Image source={{ uri: (item.image && item.image.includes(',') ? item.image.split(',')[0].trim() : item.image) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                <View style={{ position: 'absolute', bottom: 9, left: 9, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9999 }}>
                                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#231915' }}>
                                        {item.searches.includes('today') ? '~25 min' : item.searches}
                                    </Text>
                                </View>
                            </View>
                            <View style={{ padding: 12 }}>
                                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#231915' }} numberOfLines={1}>{item.name}</Text>
                                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#8A7269', marginTop: 3 }} numberOfLines={1}>
                                    {item.searches.includes('today') ? 'Trending near you' : 'Home cooked daily'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* CULTURAL BANNER */}
                <View style={{ marginHorizontal: 20, marginTop: 28, backgroundColor: '#FFF1EC', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F2DFD7', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#BF592B', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ChefHat size={26} color="white" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#231915', marginBottom: 4 }}>Support Local Hearth-Keepers</Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#56423B', lineHeight: 18 }}>Every order supports a home cook in your community.</Text>
                    </View>
                </View>

                {/* CRAVEABLE COLLECTIONS */}
                <View style={{ paddingHorizontal: 24, marginTop: 28, marginBottom: 14 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915', marginBottom: 2 }}>Craveable Collections</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#8A7269' }}>Curated for every craving</Text>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}
                    decelerationRate="fast"
                >
                    {[
                        { id: '1', title: 'Sunday Comfort', subtitle: '12 dishes', color: '#BF592B', emoji: '🍲' },
                        { id: '2', title: 'Under ₵30', subtitle: '8 dishes', color: '#006A3C', emoji: '💚' },
                        { id: '3', title: 'Vegan Picks', subtitle: '6 dishes', color: '#84523C', emoji: '🌿' },
                        { id: '4', title: 'Quick & Fresh', subtitle: '10 dishes', color: '#4A3728', emoji: '⚡' },
                    ].map((col) => (
                        <TouchableOpacity
                            key={col.id}
                            style={{ width: width * 0.38, backgroundColor: col.color, borderRadius: 20, padding: 18, height: 112, justifyContent: 'space-between' }}
                            activeOpacity={0.85}
                            onPress={() => router.push('/(tabs)')}
                        >
                            <Text style={{ fontSize: 26 }}>{col.emoji}</Text>
                            <View>
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: 'white', lineHeight: 18, marginBottom: 2 }}>{col.title}</Text>
                                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{col.subtitle}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

            </ScrollView>
        </SafeAreaView>
    );
}
