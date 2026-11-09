import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, TextInput, Modal, Switch, Animated, Linking, AppState, LayoutAnimation } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, ChevronUp, Settings, LogOut, ChevronRight, User, Phone, ShieldCheck, ChefHat, RefreshCw, MapPin, Clock, Utensils, Calendar, Navigation, X, Check, Camera, Menu, Search, Star, Gem, Crown, CreditCard, Bell, Soup, Fish, Flame, Wallet } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useRouter, useFocusEffect } from 'expo-router';
import TasteProfileCard from '@/components/TasteProfileCard';
import { loadPreferences, GuestPreferences } from '@/lib/preferencesOnboarding';
import { PRIVATE_QUESTION_ID, GUEST_QUESTIONS } from '@/constants/guestQuestions';
import { Sparkles } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import ProcessLoader from '@/components/ProcessLoader';
import ChefHatBadge from '@/components/ChefHatBadge';
import KitchenPotIcon from '@/components/KitchenPotIcon';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { decode } from 'base64-arraybuffer';
import { getDishImage } from '@/constants/Images';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { palette } from '@/constants/theme';

const FAVORITES_KEY = 'yendidii_favorites';

// 1 point per ₵1 spent on a Completed order (awarded server-side via a
// trigger on `orders` — see supabase/migrations/20261027140000_add_loyalty_points.sql).
const LOYALTY_TIERS = [
    { key: 'root', label: 'Root', min: 0 },
    { key: 'sankofa', label: 'Sankofa', min: 500 },
    { key: 'nyame', label: 'Nyame', min: 1500 },
    { key: 'ohene', label: 'Ohene', min: 3000 },
];

const getTierInfo = (points: number) => {
    let currentIndex = 0;
    for (let i = LOYALTY_TIERS.length - 1; i >= 0; i--) {
        if (points >= LOYALTY_TIERS[i].min) { currentIndex = i; break; }
    }
    const current = LOYALTY_TIERS[currentIndex];
    const next = LOYALTY_TIERS[currentIndex + 1] || null;
    const progress = next ? Math.min(100, Math.round(((points - current.min) / (next.min - current.min)) * 100)) : 100;
    const pointsToNext = next ? next.min - points : 0;
    return { current, next, progress, pointsToNext, currentIndex };
};

// How much of the rewards card shows while it's collapsed.
const REWARDS_PEEK_HEIGHT = 84;

