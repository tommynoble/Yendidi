import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, TextInput, Modal, Switch, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, LogOut, ChevronRight, User, Phone, ShieldCheck, ChefHat, RefreshCw, MapPin, Clock, Utensils, Calendar, Navigation, X, Check, Camera, Menu, Search, Star, Gem, Crown, CreditCard, Bell, Soup, Fish, Flame } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import ProcessLoader from '@/components/ProcessLoader';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { getDishImage } from '@/constants/Images';
import Svg, { Path, Circle } from 'react-native-svg';

export default function ProfileScreen() {
    const router = useRouter();
    const { isCookMode, toggleCookMode } = useAppStore();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState({ orders: 0, reviews: 0, saved: 0 });
    const [pendingApp, setPendingApp] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [locationEdit, setLocationEdit] = useState(false);
    const [locationDraft, setLocationDraft] = useState('');
    const [locationFetching, setLocationFetching] = useState(false);
    const [locationSaving, setLocationSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [isFlipped, setIsFlipped] = useState(false);
    const [copied, setCopied] = useState(false);
    const flipAnimation = React.useRef(new Animated.Value(0)).current;

    const skeletonOpacity = React.useRef(new Animated.Value(0.35)).current;

    useEffect(() => {
        let anim: Animated.CompositeAnimation;
        if (loading) {
            anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(skeletonOpacity, {
                        toValue: 0.75,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(skeletonOpacity, {
                        toValue: 0.35,
                        duration: 800,
                        useNativeDriver: true,
                    })
                ])
            );
            anim.start();
        }
        return () => {
            if (anim) anim.stop();
        };
    }, [loading]);

    const [switchingMode, setSwitchingMode] = useState(false);
    const pulseAnim = React.useRef(new Animated.Value(0.95)).current;
    const spinAnim = React.useRef(new Animated.Value(0)).current;
    const [loaderIconIndex, setLoaderIconIndex] = useState(0);

    useEffect(() => {
        let interval: any;
        if (switchingMode) {
            // Pulse animation loop
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.06,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0.94,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Continuous spin animation loop
            Animated.loop(
                Animated.timing(spinAnim, {
                    toValue: 1,
                    duration: 3500,
                    useNativeDriver: true,
                })
            ).start();

            // Cycle loader icons every 300ms for a lively, smooth food reel
            interval = setInterval(() => {
                setLoaderIconIndex((prev) => (prev + 1) % 5);
            }, 300);
        } else {
            pulseAnim.setValue(0.95);
            spinAnim.setValue(0);
            setLoaderIconIndex(0);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [switchingMode]);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handleToggleWithLoader = () => {
        setSwitchingMode(true);
        setTimeout(() => {
            toggleCookMode();
            setSwitchingMode(false);
        }, 1500);
    };

    const LOADER_ICONS = [ChefHat, Flame, Soup, Fish, Utensils];

    const toggleFlip = () => {
        Animated.spring(flipAnimation, {
            toValue: isFlipped ? 0 : 180,
            friction: 8,
            tension: 10,
            useNativeDriver: true,
        }).start();
        setIsFlipped(!isFlipped);
    };

    const copyCode = () => {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText('SANKOFA20');
            }
        } catch (_) {}
        setCopied(true);
        Alert.alert('Promo Code Copied!', 'Use SANKOFA20 at checkout for 20% off.');
        setTimeout(() => setCopied(false), 2000);
    };

    const frontInterpolate = flipAnimation.interpolate({
        inputRange: [0, 180],
        outputRange: ['0deg', '180deg'],
    });
    const backInterpolate = flipAnimation.interpolate({
        inputRange: [0, 180],
        outputRange: ['180deg', '360deg'],
    });

    const frontOpacity = flipAnimation.interpolate({
        inputRange: [89, 90],
        outputRange: [1, 0],
    });
    const backOpacity = flipAnimation.interpolate({
        inputRange: [89, 90],
        outputRange: [0, 1],
    });

    const pickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        });

        if (result.canceled || !result.assets[0].base64) return;

        setAvatarUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not logged in');

            const filePath = `${user.id}/avatar_${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, decode(result.assets[0].base64), {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setProfile((p: any) => ({ ...p, avatar_url: publicUrl }));
            Alert.alert('Done! 📸', 'Profile picture updated.');
        } catch (err: any) {
            Alert.alert('Upload Failed', err.message);
        } finally {
            setAvatarUploading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await getProfile();
        setRefreshing(false);
    }, []);

    useEffect(() => {
        getProfile();
    }, []);

    async function getProfile() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            setProfile(data);

            // Fetch stats
            const { count, error: countError } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            if (!countError) {
                setStats(prev => ({ ...prev, orders: count || 0 }));
            }



            // Fetch pending application if status is pending
            if (data.cook_application_status === 'pending') {
                const { data: appData, error: appError } = await supabase
                    .from('cook_applications')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'pending')
                    .single();
                
                if (!appError) {
                    setPendingApp(appData);
                }
            }

        } catch (error: any) {
            console.log('Error fetching profile:', error.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSignOut() {
        const { error } = await supabase.auth.signOut();
        if (error) Alert.alert('Error', error.message);
        router.replace('/onboarding');
    }

    const useCurrentLocation = async () => {
        setLocationFetching(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Allow location access.');
                setLocationFetching(false);
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            if (geo) {
                const parts = [geo.district || geo.subregion, geo.city || geo.region].filter(Boolean);
                setLocationDraft(parts.join(', '));
            }
        } catch (e) {
            Alert.alert('Error', 'Could not get location.');
        }
        setLocationFetching(false);
    };

    const saveLocation = async () => {
        setLocationSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { error } = await supabase.from('profiles').update({ location: locationDraft }).eq('id', user.id);
            if (error) throw error;
            setProfile((p: any) => ({ ...p, location: locationDraft }));
            setLocationEdit(false);
        } catch (e: any) {
            Alert.alert('Error saving location', e.message);
        }
        setLocationSaving(false);
    };


    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-warm-cream" edges={['top', 'bottom']}>
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {/* Welcome Row Skeleton */}
                    <View style={{ paddingTop: 16 }} className="px-6 pb-4 flex-row items-center gap-4">
                        <Animated.View style={{ opacity: skeletonOpacity }} className="w-20 h-20 bg-gray-200 rounded-full border-2 border-white shadow-sm" />
                        <View className="flex-1">
                            <Animated.View style={{ opacity: skeletonOpacity }} className="h-6 w-40 bg-gray-200 rounded-md mb-2" />
                            <Animated.View style={{ opacity: skeletonOpacity }} className="h-4 w-32 bg-gray-200 rounded-md" />
                        </View>
                    </View>

                    {/* Stats Row Skeleton */}
                    <View className="flex-row justify-around bg-[#FCFBFA] border border-[#F2DFD7] mx-6 mb-6 py-4 rounded-2xl">
                        {[1, 2, 3].map((i) => (
                            <View key={i} className="items-center flex-1" style={i < 3 ? { borderRightWidth: 1, borderRightColor: '#F2DFD7' } : {}}>
                                <Animated.View style={{ opacity: skeletonOpacity }} className="h-5 w-10 bg-gray-200 rounded mb-1.5" />
                                <Animated.View style={{ opacity: skeletonOpacity }} className="h-3 w-16 bg-gray-200 rounded" />
                            </View>
                        ))}
                    </View>

                    {/* Switch Mode Card Skeleton */}
                    <View className="px-6 mb-6">
                        <Animated.View 
                            style={{ opacity: skeletonOpacity }} 
                            className="bg-[#FCFBFA] border border-[#F2DFD7] rounded-2xl p-4 h-20 flex-row items-center justify-between"
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-12 h-12 rounded-full bg-gray-200" />
                                <View className="gap-1.5">
                                    <View className="h-4 w-28 bg-gray-200 rounded" />
                                    <View className="h-3 w-44 bg-gray-200 rounded" />
                                </View>
                            </View>
                            <View className="w-10 h-6 bg-gray-200 rounded-full" />
                        </Animated.View>
                    </View>

                    {/* Rewards & Discounts Card Skeleton */}
                    <View className="mb-6">
                        <View className="flex-row justify-between items-end px-6 mb-3">
                            <Animated.View style={{ opacity: skeletonOpacity }} className="h-5 w-44 bg-gray-200 rounded" />
                            <Animated.View style={{ opacity: skeletonOpacity }} className="h-4 w-24 bg-gray-200 rounded" />
                        </View>
                        <Animated.View 
                            style={{ opacity: skeletonOpacity }} 
                            className="mx-6 h-64 bg-gray-200 rounded-3xl shadow-sm"
                        />
                    </View>

                    {/* Account Settings Section Skeleton */}
                    <View className="mb-6">
                        <View className="px-6 mb-3">
                            <Animated.View style={{ opacity: skeletonOpacity }} className="h-5 w-36 bg-gray-200 rounded" />
                        </View>
                        <View className="px-6 gap-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Animated.View 
                                    key={i} 
                                    style={{ opacity: skeletonOpacity }} 
                                    className="flex-row items-center bg-[#FCFBFA] p-3 rounded-2xl border border-[#F2DFD7] h-14"
                                >
                                    <View className="w-10 h-10 bg-gray-200 rounded-xl mr-3" />
                                    <View className="flex-1 h-4 bg-gray-200 rounded" />
                                    <View className="w-4 h-4 bg-gray-200 rounded-full" />
                                </Animated.View>
                            ))}
                        </View>
                    </View>

                    {/* Adinkra Footer Skeleton */}
                    <View className="items-center justify-center py-8">
                        <Animated.View style={{ opacity: skeletonOpacity }} className="w-12 h-12 bg-gray-200 rounded-full mb-3" />
                        <Animated.View style={{ opacity: skeletonOpacity }} className="h-3 w-40 bg-gray-200 rounded" />
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (!profile) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center p-6" edges={['top']}>
                <View className="flex-1 bg-warm-cream items-center justify-center w-full">
                <Text className="text-xl font-bold text-text-main mb-4 font-sans-bold">Not Logged In</Text>
                <TouchableOpacity
                    className="bg-clay-primary px-8 py-3 rounded-xl"
                    onPress={() => router.replace('/onboarding')}
                >
                    <Text className="text-white font-bold font-sans-bold">Sign In</Text>
                </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }



    const SETTINGS_ITEMS = [
        {
            id: 'personal',
            title: 'Personal Information',
            icon: User,
            action: () => Alert.alert('Personal Information', 'Profile editing will be available soon.')
        },
        ...(profile.role === 'COOK' && profile.cook_application_status === 'approved' && isCookMode ? [{
            id: 'kitchen-settings',
            title: 'Kitchen Settings',
            icon: ChefHat,
            action: () => router.push('/kitchen-settings')
        }] : []),
        {
            id: 'address',
            title: 'My Addresses',
            icon: MapPin,
            action: () => router.push('/address')
        },
        {
            id: 'payment',
            title: 'Payment Methods',
            icon: CreditCard,
            action: () => Alert.alert('Payment Methods', 'Payment settings will be available soon.')
        },
        {
            id: 'notifications',
            title: 'Notifications',
            icon: Bell,
            isSwitch: true
        },
        {
            id: 'privacy',
            title: 'Privacy & Security',
            icon: ShieldCheck,
            action: () => Alert.alert('Privacy & Security', 'Security settings will be available soon.')
        },
        {
            id: 'logout',
            title: 'Logout',
            icon: LogOut,
            isLogout: true,
            action: handleSignOut
        }
    ];

    return (
        <SafeAreaView className="flex-1 bg-warm-cream" edges={['bottom']}>
            {/* Location Edit Modal */}
            <Modal visible={locationEdit} transparent animationType="slide" onRequestClose={() => setLocationEdit(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        activeOpacity={1}
                        onPress={() => setLocationEdit(false)}
                    />
                    <View className="bg-white rounded-t-3xl p-6">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-bold text-text-main font-sans-bold">Set Your Location</Text>
                            <TouchableOpacity onPress={() => setLocationEdit(false)}>
                                <X size={22} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <Text className="text-sm text-text-sub font-sans mb-3">
                            This helps cooks and eaters know where you are. Cooks: this shows on your listings.
                        </Text>
                        <View className="flex-row gap-2 mb-4">
                            <TextInput
                                placeholder="e.g. East Legon, Accra"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-text-main font-sans text-base border border-gray-100"
                                value={locationDraft}
                                onChangeText={setLocationDraft}
                                autoFocus
                            />
                            <TouchableOpacity
                                onPress={useCurrentLocation}
                                disabled={locationFetching}
                                className="bg-[#FFF1EC] rounded-xl px-3 items-center justify-center border border-[#F2DFD7]"
                            >
                                {locationFetching
                                    ? <ActivityIndicator size="small" color="#BF592B" />
                                    : <Navigation size={20} color="#BF592B" />}
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            onPress={saveLocation}
                            disabled={locationSaving}
                            className="bg-clay-primary rounded-2xl py-4 flex-row items-center justify-center gap-2"
                            style={{ shadowColor: '#BF592B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                        >
                            {locationSaving
                                ? <ActivityIndicator size="small" color="white" />
                                : <><Check size={18} color="white" /><Text className="text-white font-bold font-sans-bold">Save Location</Text></>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <View className="flex-1 bg-warm-cream">
                <ScrollView 
                    className="flex-1" 
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BF592B" colors={["#BF592B"]} />
                    }
                >
                    {/* Welcome Row */}
                    <View style={{ paddingTop: insets.top + 16 }} className="px-6 pb-4 flex-row items-center gap-4">
                        <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} className="relative">
                            <View className="w-20 h-20 bg-white rounded-full overflow-hidden border-2 border-[#F2DFD7] shadow-sm p-1">
                                <View className="w-full h-full rounded-full overflow-hidden">
                                    {avatarUploading ? (
                                        <View className="w-full h-full items-center justify-center bg-gray-100">
                                            <ActivityIndicator size="small" color="#BF592B" />
                                        </View>
                                    ) : profile.avatar_url ? (
                                        <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                                    ) : (
                                        <View className="w-full h-full items-center justify-center bg-clay-primary/10">
                                            <User size={32} color="#BF592B" />
                                        </View>
                                    )}
                                </View>
                            </View>
                            <View className="absolute bottom-0 right-0 w-6 h-6 bg-clay-primary rounded-full items-center justify-center border-2 border-white shadow-sm">
                                <Camera size={12} color="white" />
                            </View>
                        </TouchableOpacity>

                        <View className="flex-1">
                            <Text className="text-2xl font-bold text-[#84523C] font-serif" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                                Welcome Back, {profile.full_name?.split(' ')[0] || 'Kojo'}
                            </Text>
                            
                            <TouchableOpacity
                                className="flex-row items-center gap-1.5 mt-1"
                                onPress={() => { setLocationDraft(profile.location || ''); setLocationEdit(true); }}
                            >
                                <MapPin size={14} color="#BF592B" />
                                <Text className="text-xs text-text-sub font-sans" numberOfLines={1}>
                                    {profile.location || 'Greater Accra, Ghana'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stats Row */}
                    <View className="flex-row justify-around bg-[#FCFBFA] border border-[#F2DFD7] mx-6 mb-6 py-3 rounded-2xl">
                        <View className="items-center flex-1 border-r border-[#F2DFD7]">
                            <Text className="text-xl font-bold text-text-main font-sans-bold">{stats.orders}</Text>
                            <Text className="text-xs text-text-sub font-sans">{isCookMode ? 'Sales' : 'Orders'}</Text>
                        </View>
                        <View className="items-center flex-1 border-r border-[#F2DFD7]">
                            <Text className="text-xl font-bold text-text-main font-sans-bold">{stats.reviews}</Text>
                            <Text className="text-xs text-text-sub font-sans">Reviews</Text>
                        </View>
                        <View className="items-center flex-1">
                            <Text className="text-xl font-bold text-text-main font-sans-bold">{stats.saved}</Text>
                            <Text className="text-xs text-text-sub font-sans">Saved</Text>
                        </View>
                    </View>

                    {/* COOK STATUS / SWITCH MODE BUTTON */}
                    {profile.role === 'COOK' && profile.cook_application_status === 'approved' ? (
                        <View className="px-6 mb-6">
                            {/* Celebration Banner (shows for 24 hours after approval) */}
                            {profile.cook_approved_at && (function() {
                                try {
                                    const approvedDate = new Date(profile.cook_approved_at);
                                    if (isNaN(approvedDate.getTime())) return false;
                                    const diff = Date.now() - approvedDate.getTime();
                                    return diff < (24 * 60 * 60 * 1000);
                                } catch (e) {
                                    return false;
                                }
                            })() && (
                                <View className="mb-4 bg-green-50 rounded-3xl p-5 border border-green-200 shadow-sm">
                                    <View className="flex-row items-center gap-3 mb-3">
                                        <Text className="text-3xl">🎉</Text>
                                        <View className="flex-1">
                                            <Text className="font-bold text-green-800 text-lg font-sans-bold">You're Approved!</Text>
                                            <Text className="text-green-600 text-xs font-sans">Welcome to the YɛnDidii cook community</Text>
                                        </View>
                                    </View>
                                    <Text className="text-green-700 text-sm font-sans leading-5">
                                        Your kitchen has been verified. You can now host meal sessions to your community! Switch to Kitchen Mode below to get started.
                                    </Text>
                                </View>
                            )}

                            {/* Switch Mode Card with Switch Component */}
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={handleToggleWithLoader}
                                className="bg-[#FCFBFA] border border-[#F2DFD7] rounded-2xl p-4 shadow-sm flex-row items-center justify-between active:scale-98"
                            >
                                <View className="flex-row items-center gap-4">
                                    <View className="w-12 h-12 rounded-full bg-[#FFF1EC] items-center justify-center">
                                        <ChefHat size={24} color="#BF592B" />
                                    </View>
                                    <View>
                                        <Text className="font-bold text-text-main text-lg font-sans-bold">
                                            Kitchen Mode
                                        </Text>
                                        <Text className="text-text-sub text-xs font-sans">
                                            {isCookMode ? 'Manage your menu & chef dashboard' : 'Toggle to manage your kitchen & menu'}
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={isCookMode}
                                    onValueChange={handleToggleWithLoader}
                                    trackColor={{ false: '#F2DFD7', true: '#E9D6CF' }}
                                    thumbColor={isCookMode ? '#BF592B' : '#83746E'}
                                    ios_backgroundColor="#F2DFD7"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>
                        </View>
                    ) : profile.cook_application_status === 'pending' ? (
                        <View className="mx-6 mb-6 bg-[#FCFBFA] border border-[#F2DFD7] rounded-3xl p-5 shadow-sm">
                            <View className="flex-row items-center justify-between mb-4 border-b border-gray-100 pb-4">
                                <View>
                                    <Text className="font-bold text-text-main text-lg font-sans-bold">Kitchen Profile</Text>
                                    <Text className="text-text-sub text-xs font-sans">Waitlist preview</Text>
                                </View>
                                <View className="bg-[#FFF1EC] px-3 py-1.5 rounded-full flex-row items-center gap-1.5 border border-[#F2DFD7]">
                                    <Clock size={12} color="#BF592B" />
                                    <Text className="text-clay-primary text-xs font-sans-semibold">Under Review</Text>
                                </View>
                            </View>

                            <View className="gap-4">
                                <View className="flex-row items-start gap-3">
                                    <View className="w-10 h-10 bg-[#FFF1EC] rounded-xl items-center justify-center mt-0.5">
                                        <ChefHat size={20} color="#BF592B" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-xs text-text-sub font-sans uppercase tracking-wider mb-0.5">Kitchen Name</Text>
                                        <Text className="font-semibold text-text-main text-base font-sans mt-0.5">{pendingApp?.kitchen_name || 'Loading...'}</Text>
                                    </View>
                                </View>

                                <View className="flex-row items-start gap-3">
                                    <View className="w-10 h-10 bg-green-50 rounded-xl items-center justify-center mt-0.5">
                                        <Utensils size={20} color="#007A33" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-xs text-text-sub font-sans uppercase tracking-wider mb-0.5">Specialties</Text>
                                        <View className="flex-row flex-wrap gap-1 mt-1">
                                            {pendingApp?.specialties?.map((spec: string, i: number) => (
                                                <View key={i} className="bg-gray-100 px-2 py-1 rounded-md">
                                                    <Text className="text-text-main text-xs font-sans">{spec}</Text>
                                                </View>
                                            )) || <Text className="text-text-main text-sm font-sans mt-0.5">...</Text>}
                                        </View>
                                    </View>
                                </View>

                                <View className="flex-row items-start gap-3">
                                    <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mt-0.5">
                                        <Calendar size={20} color="#0066CC" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-xs text-text-sub font-sans uppercase tracking-wider mb-0.5">Hosting Plan</Text>
                                        <Text className="text-text-main text-sm font-sans mt-0.5 capitalize">
                                            {pendingApp?.cooking_frequency?.replace('_', ' ') || '...'} • {pendingApp?.max_session_capacity || '-'} guests
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ) : profile.cook_application_status === 'rejected' ? (
                        <TouchableOpacity
                            className="mx-6 mb-6 bg-red-50 rounded-2xl p-4 border border-red-100 flex-row items-center justify-between active:scale-98"
                            onPress={() => router.push('/onboarding/apply-to-cook')}
                        >
                            <View className="flex-row items-center gap-4 flex-1">
                                <View className="w-12 h-12 rounded-full bg-white items-center justify-center">
                                    <Settings size={22} color="#DC2626" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-bold text-red-600 text-base font-sans-bold">Application Rejected</Text>
                                    <Text className="text-red-600/70 text-xs font-sans" numberOfLines={1}>
                                        {profile.cook_rejection_reason || 'Please edit and resubmit your details'}
                                    </Text>
                                </View>
                            </View>
                            <RefreshCw size={18} color="#DC2626" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            className="mx-6 mb-6 bg-clay-primary rounded-2xl p-4 shadow-sm flex-row items-center justify-between active:scale-98"
                            onPress={() => router.push('/onboarding/apply-to-cook')}
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center">
                                    <ChefHat size={24} color="white" />
                                </View>
                                <View>
                                    <Text className="font-bold text-white text-lg font-sans-bold">Apply to Cook</Text>
                                    <Text className="text-white/80 text-xs font-sans">Share your meals & earn from your kitchen</Text>
                                </View>
                            </View>
                            <ChevronRight size={20} color="white" />
                        </TouchableOpacity>
                    )}

                    {/* Show Switch to Eating for non-approved users stuck in cook mode */}
                    {isCookMode && !(profile.role === 'COOK' && profile.cook_application_status === 'approved') && (
                        <TouchableOpacity
                            className="mx-6 mb-6 bg-white rounded-2xl p-4 shadow-sm flex-row items-center justify-between border border-gray-100 active:scale-98"
                            onPress={handleToggleWithLoader}
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-12 h-12 rounded-full bg-gray-50 items-center justify-center">
                                    <RefreshCw size={24} color="#BF592B" />
                                </View>
                                <View>
                                    <Text className="font-bold text-text-main text-lg font-sans-bold">
                                        Switch to Eating
                                    </Text>
                                    <Text className="text-text-sub text-xs font-sans">
                                        Go back to finding food
                                    </Text>
                                </View>
                            </View>
                            <ChevronRight size={20} color="#BF592B" />
                        </TouchableOpacity>
                    )}

                    {/* Rewards & Discounts Section */}
                    {!isCookMode && (
                        <View className="mb-6">
                            <View className="flex-row justify-between items-end px-6 mb-3">
                                <Text className="text-lg font-bold text-text-main font-sans-bold">
                                    Rewards & Discounts
                                </Text>
                                <TouchableOpacity onPress={() => Alert.alert('Benefits', 'Rewards program details will be available soon.')}>
                                    <Text className="text-sm font-semibold text-clay-primary font-sans-semibold">
                                        View Benefits
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Flidable Card Container */}
                            <TouchableOpacity 
                                activeOpacity={0.95} 
                                onPress={toggleFlip}
                                className="mx-6 h-64"
                            >
                                {/* FRONT SIDE */}
                                <Animated.View 
                                    style={{
                                        transform: [{ rotateY: frontInterpolate }],
                                        opacity: frontOpacity,
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backfaceVisibility: 'hidden'
                                    }}
                                    className="bg-clay-primary p-5 rounded-3xl shadow-sm justify-between"
                                >
                                    <View className="flex-row justify-between items-start">
                                        <View>
                                            <Text className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                                                Current Status
                                            </Text>
                                            <Text className="text-2xl font-bold text-white font-serif mt-0.5" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                                                Sankofa Tier
                                            </Text>
                                        </View>
                                        <View className="bg-white rounded-full px-3 py-1.5 flex-row items-center gap-1">
                                            <Star size={12} color="#BF592B" fill="#BF592B" />
                                            <Text className="text-clay-primary text-xs font-bold font-sans-bold">
                                                1,240 pts
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <View className="mt-2">
                                        <View className="h-2 bg-white/20 rounded-full overflow-hidden">
                                            <View className="w-[75%] h-full bg-green-400 rounded-full" />
                                        </View>
                                        <View className="flex-row justify-between items-center mt-2">
                                            <Text className="text-[10px] text-white/80 font-sans">
                                                260 pts to Next Tier
                                            </Text>
                                            <Text className="text-[10px] text-white/80 font-sans">
                                                Gold Tier Milestone
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <View className="flex-row justify-between items-center relative px-1 mt-4">
                                        <View className="absolute left-6 right-6 top-[20px] h-[1px] bg-white/20" />
                                        <View className="absolute left-6 w-[33%] top-[20px] h-[1px] bg-green-400" />
                                        
                                        {[
                                            { label: 'Root', key: 'root', done: true },
                                            { label: 'Sankofa', key: 'sankofa', active: true },
                                            { label: 'Nyame', key: 'nyame' },
                                            { label: 'Ohene', key: 'ohene' }
                                        ].map((tier) => (
                                            <View key={tier.label} className="items-center z-10 flex-1">
                                                <View 
                                                    className={`w-10 h-10 rounded-full border-2 items-center justify-center ${
                                                        tier.active 
                                                            ? 'bg-green-400 border-green-400' 
                                                            : tier.done
                                                                ? 'bg-clay-primary border-white'
                                                                : 'bg-clay-primary border-white/40'
                                                    }`}
                                                >
                                                    {tier.active ? (
                                                        <View className="w-3.5 h-3.5 rounded-full bg-green-400 items-center justify-center">
                                                            <Check size={10} color="white" strokeWidth={4} />
                                                        </View>
                                                    ) : tier.label === 'Nyame' ? (
                                                        <Gem size={14} color={tier.done ? 'white' : 'rgba(255,255,255,0.4)'} />
                                                    ) : tier.label === 'Ohene' ? (
                                                        <Crown size={14} color={tier.done ? 'white' : 'rgba(255,255,255,0.4)'} />
                                                    ) : (
                                                        <View className="w-2.5 h-2.5 rounded-full bg-white" />
                                                    )}
                                                </View>
                                                <Text className={`text-[10px] mt-1.5 font-sans-medium ${tier.active ? 'text-white font-bold' : 'text-white/60'}`}>
                                                    {tier.label}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </Animated.View>

                                {/* BACK SIDE */}
                                <Animated.View 
                                    style={{
                                        transform: [{ rotateY: backInterpolate }],
                                        opacity: backOpacity,
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backfaceVisibility: 'hidden'
                                    }}
                                    className="bg-[#392E29] p-5 rounded-3xl shadow-sm justify-between border border-clay-primary/20"
                                >
                                    <View className="flex-row justify-between items-start">
                                        <View>
                                            <Text className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                                                Tier Reward
                                            </Text>
                                            <Text className="text-xl font-bold text-white font-serif mt-0.5" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                                                Sankofa Discount Code
                                            </Text>
                                        </View>
                                        <View className="bg-clay-primary/20 border border-clay-primary/30 rounded-full px-3 py-1">
                                            <Text className="text-clay-primary text-xs font-bold font-sans-bold">
                                                20% OFF
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="items-center my-2">
                                        <TouchableOpacity 
                                            activeOpacity={0.8}
                                            onPress={(e) => { e.stopPropagation(); copyCode(); }}
                                            className="bg-[#231915] border border-dashed border-clay-primary rounded-2xl px-6 py-4 items-center justify-center w-full"
                                        >
                                            <Text className="text-2xl font-bold text-white tracking-widest font-sans-bold">
                                                SANKOFA20
                                            </Text>
                                            <Text className="text-clay-primary text-xs font-sans-medium mt-1">
                                                {copied ? 'Copied to Clipboard! 📋' : 'Tap to Copy Code'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View className="flex-row justify-between items-center mt-2 border-t border-white/10 pt-3">
                                        <Text className="text-[10px] text-white/50 font-sans">
                                            * Valid on next meal session
                                        </Text>
                                        <Text className="text-[10px] text-clay-primary font-sans-medium">
                                            Tap card to flip back
                                        </Text>
                                    </View>
                                </Animated.View>
                            </TouchableOpacity>
                        </View>
                    )}



                    {/* Account Settings Section */}
                    <View className="mb-6">
                        <View className="px-6 mb-3">
                            <Text className="text-lg font-bold text-text-main font-sans-bold">
                                Account Settings
                            </Text>
                        </View>

                        <View className="px-6 gap-3">
                            {SETTINGS_ITEMS.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <View
                                        key={item.id}
                                        className="flex-row items-center bg-[#FCFBFA] p-3 rounded-2xl border border-[#F2DFD7]"
                                    >
                                        <View className="w-10 h-10 bg-[#FFF1EC] rounded-xl items-center justify-center mr-3">
                                            <Icon size={20} color={item.isLogout ? "#DC2626" : "#BF592B"} />
                                        </View>
                                        
                                        <Text className={`flex-1 text-base font-sans-medium ${item.isLogout ? 'text-red-600 font-bold' : 'text-text-main'}`}>
                                            {item.title}
                                        </Text>

                                        {item.isSwitch ? (
                                            <Switch
                                                value={notificationsEnabled}
                                                onValueChange={setNotificationsEnabled}
                                                trackColor={{ false: '#F2DFD7', true: '#E9D6CF' }}
                                                thumbColor={notificationsEnabled ? '#BF592B' : '#83746E'}
                                                ios_backgroundColor="#F2DFD7"
                                            />
                                        ) : item.isLogout ? (
                                            <TouchableOpacity onPress={item.action} className="p-1">
                                                <ChevronRight size={18} color="#DC2626" />
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity onPress={item.action} className="p-1">
                                                <ChevronRight size={18} color="#BF592B" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* Adinkra Footer */}
                    <View className="items-center justify-center py-8">
                        <Svg width={48} height={48} viewBox="0 0 100 100" fill="none">
                            <Circle cx="50" cy="50" r="10" stroke="#BF592B" strokeWidth="4" />
                            <Path 
                                d="M 50 15 C 60 15, 65 30, 50 40 C 35 30, 40 15, 50 15 Z" 
                                stroke="#BF592B" 
                                strokeWidth="4" 
                            />
                            <Path 
                                d="M 50 85 C 60 85, 65 70, 50 60 C 35 70, 40 85, 50 85 Z" 
                                stroke="#BF592B" 
                                strokeWidth="4" 
                            />
                            <Path 
                                d="M 15 50 C 15 60, 30 65, 40 50 C 30 35, 15 40, 15 50 Z" 
                                stroke="#BF592B" 
                                strokeWidth="4" 
                            />
                            <Path 
                                d="M 85 50 C 85 60, 70 65, 60 50 C 70 35, 85 40, 85 50 Z" 
                                stroke="#BF592B" 
                                strokeWidth="4" 
                            />
                            <Circle cx="50" cy="50" r="28" stroke="#BF592B" strokeWidth="4" strokeDasharray="10 6" />
                        </Svg>
                        <Text className="text-[#83746E]/50 text-[10px] font-sans-medium tracking-widest mt-2 uppercase">
                            BI NKA BI • UNITY & PEACE
                        </Text>
                        <Text className="text-[#83746E]/40 text-[9px] font-sans mt-1">Version 1.0.0</Text>
                    </View>
                </ScrollView>
            </View>

            {switchingMode && (
                <Animated.View 
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(57, 46, 41, 0.4)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 99999,
                    }}
                >
                    <View className="items-center p-6 rounded-3xl bg-[#BF592B] border border-[#D65A31] shadow-2xl max-w-[70%]">
                        <View style={{ justifyContent: 'center', alignItems: 'center', width: 110, height: 110, marginBottom: 4 }}>
                            {/* Spinning Dashed Ring */}
                            <Animated.View
                                style={{
                                    position: 'absolute',
                                    width: 90,
                                    height: 90,
                                    borderRadius: 45,
                                    borderWidth: 2,
                                    borderColor: 'rgba(255, 255, 255, 0.4)',
                                    borderStyle: 'dashed',
                                    transform: [{ rotate: spin }],
                                }}
                            />
                            {/* Pulsing Inner Circle */}
                            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                <View className="bg-white rounded-full items-center justify-center border-4 border-white/20 shadow-xl" style={{ width: 76, height: 76, borderRadius: 38, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12 }}>
                                    {(function() {
                                        const IconComponent = LOADER_ICONS[loaderIconIndex] || Utensils;
                                        return <IconComponent size={32} color="#BF592B" />;
                                    })()}
                                </View>
                            </Animated.View>
                        </View>
                        
                        <ActivityIndicator size="small" color="#FFFFFF" className="mb-3" />
                        
                        <Text className="text-2xl font-bold text-white text-center font-serif tracking-wide" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                            YɛnDidii
                        </Text>
                        <Text className="text-xs text-white/80 text-center font-sans mt-2 px-3 leading-4">
                            {isCookMode ? 'Switching to Eating Mode...' : 'Switching to Kitchen Mode...'}
                        </Text>
                    </View>
                </Animated.View>
            )}

            <ProcessLoader 
                visible={refreshing} 
                message="Refreshing Profile..."
            />
        </SafeAreaView>
    );
}
