import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import LocationPicker from '@/components/LocationPicker';
import { supabase } from '@/lib/supabase';
import { palette, type, fonts } from '@/constants/theme';

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

    const insets = useSafeAreaInsets();
    const canSave = !!location && !isSaving;
    const selectedText = resolvedAddress || (location ? `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}` : '');

    return (
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
            <View className="flex-1 bg-warm-cream">
                {/* Header — same layout as Notifications / Messages */}
                <View className="bg-surface px-6 py-4 flex-row items-center gap-4 border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} className="p-1" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <ArrowLeft size={24} color={palette.ink} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-xl font-bold text-text-main font-sans-bold">Your Location</Text>
                        <Text style={{ ...type.meta, fontFamily: fonts.regular, color: palette.muted }}>So we can show hosts and gatherings near you</Text>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={{ padding: 20, paddingBottom: 130 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Current saved address */}
                    {!loadingSaved && savedAddress && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(194, 83, 39, 0.35)' }}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(194, 83, 39, 0.10)', alignItems: 'center', justifyContent: 'center' }}>
                                <MapPin size={18} color={palette.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ ...type.micro, color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>You're currently in</Text>
                                <Text style={{ ...type.cardTitleSmall, color: palette.ink, marginTop: 1 }} numberOfLines={2}>{savedAddress}</Text>
                            </View>
                        </View>
                    )}

                    {/* Pick a new location */}
                    <View style={{ backgroundColor: palette.surface, borderRadius: 16, padding: 16 }}>
                        <Text style={{ ...type.section, color: palette.ink }}>Where are you?</Text>
                        <Text style={{ ...type.body, color: palette.muted, marginTop: 2, marginBottom: 14 }}>
                            Tap the map or use your current location so we can find hosts and gatherings close to you.
                        </Text>

                        <LocationPicker onLocationPicked={handleLocationPicked} />

                        {location && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.canvas, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                                {resolving ? (
                                    <>
                                        <ActivityIndicator size="small" color={palette.accent} />
                                        <Text style={{ ...type.body, color: palette.muted }}>Finding address…</Text>
                                    </>
                                ) : (
                                    <>
                                        <MapPin size={16} color={palette.accent} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...type.micro, color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Selected</Text>
                                            <Text style={{ ...type.cardTitleSmall, color: palette.ink }} numberOfLines={2}>{selectedText}</Text>
                                        </View>
                                    </>
                                )}
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* Save bar */}
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: '#F2DFD7', paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
                    <TouchableOpacity
                        onPress={saveAddressHandler}
                        disabled={!canSave}
                        activeOpacity={0.9}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !canSave }}
                        style={{ height: 52, borderRadius: 16, backgroundColor: palette.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: canSave ? 1 : 0.5 }}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <MapPin size={18} color="white" />
                                <Text style={{ ...type.card, fontFamily: fonts.extrabold, color: 'white' }}>Save location</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
