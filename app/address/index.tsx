import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import LocationPicker from '@/components/LocationPicker';
import { supabase } from '@/lib/supabase';

export default function AddressScreen() {
    const router = useRouter();
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleLocationPicked = (pickedLocation: { lat: number; lng: number }) => {
        setLocation(pickedLocation);
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

            // In a real app, we would reverse geocode here to get the address string
            // For now, we'll just save the coordinates and a dummy address string
            const dummyAddress = `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}`;

            const { error } = await supabase
                .from('profiles')
                .update({
                    latitude: location.lat,
                    longitude: location.lng,
                    location: dummyAddress,
                    address: dummyAddress
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
            <View className="px-6 pt-3 pb-4 bg-white border-b border-gray-100 flex-row items-center gap-3">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center"
                >
                    <ChevronLeft size={24} color="#2D241E" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-text-main font-sans-bold">Delivery Address</Text>
            </View>

            <ScrollView className="flex-1 p-6">
                <View className="bg-white p-6 rounded-3xl shadow-sm mb-6">
                    <Text className="text-lg font-bold text-text-main mb-2 font-sans-bold">Set Location</Text>
                    <Text className="text-text-sub mb-6 font-sans">Tap the map or use your current location to set where you want your food delivered.</Text>

                    <LocationPicker onLocationPicked={handleLocationPicked} />
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
