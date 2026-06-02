import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, LogOut, ChevronRight, User, Phone, ShieldCheck, ChefHat, RefreshCw, MapPin, Clock, Utensils, Calendar, Navigation, X, Check, Camera } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function ProfileScreen() {
    const router = useRouter();
    const { isCookMode, toggleCookMode } = useAppStore();

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
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#D65A31" />
            </View>
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

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
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
                                className="bg-clay-primary/10 rounded-xl px-3 items-center justify-center border border-clay-primary/20"
                            >
                                {locationFetching
                                    ? <ActivityIndicator size="small" color="#D65A31" />
                                    : <Navigation size={20} color="#D65A31" />}
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            onPress={saveLocation}
                            disabled={locationSaving}
                            className="bg-clay-primary rounded-2xl py-4 flex-row items-center justify-center gap-2"
                            style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                        >
                            {locationSaving
                                ? <ActivityIndicator size="small" color="white" />
                                : <><Check size={18} color="white" /><Text className="text-white font-bold font-sans-bold">Save Location</Text></>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <View className="flex-1 bg-warm-cream">
            <View className="flex-1">
                {/* Header */}
                <View className="px-6 pt-3 pb-4 flex-row justify-between items-center bg-white border-b border-gray-100">
                    <View>
                        <Text className="text-xl font-bold text-text-main font-sans-bold">
                            {isCookMode ? 'Chef Profile' : 'My Profile'}
                        </Text>
                        <Text className="text-sm text-text-sub font-sans">Manage your account and settings</Text>
                    </View>
                </View>

                <ScrollView 
                    className="flex-1" 
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D65A31" colors={["#D65A31"]} />
                    }
                >
                    {/* Profile Card */}
                    <View className="m-6 bg-white p-6 rounded-3xl shadow-sm">
                        <View className="flex-row items-center gap-4 mb-6">
                            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} className="relative">
                                <View className="w-20 h-20 bg-gray-100 rounded-full overflow-hidden border-2 border-white shadow-sm">
                                    {avatarUploading ? (
                                        <View className="w-full h-full items-center justify-center bg-gray-100">
                                            <ActivityIndicator size="small" color="#D65A31" />
                                        </View>
                                    ) : profile.avatar_url ? (
                                        <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                                    ) : (
                                        <View className="w-full h-full items-center justify-center bg-clay-primary/10">
                                            <User size={32} color="#D65A31" />
                                        </View>
                                    )}
                                </View>
                                <View className="absolute bottom-0 right-0 w-7 h-7 bg-clay-primary rounded-full items-center justify-center border-2 border-white">
                                    <Camera size={14} color="white" />
                                </View>
                            </TouchableOpacity>
                            <View className="flex-1">
                                <Text className="text-xl font-bold text-text-main font-sans-bold">{profile.full_name || 'Foodie'}</Text>
                                <Text className="text-text-sub text-sm font-sans mb-1">{profile.phone || 'No phone'}</Text>

                                {/* Location Row */}
                                <TouchableOpacity
                                    className="flex-row items-center gap-1.5 mb-1"
                                    onPress={() => { setLocationDraft(profile.location || ''); setLocationEdit(true); }}
                                >
                                    <MapPin size={12} color="#D65A31" />
                                    <Text className="text-xs text-clay-primary font-sans" numberOfLines={1}>
                                        {profile.location || 'Tap to set your location'}
                                    </Text>
                                </TouchableOpacity>

                                <View className={`flex-row items-center gap-1 self-start px-2 py-0.5 rounded-md ${isCookMode ? 'bg-kente-yellow/20' : 'bg-green-50'}`}>
                                    {isCookMode ? <ChefHat size={12} color="#D65A31" /> : <ShieldCheck size={12} color="#007A33" />}
                                    <Text className={`text-xs font-medium font-sans ${isCookMode ? 'text-clay-primary' : 'text-kente-green'}`}>
                                        {isCookMode ? 'Cooking' : 'Eating'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Stats */}
                        <View className="flex-row border-t border-gray-100 pt-6">
                            <View className="flex-1 items-center border-r border-gray-100">
                                <Text className="text-2xl font-bold text-text-main font-sans-bold">{stats.orders}</Text>
                                <Text className="text-xs text-text-sub font-sans">{isCookMode ? 'Sales' : 'Orders'}</Text>
                            </View>
                            <View className="flex-1 items-center border-r border-gray-100">
                                <Text className="text-2xl font-bold text-text-main font-sans-bold">{stats.reviews}</Text>
                                <Text className="text-xs text-text-sub font-sans">Reviews</Text>
                            </View>
                            <View className="flex-1 items-center">
                                <Text className="text-2xl font-bold text-text-main font-sans-bold">{stats.saved}</Text>
                                <Text className="text-xs text-text-sub font-sans">Saved</Text>
                            </View>
                        </View>
                    </View>

                    {/* COOK STATUS / SWITCH MODE BUTTON */}
                    {profile.role === 'COOK' && profile.cook_application_status === 'approved' ? (
                        <View>
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
                                <View className="mx-6 mb-4 bg-green-50 rounded-3xl p-5 border border-green-200 shadow-sm">
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

                            {/* Switch Mode Button */}
                            <TouchableOpacity
                                className="mx-6 mb-6 bg-white rounded-2xl p-4 shadow-sm flex-row items-center justify-between border border-gray-100 active:scale-98"
                                onPress={toggleCookMode}
                            >
                                <View className="flex-row items-center gap-4">
                                    <View className="w-12 h-12 rounded-full bg-gray-50 items-center justify-center">
                                        <RefreshCw size={24} color="#D65A31" />
                                    </View>
                                    <View>
                                        <Text className="font-bold text-text-main text-lg font-sans-bold">
                                            {isCookMode ? 'Switch to Eating' : 'Switch to Kitchen Mode'}
                                        </Text>
                                        <Text className="text-text-sub text-xs font-sans">
                                            {isCookMode ? 'Go back to finding food' : 'Manage your menu & orders'}
                                        </Text>
                                    </View>
                                </View>
                                <ChevronRight size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>
                    ) : profile.cook_application_status === 'pending' ? (
                        <View className="mx-6 mb-6 bg-white rounded-3xl p-5 border border-gray-100 shadow-sm" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            <View className="flex-row items-center justify-between mb-4 border-b border-gray-100 pb-4">
                                <View>
                                    <Text className="font-bold text-text-main text-lg font-sans-bold">Kitchen Profile</Text>
                                    <Text className="text-text-sub text-xs font-sans">Waitlist preview</Text>
                                </View>
                                <View className="bg-orange-50 px-3 py-1.5 rounded-full flex-row items-center gap-1.5 border border-orange-100">
                                    <Clock size={12} color="#D65A31" />
                                    <Text className="text-clay-primary text-xs font-sans-semibold">Under Review</Text>
                                </View>
                            </View>

                            <View className="gap-4">
                                <View className="flex-row items-start gap-3">
                                    <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center mt-0.5">
                                        <ChefHat size={20} color="#D65A31" />
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
                                            {pendingApp?.cooking_frequency?.replace('_', ' ') || '...'} • Up to {pendingApp?.max_session_capacity || '-'} guests
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ) : profile.cook_application_status === 'approved' && !isCookMode ? (
                        <TouchableOpacity
                            className="mx-6 mb-6 bg-green-50 rounded-2xl p-4 border border-green-100 flex-row items-center justify-between active:scale-98"
                            onPress={toggleCookMode}
                        >
                            <View className="flex-row items-center gap-4 flex-1">
                                <View className="w-12 h-12 rounded-full bg-white items-center justify-center">
                                    <ChefHat size={22} color="#007A33" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-bold text-green-800 text-base font-sans-bold">You're a Cook! 🍳</Text>
                                    <Text className="text-green-600 text-xs font-sans">Switch to Kitchen Mode to manage dishes</Text>
                                </View>
                            </View>
                            <RefreshCw size={18} color="#007A33" />
                        </TouchableOpacity>
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
                            onPress={toggleCookMode}
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-12 h-12 rounded-full bg-gray-50 items-center justify-center">
                                    <RefreshCw size={24} color="#D65A31" />
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
                            <ChevronRight size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}

                    {/* Menu Items */}
                    <View className="mx-6 bg-white rounded-3xl overflow-hidden shadow-sm mb-6">
                        <TouchableOpacity
                            className="flex-row items-center justify-between p-4 border-b border-gray-100 active:bg-gray-50"
                            onPress={() => Alert.alert('Edit Profile', 'Profile editing will be available soon.')}
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 bg-orange-50 rounded-full items-center justify-center">
                                    <User size={20} color="#D65A31" />
                                </View>
                                <Text className="text-text-main font-medium font-sans-medium">Edit Profile</Text>
                            </View>
                            <ChevronRight size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        {profile.role === 'COOK' && profile.cook_application_status === 'approved' && isCookMode && (
                            <TouchableOpacity
                                className="flex-row items-center justify-between p-4 border-b border-gray-100 active:bg-gray-50"
                                onPress={() => router.push('/kitchen-settings')}
                            >
                                <View className="flex-row items-center gap-3">
                                    <View className="w-10 h-10 bg-kente-yellow/20 rounded-full items-center justify-center">
                                        <ChefHat size={20} color="#D65A31" />
                                    </View>
                                    <Text className="text-text-main font-medium font-sans-medium">Kitchen Settings</Text>
                                </View>
                                <ChevronRight size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            className="flex-row items-center justify-between p-4 border-b border-gray-100 active:bg-gray-50"
                            onPress={() => router.push('/address')}
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center">
                                    <MapPin size={20} color="#007A33" />
                                </View>
                                <Text className="text-text-main font-medium font-sans-medium">My Addresses</Text>
                            </View>
                            <ChevronRight size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="flex-row items-center justify-between p-4 border-b border-gray-100 active:bg-gray-50"
                            onPress={() => Alert.alert('Help & Support', 'Please contact support@yendidii.com for assistance.')}
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center">
                                    <Phone size={20} color="#0066CC" />
                                </View>
                                <Text className="text-text-main font-medium font-sans-medium">Help & Support</Text>
                            </View>
                            <ChevronRight size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="flex-row items-center justify-between p-4 active:bg-red-50"
                            onPress={handleSignOut}
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center">
                                    <LogOut size={20} color="#DC2626" />
                                </View>
                                <Text className="text-red-600 font-medium font-sans-medium">Sign Out</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-center text-xs text-gray-400 mb-8 font-sans">Version 1.0.0</Text>
                </ScrollView>
            </View>
        </View>
    </SafeAreaView>
);
}
