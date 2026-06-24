import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChefHat, MapPin, Sparkles, Check, Navigation, Camera } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const SPECIALTIES = [
    'Rice Dishes 🍚',
    'Soups & Stews 🍲',
    'Swallows & Solids 🥣',
    'Grills & Sides 🍢',
    'Snacks & Drinks 🍹'
];

export default function KitchenSettingsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [kitchenName, setKitchenName] = useState('');
    const [bio, setBio] = useState('');
    const [location, setLocation] = useState('');
    const [locationDescription, setLocationDescription] = useState('');
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [exampleDishes, setExampleDishes] = useState<string[]>([]);
    const [kitchenImageUrl, setKitchenImageUrl] = useState<string | null>(null);
    const [imageUploading, setImageUploading] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('profiles')
                .select('kitchen_name, bio, location, location_description, specialties, kitchen_image_url, example_dishes')
                .eq('id', user.id)
                .single();

            if (data) {
                setKitchenName(data.kitchen_name || '');
                setBio(data.bio || '');
                setLocation(data.location || '');
                setLocationDescription(data.location_description || '');
                setSpecialties(data.specialties || []);
                setExampleDishes(
                    data.example_dishes
                        ? data.example_dishes.split(',').map((d: string) => d.trim()).filter(Boolean)
                        : []
                );
                setKitchenImageUrl(data.kitchen_image_url || null);
            }
        } catch (e) {
            console.error('Error loading kitchen profile:', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSpecialty = (specialty: string) => {
        if (specialties.includes(specialty)) {
            setSpecialties(prev => prev.filter(s => s !== specialty));
        } else {
            setSpecialties(prev => [...prev, specialty]);
        }
    };

    const pickKitchenImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
            base64: true,
        });
        if (result.canceled || !result.assets[0].base64) return;

        setImageUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not logged in');

            const filePath = `${user.id}/kitchen_${Date.now()}.jpg`;
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
                .update({ kitchen_image_url: publicUrl })
                .eq('id', user.id);
            if (updateError) throw updateError;

            setKitchenImageUrl(publicUrl);
            Alert.alert('Updated! 📸', 'Kitchen photo changed.');
        } catch (err: any) {
            Alert.alert('Upload Failed', err.message);
        } finally {
            setImageUploading(false);
        }
    };

    const handleSave = async () => {
        if (!kitchenName.trim()) {
            Alert.alert('Required', 'Kitchen name is required.');
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('profiles')
                .update({
                    kitchen_name: kitchenName.trim(),
                    bio: bio.trim(),
                    location_description: locationDescription.trim() || null,
                    specialties,
                })
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert('Saved! ✅', 'Your kitchen profile has been updated.', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-warm-cream items-center justify-center" edges={['top']}>
                <ActivityIndicator size="large" color="#D65A31" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <View className="flex-1 bg-warm-cream">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
                        <ArrowLeft size={24} color="#2D241E" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-text-main font-sans-bold">Kitchen Settings</Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving} className="px-4 py-2 bg-clay-primary rounded-xl">
                        {saving ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Text className="text-white font-bold font-sans-bold text-sm">Save</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                    {/* Kitchen Photo */}
                    <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                        <View className="flex-row items-center gap-2 mb-4">
                            <Camera size={20} color="#D65A31" />
                            <Text className="text-xs font-bold text-text-main uppercase tracking-widest font-sans-bold">Kitchen Photo</Text>
                        </View>
                        <TouchableOpacity onPress={pickKitchenImage} activeOpacity={0.8}>
                            {imageUploading ? (
                                <View className="w-full h-40 bg-gray-50 rounded-2xl items-center justify-center">
                                    <ActivityIndicator size="large" color="#D65A31" />
                                </View>
                            ) : kitchenImageUrl ? (
                                <View className="relative rounded-2xl overflow-hidden">
                                    <Image source={{ uri: kitchenImageUrl }} className="w-full h-40 rounded-2xl" />
                                    <View className="absolute bottom-2 right-2 bg-black/50 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                                        <Camera size={14} color="white" />
                                        <Text className="text-white text-xs font-bold font-sans-bold">Change</Text>
                                    </View>
                                </View>
                            ) : (
                                <View className="w-full h-40 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 items-center justify-center">
                                    <Camera size={32} color="#9CA3AF" />
                                    <Text className="text-text-sub text-sm font-sans mt-2">Add a photo of your kitchen</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Kitchen Name */}
                    <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                        <View className="flex-row items-center gap-2 mb-4">
                            <ChefHat size={20} color="#D65A31" />
                            <Text className="text-xs font-bold text-text-main uppercase tracking-widest font-sans-bold">Kitchen Name</Text>
                        </View>
                        <TextInput
                            placeholder="e.g. Auntie Ama's Specialties"
                            placeholderTextColor="#9CA3AF"
                            className="h-14 bg-gray-50 rounded-xl px-4 font-sans text-text-main border border-gray-200 text-base"
                            value={kitchenName}
                            onChangeText={setKitchenName}
                        />
                    </View>

                    {/* About Kitchen */}
                    <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                        <Text className="text-xs font-bold text-text-main mb-3 uppercase tracking-widest font-sans-bold">About Your Kitchen</Text>
                        <TextInput
                            placeholder="Tell eaters about your cooking style..."
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 rounded-xl px-4 py-3 font-sans text-text-main min-h-[120px] border border-gray-200 text-base"
                            multiline
                            textAlignVertical="top"
                            value={bio}
                            onChangeText={setBio}
                        />
                    </View>

                    <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                        <View className="flex-row items-center gap-2 mb-4">
                            <Sparkles size={20} color="#D65A31" />
                            <Text className="text-xs font-bold text-text-main uppercase tracking-widest font-sans-bold">Specialties</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                            {SPECIALTIES.map(specialty => {
                                const isSelected = specialties.includes(specialty);
                                return (
                                    <TouchableOpacity
                                        key={specialty}
                                        onPress={() => toggleSpecialty(specialty)}
                                        className={`px-4 py-2.5 rounded-full border-2 ${isSelected ? 'bg-orange-50 border-clay-primary' : 'bg-white border-gray-200'} active:scale-95`}
                                    >
                                        <Text className={`font-sans-bold text-xs ${isSelected ? 'text-clay-primary' : 'text-text-main'}`}>
                                            {specialty}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Location Info */}
                    <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                        <View className="flex-row items-center gap-2 mb-4">
                            <MapPin size={20} color="#D65A31" />
                            <Text className="text-xs font-bold text-text-main uppercase tracking-widest font-sans-bold">Location</Text>
                        </View>

                        {/* GPS Location (read-only) */}
                        <View className="bg-green-50 rounded-xl p-4 border border-green-200 mb-4">
                            <View className="flex-row items-center gap-2 mb-1">
                                <Navigation size={14} color="#007A33" />
                                <Text className="text-kente-green font-bold font-sans-bold text-xs">GPS Verified</Text>
                            </View>
                            <Text className="text-text-main text-sm font-sans">{location || 'Not set'}</Text>
                            <Text className="text-[11px] text-text-sub font-sans mt-1">Location is GPS-locked and cannot be changed manually</Text>
                        </View>

                        {/* Landmark (editable) */}
                        <Text className="text-xs font-bold text-text-main mb-2 uppercase tracking-widest font-sans-bold">Nearby Landmark</Text>
                        <TextInput
                            placeholder="e.g. By the big mango tree, opposite Shell station..."
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 rounded-xl px-4 py-3 font-sans text-text-main min-h-[80px] border border-gray-200 text-base"
                            multiline
                            textAlignVertical="top"
                            value={locationDescription}
                            onChangeText={setLocationDescription}
                        />
                        <Text className="text-[11px] text-text-sub font-sans mt-1.5">Help eaters find you — describe what's near your kitchen</Text>
                    </View>

                    <View className="h-10" />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
