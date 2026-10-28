import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import LocationPicker from '@/components/LocationPicker';
import { supabase } from '@/lib/supabase';

export default function AddressScreen() {
    const router = useRouter();
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savedAddress, setSavedAddress] = useState<string | null>(null);
    const [loadingSaved, setLoadingSaved] = useState(true);
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [resolving, setResolving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data, error } = await supabase
                    .from('profiles')
                    .select('address, location')
                    .eq('id', user.id)
                    .single();
                if (!error && data) {
                    setSavedAddress(data.address || data.location || null);
                }
            } catch (e) {
                // Non-fatal — screen still works for setting a fresh address.
            } finally {
                setLoadingSaved(false);
            }
        })();
    }, []);

    const handleLocationPicked = async (pickedLocation: { lat: number; lng: number }) => {
        setLocation(pickedLocation);
        setResolving(true);
        setResolvedAddress(null);
        try {
            const [geo] = await Location.reverseGeocodeAsync({
                latitude: pickedLocation.lat,
                longitude: pickedLocation.lng,
            });
            if (geo) {
                const parts = [
                    geo.name || geo.street,
                    geo.district || geo.subregion,
                    geo.city || geo.region,
                ].filter(Boolean);
                setResolvedAddress(parts.join(', '));
            }
        } catch (e) {
            // Reverse geocoding can fail offline or in areas with no data —
            // saveAddressHandler falls back to raw coordinates in that case.
        } finally {
            setResolving(false);
        }
    };

    const saveAddressHandler = async () => {
        if (!location) {
            Alert.alert('No Location', 'Please pick a location on the map first.');
            return;
        }

        try {
            setIsSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            const finalAddress = resolvedAddress
                || `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}`;

            const { error } = await supabase
                .from('profiles')
                .update({
                    latitude: location.lat,
                    longitude: location.lng,
                    location: finalAddress,
                    address: finalAddress
                })
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert('Success', 'Address updated successfully!');
            router.back();

        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-warm-cream" edges={['top']}>
            {/* Header */}
            <View className="px-6 pt-3 pb-4 bg-surface border-b border-gray-100 flex-row items-center gap-3" style={{ zIndex: 100 }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center"
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                >
                    <ChevronLeft size={24} color="#2D241E" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-text-main font-sans-bold">Delivery Address</Text>
            </View>

            <ScrollView className="flex-1 p-6">
                {!loadingSaved && savedAddress && (
                    <View className="bg-[#FFF1EC] border border-[#F2DFD7] p-4 rounded-2xl mb-6 flex-row items-start gap-3">
                        <MapPin size={18} color="#BF592B" style={{ marginTop: 2 }} />
                        <View className="flex-1">
                            <Text className="text-xs text-clay-primary font-sans-bold mb-0.5">Current Address</Text>
                            <Text className="text-text-main font-sans">{savedAddress}</Text>
                        </View>
                    </View>
                )}

                <View className="bg-surface p-6 rounded-3xl shadow-sm mb-6">
                    <Text className="text-lg font-bold text-text-main mb-2 font-sans-bold">Set Location</Text>
                    <Text className="text-text-sub mb-6 font-sans">Tap the map or use your current location to set where you want your food delivered.</Text>

                    <LocationPicker onLocationPicked={handleLocationPicked} />

                    {location && (
                        <View className="flex-row items-center gap-2 mt-2 px-1">
                            {resolving ? (
                                <>
                                    <ActivityIndicator size="small" color="#BF592B" />
                                    <Text className="text-text-sub font-sans text-sm">Finding address…</Text>
                                </>
                            ) : (
                                <>
                                    <MapPin size={14} color="#BF592B" />
                                    <Text className="text-text-main font-sans text-sm flex-1" numberOfLines={2}>
                                        {resolvedAddress || `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}`}
                                    </Text>
                                </>
                            )}
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    className={`bg-clay-primary p-4 rounded-xl flex-row items-center justify-center gap-2 ${isSaving ? 'opacity-70' : ''}`}
                    onPress={saveAddressHandler}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <MapPin size={20} color="white" />
                            <Text className="text-white font-bold font-sans-bold text-lg">Save Address</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