// The profile and settings page. `showBack` adds a back arrow, for when it opens as its own screen (Kitchen Mode's avatar).
export default function ProfileScreen({ showBack = false }: { showBack?: boolean }) {
    const router = useRouter();
    const { isCookMode, toggleCookMode } = useAppStore();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    // Collapsible sections: the activity counts and the rewards card. Both start collapsed to keep the page short.
    const [showStats, setShowStats] = useState(false);
    const [showRewards, setShowRewards] = useState(false);
    const [showKitchen, setShowKitchen] = useState(false);
    const toggleSection = (set: React.Dispatch<React.SetStateAction<boolean>>) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        set((v) => !v);
    };
    // The guest's own sign-up answers (public taste + private dietary), refreshed whenever this tab is shown.
    const [prefs, setPrefs] = useState<GuestPreferences>({});
    useFocusEffect(React.useCallback(() => {
        loadPreferences().then(setPrefs);
        // The tab stays mounted, so refresh the "Watching" count from the saved list each time this tab is shown.
        AsyncStorage.getItem(FAVORITES_KEY).then((raw) => {
            const count = raw ? JSON.parse(raw).length : 0;
            setStats((prev) => ({ ...prev, saved: count }));
        }).catch(() => {});
    }, []));
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState({ orders: 0, reviews: 0, saved: 0 });
    const [pendingApp, setPendingApp] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [locationEdit, setLocationEdit] = useState(false);
    const [locationDraft, setLocationDraft] = useState('');
    const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationFetching, setLocationFetching] = useState(false);
    const [locationSaving, setLocationSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);
    const [copied, setCopied] = useState(false);
    const flipAnimation = React.useRef(new Animated.Value(0)).current;

    const skeletonOpacity = React.useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        let anim: Animated.CompositeAnimation;
        if (loading) {
            anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(skeletonOpacity, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(skeletonOpacity, {
                        toValue: 0.6,
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
            // After switching modes, always land on the Home tab first.
            router.replace('/(tabs)');
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

    // Reflect the real OS permission, not a fake toggle — check on mount and
    // whenever the app comes back to the foreground (e.g. after the user
    // flips it in iOS Settings, since apps can't revoke permission directly).
    useEffect(() => {
        const syncPermission = () => {
            Notifications.getPermissionsAsync().then(({ status }) => {
                setNotificationsEnabled(status === 'granted');
            });
        };
        syncPermission();
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') syncPermission();
        });
        return () => sub.remove();
    }, []);

    const handleToggleNotifications = async (value: boolean) => {
        if (value) {
            await registerForPushNotificationsAsync();
            const { status } = await Notifications.getPermissionsAsync();
            if (status === 'granted') {
                setNotificationsEnabled(true);
            } else {
                // Permission was denied previously — iOS won't re-prompt, so
                // the only way back in is the system Settings app.
                Alert.alert(
                    'Notifications Disabled',
                    'Enable notifications for Yendidii in your phone Settings to get order and kitchen alerts.',
                    [{ text: 'Open Settings', onPress: () => Linking.openSettings() }, { text: 'Cancel', style: 'cancel' }]
                );
            }
        } else {
            Linking.openSettings();
        }
    };

    async function getProfile() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // These four are all independent of each other — fire them together
            // instead of awaiting one at a time, which was the main reason this
            // screen felt slow to load (4-5 sequential round-trips back to back).
            const [profileResult, ordersResult, reviewsResult, savedRaw] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).single(),
                supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                AsyncStorage.getItem(FAVORITES_KEY),
            ]);

            if (profileResult.error) throw profileResult.error;
            const data = profileResult.data;
            setProfile(data);

            const savedIds: string[] = savedRaw ? JSON.parse(savedRaw) : [];
            setStats({
                orders: ordersResult.error ? 0 : (ordersResult.count || 0),
                reviews: reviewsResult.error ? 0 : (reviewsResult.count || 0),
                saved: savedIds.length,
            });

            // This one genuinely depends on the profile result above, so it has
            // to stay sequential — but it's now the only extra round-trip.
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
            console.error('Error fetching profile:', error.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSignOut() {
        const { error } = await supabase.auth.signOut();
        if (error) Alert.alert('Error', error.message);
        router.replace('/onboarding/community');
    }

    function confirmSignOut() {
        Alert.alert(
            'Log out?',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: handleSignOut },
            ],
            { cancelable: true }
        );
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
            setLocationCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
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
            const { error } = await supabase.from('profiles').update({
                location: locationDraft,
                ...(locationCoords ? { latitude: locationCoords.latitude, longitude: locationCoords.longitude } : {}),
            }).eq('id', user.id);
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
            <SafeAreaView className="flex-1 bg-brand-canvas" edges={['top', 'bottom']}>
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {/* Welcome Row Skeleton */}
                    <View style={{ paddingTop: 16 }} className="px-6 pb-4 flex-row items-center gap-4">
                        <Animated.View style={{ opacity: skeletonOpacity }} className="w-20 h-20 bg-brand-skeleton rounded-full border-2 border-white shadow-sm" />
                        <View className="flex-1">
                            <Animated.View style={{ opacity: skeletonOpacity }} className="h-6 w-40 bg-brand-skeleton rounded-md mb-2" />
                            <Animated.View style={{ opacity: skeletonOpacity }} className="h-4 w-32 bg-brand-skeleton rounded-md" />
                        </View>
                    </View>

                    {/* Stats Row Skeleton */}
                    <View className="flex-row justify-around bg-brand-surface border border-[#F2DFD7] mx-6 mb-6 py-4 rounded-2xl">
                        {[1, 2, 3].map((i) => (
                            <View key={i} className="items-center flex-1" style={i < 3 ? { borderRightWidth: 1, borderRightColor: '#F2DFD7' } : {}}>
                                <Animated.View style={{ opacity: skeletonOpacity }} className="h-5 w-10 bg-brand-skeleton rounded mb-1.5" />
                                <Animated.View style={{ opacity: skeletonOpacity }} className="h-3 w-16 bg-brand-skeleton rounded" />
                            </View>
                        ))}
                    </View>

                    {/* Switch Mode Card Skeleton */}
                    <View className="px-6 mb-6">
                        <Animated.View 
                            style={{ opacity: skeletonOpacity }} 
                            className="bg-brand-surface border border-[#F2DFD7] rounded-2xl p-4 h-20 flex-row items-center justify-between"
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-12 h-12 rounded-full bg-brand-skeleton" />
                                <View className="gap-1.5">
                                    <View className="h-4 w-28 bg-brand-skeleton rounded" />
                                    <View className="h-3 w-44 bg-brand-skeleton rounded" />
                                </View>
                            </View>
                            <View className="w-10 h-6 bg-brand-skeleton rounded-full" />
                        </Animated.View>
                    </View>

                    {/* Rewards & Discounts Card Skeleton */}
                    <View className="mb-6">
                        <View className="flex-row justify-between items-end px-6 mb-3">
                            <Animated.View style={{ opacity: skeletonOpacity }} className="h-5 w-44 bg-brand-skeleton rounded" />
                            <Animated.View style={{ opacity: skeletonOpacity }} className="h-4 w-24 bg-brand-skeleton rounded" />
                        </View>
                        <Animated.View 
                            style={{ opacity: skeletonOpacity }} 
                            className="mx-6 h-64 bg-brand-skeleton rounded-3xl shadow-sm"
                        />
                    </View>

                    {/* Account Settings Section Skeleton */}
                    <View className="mb-6">
                        <View className="px-6 mb-3">
                            <Animated.View style={{ opacity: skeletonOpacity }} className="h-5 w-36 bg-brand-skeleton rounded" />
                        </View>
                        <View className="px-6 gap-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Animated.View 
                                    key={i} 
                                    style={{ opacity: skeletonOpacity }} 
                                    className="flex-row items-center bg-brand-surface p-3 rounded-2xl border border-[#F2DFD7] h-14"
                                >
                                    <View className="w-10 h-10 bg-brand-skeleton rounded-xl mr-3" />
                                    <View className="flex-1 h-4 bg-brand-skeleton rounded" />
                                    <View className="w-4 h-4 bg-brand-skeleton rounded-full" />
                                </Animated.View>
                            ))}
                        </View>
                    </View>

                    {/* Adinkra Footer Skeleton */}
                    <View className="items-center justify-center py-8">
                        <Animated.View style={{ opacity: skeletonOpacity }} className="w-12 h-12 bg-brand-skeleton rounded-full mb-3" />
                        <Animated.View style={{ opacity: skeletonOpacity }} className="h-3 w-40 bg-brand-skeleton rounded" />
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (!profile) {
        return (
            <SafeAreaView className="flex-1 bg-brand-surface items-center justify-center p-6" edges={['top']}>
                <View className="flex-1 bg-brand-canvas items-center justify-center w-full">
                <Text className="text-section font-bold text-brand-ink mb-4 font-sans-bold">Not Logged In</Text>
                <TouchableOpacity
                    className="bg-clay-primary px-8 py-3 rounded-xl"
                    onPress={() => router.replace('/onboarding/community')}
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
            action: () => router.push('/personal-information')
        },
        ...(profile.role === 'COOK' && profile.cook_application_status === 'approved' && isCookMode ? [{
            id: 'kitchen-settings',
            title: 'Kitchen Settings',
            icon: KitchenPotIcon,
            action: () => router.push('/kitchen-settings')
        }] : []),
        {
            id: 'address',
            title: 'My Location',
            icon: MapPin,
            action: () => router.push('/address')
        },
        {
            id: 'payment',
            title: isCookMode ? 'Earnings & Payouts' : 'Payment Methods',
            icon: isCookMode ? Wallet : CreditCard,
            action: () => router.push('/payment-methods')
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
            action: () => router.push('/privacy-security')
        },
        {
            id: 'logout',
            title: 'Logout',
            icon: LogOut,
            isLogout: true,
            action: confirmSignOut
        }
    ];

    // tile colour, tint and a short hint for each settings row
    const ITEM_LOOK: Record<string, { tile: string; tint: string; sub: string }> = {
        personal: { tile: '#FFF7F2', tint: '#B85226', sub: 'Name, phone and email' },
        'kitchen-settings': { tile: '#FFFBEB', tint: '#B45309', sub: 'Kitchen details and location' },
        address: { tile: '#FFF7ED', tint: '#EA580C', sub: profile.location || 'Where you are' },
        payment: { tile: '#ECFDF5', tint: '#047857', sub: isCookMode ? 'Your earnings and payouts' : 'Cards and mobile money' },
        notifications: { tile: '#FFF7F2', tint: '#B85226', sub: notificationsEnabled ? 'Push alerts are on' : 'Push alerts are off' },
        privacy: { tile: '#F4F4F5', tint: '#52372A', sub: 'Security and data controls' },
    };

    return (
        <SafeAreaView className="flex-1 bg-brand-canvas" edges={['bottom']}>
            {/* Location Edit Modal */}
            <Modal visible={locationEdit} transparent animationType="slide" onRequestClose={() => setLocationEdit(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        activeOpacity={1}
                        onPress={() => setLocationEdit(false)}
                    />
                    <View className="bg-brand-surface rounded-t-3xl p-6">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-card font-bold text-brand-ink font-sans-bold">Set Your Location</Text>
                            <TouchableOpacity onPress={() => setLocationEdit(false)}>
                                <X size={22} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <Text className="text-body text-brand-muted font-sans mb-3">
                            This helps cooks and eaters know where you are. Cooks: this shows on your listings.
                        </Text>
                        <View className="flex-row gap-2 mb-4">
                            <TextInput
                                placeholder="e.g. East Legon, Accra"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-brand-ink font-sans text-card border border-gray-100"
                                value={locationDraft}
                                onChangeText={(text) => { setLocationDraft(text); setLocationCoords(null); }}
                                autoFocus
                            />
                            <TouchableOpacity
                                onPress={useCurrentLocation}
                                disabled={locationFetching}
                                className="bg-[#FFF1EC] rounded-xl px-3 items-center justify-center border border-[#F2DFD7]"
                            >
                                {locationFetching
                                    ? <ActivityIndicator size="small" color={palette.accent} />
                                    : <Navigation size={20} color={palette.accent} />}
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            onPress={saveLocation}
                            disabled={locationSaving}
                            className="bg-clay-primary rounded-2xl py-4 flex-row items-center justify-center gap-2"
                            style={{ shadowColor: palette.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                        >
                            {locationSaving
                                ? <ActivityIndicator size="small" color="white" />
                                : <><Check size={18} color="white" /><Text className="text-white font-bold font-sans-bold">Save Location</Text></>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <View className="flex-1 bg-brand-canvas">
                <ScrollView 
                    className="flex-1" 
                    showsVerticalScrollIndicator={false}
                    // the tab bar floats over the page, so leave room under the footer; the avatar-opened screen has no tab bar
                    contentContainerStyle={{ paddingBottom: showBack ? 0 : 56 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} colors={[palette.accent]} />
                    }
                >
                    {showBack && (
                        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
                            <TouchableOpacity
                                onPress={() => router.back()}
                                accessibilityLabel="Back"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                className="w-10 h-10 items-center justify-center -ml-2"
                            >
                                <ArrowLeft size={24} color="#2D241E" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Profile card */}
                    <View style={{ marginHorizontal: 20, marginTop: showBack ? 16 : insets.top + 16, marginBottom: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2DFD5', shadowColor: '#B85226', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }}>
                        <View style={{ borderRadius: 24, overflow: 'hidden', padding: 17, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View pointerEvents="none" style={{ position: 'absolute', top: -34, right: -30, width: 112, height: 112, borderRadius: 56, backgroundColor: '#FFEDE5', opacity: 0.7 }} />
                            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} accessibilityLabel="Change profile photo">
                                <LinearGradient
                                    colors={['#B85226', '#EE9272', '#FCD34D']}
                                    start={{ x: 0, y: 1 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{ width: 72, height: 72, borderRadius: 36, padding: 3 }}
                                >
                                    <View style={{ flex: 1, borderRadius: 33, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#FFEDE5', overflow: 'hidden' }}>
                                        {avatarUploading ? (
                                            <View className="w-full h-full items-center justify-center">
                                                <ActivityIndicator size="small" color={palette.accent} />
                                            </View>
                                        ) : profile.avatar_url ? (
                                            <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                                        ) : (
                                            <View className="w-full h-full items-center justify-center">
                                                <User size={30} color={palette.accent} />
                                            </View>
                                        )}
                                    </View>
                                </LinearGradient>
                                <View style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#B85226', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                                    <Camera size={11} color="white" />
                                </View>
                            </TouchableOpacity>

                            <View className="flex-1">
                                <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFEDE5', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 }}>
                                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 0.8, color: '#943D1A', textTransform: 'uppercase' }}>
                                        {profile.role === 'COOK' && profile.cook_application_status === 'approved' ? 'Kitchen host' : 'Guest'}
                                    </Text>
                                </View>
                                <Text numberOfLines={2} style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, lineHeight: 24, color: palette.ink }}>
                                    Welcome Back, {profile.full_name?.split(' ')[0] || 'Kojo'}
                                </Text>

                                <TouchableOpacity
                                    className="flex-row items-center gap-1.5 mt-1.5"
                                    onPress={() => { setLocationDraft(profile.location || ''); setLocationCoords(null); setLocationEdit(true); }}
                                >
                                    <MapPin size={14} color="#D4693A" />
                                    <Text className="text-meta text-brand-muted font-sans flex-1" numberOfLines={1}>
                                        {profile.location || 'Greater Accra, Ghana'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
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
                                        <Text className="text-hero">🎉</Text>
                                        <View className="flex-1">
                                            <Text className="font-bold text-green-800 text-card font-sans-bold">You're Approved!</Text>
                                            <Text className="text-green-600 text-meta font-sans">Welcome to the YɛnDidii host community</Text>
                                        </View>
                                    </View>
                                    <Text className="text-green-700 text-body font-sans leading-5">
                                        Your kitchen has been verified. You can now host meal sessions to your community! Switch to Host Mode below to get started.
                                    </Text>
                                </View>
                            )}

                            {/* Switch Mode Card with Switch Component */}
                            <TouchableOpacity
                                activeOpacity={0.92}
                                onPress={handleToggleWithLoader}
                                accessibilityRole="switch"
                                accessibilityLabel="Host Mode"
                                accessibilityState={{ checked: isCookMode }}
                                style={{ borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2DFD5', paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#B85226', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }}
                            >
                                <View className="flex-row items-center flex-1" style={{ gap: 14 }}>
                                    <ChefHatBadge size={48} />
                                    <View className="flex-1">
                                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: palette.ink }}>Host Mode</Text>
                                        <View className="flex-row items-center" style={{ gap: 6, marginTop: 2 }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isCookMode ? '#10B981' : '#B89D8F' }} />
                                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#947261' }}>
                                                {isCookMode ? 'Now accepting new orders' : 'Switch on to accept new orders'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <Switch
                                    value={isCookMode}
                                    onValueChange={handleToggleWithLoader}
                                    trackColor={{ false: '#E3CFC7', true: '#B85226' }}
                                    thumbColor="#FFFFFF"
                                    ios_backgroundColor="#E3CFC7"
                                    pointerEvents="none"
                                />
                            </TouchableOpacity>
                        </View>
                    ) : profile.cook_application_status === 'pending' ? (
                        <View className="mx-6 mb-6 bg-brand-surface border border-[#F2DFD7] rounded-3xl p-5 shadow-sm">
                            {/* Tap to show or hide the application details; collapsed by default while it's still under review */}
                            <TouchableOpacity
                                onPress={() => toggleSection(setShowKitchen)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityState={{ expanded: showKitchen }}
                                className={`flex-row items-center justify-between ${showKitchen ? 'mb-4 border-b border-gray-100 pb-4' : ''}`}
                            >
                                <View className="flex-1 pr-3">
                                    <Text className="font-bold text-brand-ink text-card font-sans-bold">Kitchen Profile</Text>
                                    <Text className="text-brand-muted text-meta font-sans">{showKitchen ? 'Waitlist preview' : `${pendingApp?.kitchen_name || 'Your application'} · tap to view`}</Text>
                                </View>
                                <View className="flex-row items-center gap-2">
                                    <View className="bg-[#FFF1EC] px-3 py-1.5 rounded-full flex-row items-center gap-1.5 border border-[#F2DFD7]">
                                        <Clock size={12} color={palette.accent} />
                                        <Text className="text-clay-primary text-meta font-sans-semibold">Under Review</Text>
                                    </View>
                                    {showKitchen ? <ChevronUp size={20} color={palette.ink} /> : <ChevronDown size={20} color={palette.ink} />}
                                </View>
                            </TouchableOpacity>

                            {showKitchen && (
                            <View className="gap-4">
                                <View className="flex-row items-start gap-3">
                                    <View className="w-10 h-10 bg-[#FFF1EC] rounded-xl items-center justify-center mt-0.5">
                                        <ChefHat size={20} color={palette.accent} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-meta text-brand-muted font-sans uppercase tracking-wider mb-0.5">Kitchen Name</Text>
                                        <Text className="font-semibold text-brand-ink text-card font-sans mt-0.5">{pendingApp?.kitchen_name || 'Loading...'}</Text>
                                    </View>
                                </View>

                                <View className="flex-row items-start gap-3">
                                    <View className="w-10 h-10 bg-green-50 rounded-xl items-center justify-center mt-0.5">
                                        <Utensils size={20} color="#007A33" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-meta text-brand-muted font-sans uppercase tracking-wider mb-0.5">Specialties</Text>
                                        <View className="flex-row flex-wrap gap-1 mt-1">
                                            {pendingApp?.specialties?.map((spec: string, i: number) => (
                                                <View key={i} className="bg-gray-100 px-2 py-1 rounded-md">
                                                    <Text className="text-brand-ink text-meta font-sans">{spec}</Text>
                                                </View>
                                            )) || <Text className="text-brand-ink text-body font-sans mt-0.5">...</Text>}
                                        </View>
                                    </View>
                                </View>

                                <View className="flex-row items-start gap-3">
                                    <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mt-0.5">
                                        <Calendar size={20} color="#0066CC" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-meta text-brand-muted font-sans uppercase tracking-wider mb-0.5">Hosting Plan</Text>
                                        <Text className="text-brand-ink text-body font-sans mt-0.5 capitalize">
                                            {pendingApp?.cooking_frequency?.replace('_', ' ') || '...'} • {pendingApp?.max_session_capacity || '-'} guests
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            )}
                        </View>
                    ) : profile.cook_application_status === 'rejected' ? (
                        <TouchableOpacity
                            className="mx-6 mb-6 bg-red-50 rounded-2xl p-4 border border-red-100 flex-row items-center justify-between active:scale-98"
                            onPress={() => router.push('/onboarding/apply-to-cook')}
                        >
                            <View className="flex-row items-center gap-4 flex-1">
                                <View className="w-12 h-12 rounded-full bg-brand-surface items-center justify-center">
                                    <Settings size={22} color="#DC2626" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-bold text-red-600 text-card font-sans-bold">Application Rejected</Text>
                                    <Text className="text-red-600/70 text-meta font-sans" numberOfLines={1}>
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
                                <View className="w-12 h-12 rounded-full bg-brand-surface/20 items-center justify-center">
                                    <ChefHat size={24} color="white" />
                                </View>
                                <View>
                                    <Text className="font-bold text-white text-card font-sans-bold">Apply to Host</Text>
                                    <Text className="text-white/80 text-meta font-sans">Share your meals & earn from your kitchen</Text>
                                </View>
                            </View>
                            <ChevronRight size={20} color="white" />
                        </TouchableOpacity>
                    )}

                    {/* Show Switch to Eating for non-approved users stuck in cook mode */}
                    {isCookMode && !(profile.role === 'COOK' && profile.cook_application_status === 'approved') && (
                        <TouchableOpacity
                            className="mx-6 mb-6 bg-brand-surface rounded-2xl p-4 shadow-sm flex-row items-center justify-between border border-gray-100 active:scale-98"
                            onPress={handleToggleWithLoader}
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-12 h-12 rounded-full bg-gray-50 items-center justify-center">
                                    <RefreshCw size={24} color={palette.accent} />
                                </View>
                                <View>
                                    <Text className="font-bold text-brand-ink text-card font-sans-bold">
                                        Switch to Eating
                                    </Text>
                                    <Text className="text-brand-muted text-meta font-sans">
                                        Go back to finding food
                                    </Text>
                                </View>
                            </View>
                            <ChevronRight size={20} color={palette.accent} />
                        </TouchableOpacity>
                    )}

                    {/* Rewards & Discounts Section */}
                    {!isCookMode && (() => {
                        const tierInfo = getTierInfo(profile.loyalty_points || 0);
                        return (
                        <View className="mb-6">
                            <View className="flex-row justify-between items-end px-6 mb-3">
                                <TouchableOpacity onPress={() => toggleSection(setShowRewards)} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ expanded: showRewards }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="flex-row items-center gap-1.5">
                                    <Text className="text-card font-bold text-brand-ink font-sans-bold">
                                        Rewards & Discounts
                                    </Text>
                                    {showRewards ? <ChevronUp size={18} color={palette.ink} /> : <ChevronDown size={18} color={palette.ink} />}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => Alert.alert(
                                    'Benefits',
                                    `Earn 1 point per ₵1 spent. Root (0+), Sankofa (500+), Nyame (1,500+), Ohene (3,000+). Flip your card for a reward code.`
                                )}>
                                    <Text className="text-body font-semibold text-clay-primary font-sans-semibold">
                                        View Benefits
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Flidable Card Container */}
                            {/* Closed: only the top of the card peeks out, fading into the page. Open: the whole card, tap to flip. */}
                            <View className="mx-6" style={{ height: showRewards ? 256 : REWARDS_PEEK_HEIGHT, overflow: 'hidden', borderRadius: 24 }}>
                            <TouchableOpacity 
                                activeOpacity={0.95} 
                                onPress={showRewards ? toggleFlip : () => toggleSection(setShowRewards)}
                                className="h-64"
                                accessibilityLabel={showRewards ? 'Reward card. Tap to flip' : 'Show reward card'}
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
                                            <Text className="text-micro font-bold text-white/70 uppercase tracking-widest">
                                                Current Status
                                            </Text>
                                            <Text className="text-hero font-bold text-white font-serif mt-0.5" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                                                {tierInfo.current.label} Tier
                                            </Text>
                                        </View>
                                        <View className="bg-brand-surface rounded-full px-3 py-1.5 flex-row items-center gap-1">
                                            <Star size={12} color={palette.accent} fill={palette.accent} />
                                            <Text className="text-clay-primary text-meta font-bold font-sans-bold">
                                                {(profile.loyalty_points || 0).toLocaleString()} pts
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="mt-2">
                                        <View className="h-2 bg-brand-surface/20 rounded-full overflow-hidden">
                                            <View style={{ width: `${tierInfo.progress}%` }} className="h-full bg-green-400 rounded-full" />
                                        </View>
                                        <View className="flex-row justify-between items-center mt-2">
                                            <Text className="text-micro text-white/80 font-sans">
                                                {tierInfo.next ? `${tierInfo.pointsToNext} pts to Next Tier` : 'Highest Tier Reached'}
                                            </Text>
                                            <Text className="text-micro text-white/80 font-sans">
                                                {tierInfo.next ? `${tierInfo.next.label} Tier Milestone` : '🎉'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="flex-row justify-between items-center relative px-1 mt-4">
                                        <View className="absolute left-6 right-6 top-[20px] h-[1px] bg-brand-surface/20" />
                                        <View style={{ position: 'absolute', left: 24, width: `${(tierInfo.currentIndex / (LOYALTY_TIERS.length - 1)) * 100}%`, top: 20, height: 1 }} className="bg-green-400" />

                                        {LOYALTY_TIERS.map((tier, index) => {
                                            const done = index < tierInfo.currentIndex;
                                            const active = index === tierInfo.currentIndex;
                                            return (
                                            <View key={tier.label} className="items-center z-10 flex-1">
                                                <View
                                                    className={`w-10 h-10 rounded-full border-2 items-center justify-center ${
                                                        active
                                                            ? 'bg-green-400 border-green-400'
                                                            : done
                                                                ? 'bg-clay-primary border-white'
                                                                : 'bg-clay-primary border-white/40'
                                                    }`}
                                                >
                                                    {active ? (
                                                        <View className="w-3.5 h-3.5 rounded-full bg-green-400 items-center justify-center">
                                                            <Check size={10} color="white" strokeWidth={4} />
                                                        </View>
                                                    ) : tier.label === 'Nyame' ? (
                                                        <Gem size={14} color={done ? 'white' : 'rgba(255,255,255,0.4)'} />
                                                    ) : tier.label === 'Ohene' ? (
                                                        <Crown size={14} color={done ? 'white' : 'rgba(255,255,255,0.4)'} />
                                                    ) : (
                                                        <View className="w-2.5 h-2.5 rounded-full bg-brand-surface" />
                                                    )}
                                                </View>
                                                <Text className={`text-micro mt-1.5 font-sans-medium ${active ? 'text-white font-bold' : 'text-white/60'}`}>
                                                    {tier.label}
                                                </Text>
                                            </View>
                                            );
                                        })}
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
                                            <Text className="text-micro font-bold text-white/50 uppercase tracking-widest">
                                                Tier Reward
                                            </Text>
                                            <Text className="text-section font-bold text-white font-serif mt-0.5" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                                                Sankofa Discount Code
                                            </Text>
                                        </View>
                                        <View className="bg-clay-primary/20 border border-clay-primary/30 rounded-full px-3 py-1">
                                            <Text className="text-clay-primary text-meta font-bold font-sans-bold">
                                                20% OFF
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="items-center my-2">
                                        <TouchableOpacity 
                                            activeOpacity={0.8}
                                            onPress={(e) => { e.stopPropagation(); copyCode(); }}
                                            className="bg-brand-ink border border-dashed border-clay-primary rounded-2xl px-6 py-4 items-center justify-center w-full"
                                        >
                                            <Text className="text-hero font-bold text-white tracking-widest font-sans-bold">
                                                SANKOFA20
                                            </Text>
                                            <Text className="text-clay-primary text-meta font-sans-medium mt-1">
                                                {copied ? 'Copied to Clipboard! 📋' : 'Tap to Copy Code'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View className="flex-row justify-between items-center mt-2 border-t border-white/10 pt-3">
                                        <Text className="text-micro text-white/50 font-sans">
                                            * Valid on next meal session
                                        </Text>
                                        <Text className="text-micro text-clay-primary font-sans-medium">
                                            Tap card to flip back
                                        </Text>
                                    </View>
                                </Animated.View>
                            </TouchableOpacity>
                            {!showRewards && (
                                <LinearGradient
                                    pointerEvents="none"
                                    colors={['rgba(248,228,221,0)', palette.canvas]}
                                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 44 }}
                                />
                            )}
                            </View>
                        </View>
                        );
                    })()}



                    {/* Taste profile — the guest's public taste, plus their private dietary needs (only they and their hosts see those) */}
                    {!isCookMode && <TasteProfileCard prefs={prefs} />}

                    {/* Account Settings Section */}
                    <View style={{ marginBottom: 24 }}>
                        <View className="px-6" style={{ marginBottom: 10 }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, letterSpacing: 1.2, color: '#947261', textTransform: 'uppercase' }}>
                                Account Settings
                            </Text>
                        </View>

                        <View style={{ marginHorizontal: 20, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2DFD5', shadowColor: '#B85226', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }}>
                            <View style={{ borderRadius: 24, overflow: 'hidden' }}>
                                {SETTINGS_ITEMS.filter((item) => !item.isLogout).map((item, index) => {
                                    const Icon = item.icon;
                                    const look = ITEM_LOOK[item.id];
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            // the whole row is tappable; the notifications row toggles its switch
                                            onPress={item.isSwitch ? () => handleToggleNotifications(!notificationsEnabled) : item.action}
                                            activeOpacity={0.7}
                                            accessibilityRole={item.isSwitch ? 'switch' : 'button'}
                                            accessibilityLabel={item.title}
                                            accessibilityState={item.isSwitch ? { checked: notificationsEnabled } : undefined}
                                            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: 'rgba(242,223,213,0.7)' }}
                                        >
                                            <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: look?.tile ?? '#FFF7F2', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                                <Icon size={item.id === 'kitchen-settings' ? 22 : 20} color={look?.tint ?? palette.accent} />
                                            </View>

                                            <View className="flex-1 pr-2">
                                                <Text className="text-card font-sans-medium text-brand-ink">{item.title}</Text>
                                                {look?.sub ? <Text className="text-meta font-sans" style={{ color: '#947261', marginTop: 1 }} numberOfLines={1}>{look.sub}</Text> : null}
                                            </View>

                                            {item.isSwitch ? (
                                                <Switch
                                                    value={notificationsEnabled}
                                                    onValueChange={handleToggleNotifications}
                                                    trackColor={{ false: '#E3CFC7', true: '#B85226' }}
                                                    thumbColor="#FFFFFF"
                                                    ios_backgroundColor="#E3CFC7"
                                                />
                                            ) : (
                                                <ChevronRight size={18} color="#B89D8F" />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {SETTINGS_ITEMS.filter((item) => item.isLogout).map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                onPress={item.action}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={item.title}
                                style={{ marginHorizontal: 20, marginTop: 12, height: 48, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2DFD5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                <LogOut size={18} color="#DC2626" />
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#DC2626' }}>{item.title}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Adinkra footer: Gye Nyame, drawn as two hooked spirals around an S-shaped spine */}
                    <View className="items-center justify-center pt-2 pb-8">
                        <Svg width={56} height={56} viewBox="0 0 100 100" fill="none">
                            <Path d="M50 12 C 30 22 30 40 50 50 C 70 60 70 78 50 88" stroke={palette.accent} strokeWidth={5} strokeLinecap="round" />
                            <Path d="M50 12 C 36 7 21 13 21 26 C 21 35 30 37 34 32" stroke={palette.accent} strokeWidth={5} strokeLinecap="round" />
                            <Path d="M50 88 C 64 93 79 87 79 74 C 79 65 70 63 66 68" stroke={palette.accent} strokeWidth={5} strokeLinecap="round" />
                            <Path d="M46 31 C 56 22 71 25 73 35 C 74 42 67 44 63 40" stroke={palette.accent} strokeWidth={5} strokeLinecap="round" />
                            <Path d="M54 69 C 44 78 29 75 27 65 C 26 58 33 56 37 60" stroke={palette.accent} strokeWidth={5} strokeLinecap="round" />
                            <Circle cx="50" cy="50" r="3" fill={palette.accent} />
                        </Svg>
                        <Text className="text-brand-muted text-micro font-sans-medium tracking-widest mt-2 uppercase">
                            GYE NYAME • EXCEPT GOD
                        </Text>
                        <Text className="text-brand-muted text-micro font-sans mt-1">Version 1.0.0</Text>
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
                    <View className="items-center p-6 rounded-3xl bg-brand-accent border border-brand-accent shadow-2xl max-w-[70%]">
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
                                <View className="bg-brand-surface rounded-full items-center justify-center border-4 border-white/20 shadow-xl" style={{ width: 76, height: 76, borderRadius: 38, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12 }}>
                                    {(function() {
                                        const IconComponent = LOADER_ICONS[loaderIconIndex] || Utensils;
                                        return <IconComponent size={32} color={palette.accent} />;
                                    })()}
                                </View>
                            </Animated.View>
                        </View>
                        
                        <ActivityIndicator size="small" color="#FFFFFF" className="mb-3" />
                        
                        <Text className="text-hero font-bold text-white text-center font-serif tracking-wide" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                            YɛnDidii
                        </Text>
                        <Text className="text-meta text-white/80 text-center font-sans mt-2 px-3 leading-4">
                            {isCookMode ? 'Switching to Eating Mode...' : 'Switching to Host Mode...'}
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
