import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, ChefHat, MapPin, Info, Sparkles, Users, UtensilsCrossed, Shield, Navigation, CheckCircle, Camera, Plus, X, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import * as LocationAPI from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const SPECIALTIES = [
    'Rice Dishes 🍚',
    'Soups & Stews 🍲',
    'Swallows & Solids 🥣',
    'Grills & Sides 🍢',
    'Snacks & Drinks 🍹'
];

const FREQUENCIES = [
    { id: 'occasionally', label: 'Occasionally', desc: 'Once in a while' },
    { id: 'weekly', label: 'Weekly', desc: 'Every week' },
    { id: 'multiple_times_weekly', label: 'Often', desc: 'Multiple times a week' }
];

const GHANAIAN_DISHES = [
    'Jollof Rice', 'Fried Rice', 'Waakye', 'Rice & Stew', 'Rice & Beans',
    'Fufu', 'Banku', 'Kenkey', 'TZ', 'Tuo Zaafi', 'Eba',
    'Light Soup', 'Groundnut Soup', 'Palm Nut Soup', 'Kontomire Stew', 'Tomato Stew',
    'Egusi Soup', 'Abenkwan', 'Fante Fante', 'Okra Soup',
    'Kelewele', 'Fried Plantain', 'Tatale', 'Ampesi', 'Yam & Stew', 'Yam Chips',
    'Red Red', 'Gobɛ', 'Koose', 'Akara', 'Hausa Koko', 'Tom Brown', 'Koko',
    'Grilled Tilapia', 'Grilled Chicken', 'Chichinga', 'Suya', 'Kebab',
    'Fried Fish', 'Grilled Fish', 'Smoked Fish Stew',
    'Meat Pie', 'Sausage Roll', 'Rock Bun', 'Chin Chin', 'Bofrot', 'Puff Puff',
    'Pancakes', 'Egg Sandwich', 'Scrambled Eggs & Bread',
    'Sobolo', 'Asaana', 'Lamugin', 'Kunu', 'Fresh Juice'
];

const CAPACITIES = [
    { id: 10, label: '5 – 10', desc: 'Small intimate gatherings' },
    { id: 20, label: '10 – 20', desc: 'Standard pot sessions' },
    { id: 40, label: '20 – 40', desc: 'Large community batches' }
];

export default function ApplyToCookScreen() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form State
    const [kitchenName, setKitchenName] = useState('');
    const [bio, setBio] = useState('');
    const [location, setLocation] = useState('');
    const [locationLat, setLocationLat] = useState<number | null>(null);
    const [locationLng, setLocationLng] = useState<number | null>(null);
    const [locationDescription, setLocationDescription] = useState('');
    const [locationFetching, setLocationFetching] = useState(false);
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
    const [frequency, setFrequency] = useState('weekly');
    const [capacity, setCapacity] = useState(20);
    const [dishTags, setDishTags] = useState<string[]>([]);
    const [dishInput, setDishInput] = useState('');
    const [dishSuggestions, setDishSuggestions] = useState<string[]>([]);
    const [kitchenImageUri, setKitchenImageUri] = useState<string | null>(null);
    const [kitchenImageBase64, setKitchenImageBase64] = useState<string | null>(null);

    const pickKitchenImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
            base64: true,
        });
        if (!result.canceled && result.assets[0]) {
            setKitchenImageUri(result.assets[0].uri);
            setKitchenImageBase64(result.assets[0].base64 || null);
        }
    };

    const uploadKitchenImage = async (userId: string): Promise<string | null> => {
        if (!kitchenImageBase64) return null;
        const filePath = `${userId}/kitchen_${Date.now()}.jpg`;
        const { error } = await supabase.storage
            .from('avatars')
            .upload(filePath, decode(kitchenImageBase64), {
                contentType: 'image/jpeg',
                upsert: true,
            });
        if (error) {
            console.error('Kitchen image upload error:', error);
            return null;
        }
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
        return publicUrl;
    };

    const captureKitchenLocation = async () => {
        setLocationFetching(true);
        try {
            const { status } = await LocationAPI.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'We need your location to verify your kitchen address. This protects both you and eaters.');
                setLocationFetching(false);
                return;
            }
            const loc = await LocationAPI.getCurrentPositionAsync({ accuracy: LocationAPI.Accuracy.High });
            setLocationLat(loc.coords.latitude);
            setLocationLng(loc.coords.longitude);

            // Reverse geocode for readable address
            const [geo] = await LocationAPI.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            });
            if (geo) {
                const parts = [geo.street, geo.district || geo.subregion, geo.city || geo.region].filter(Boolean);
                setLocation(parts.join(', '));
            } else {
                setLocation(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
            }
        } catch (e) {
            Alert.alert('Error', 'Could not get your location. Please make sure location services are enabled.');
        }
        setLocationFetching(false);
    };

    useEffect(() => {
        checkExistingApplication();
    }, []);

    const checkExistingApplication = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('cook_application_status')
                .eq('id', user.id)
                .single();

            if (data?.cook_application_status === 'pending') {
                Alert.alert(
                    "Application Pending",
                    "You already have a kitchen application under review. We'll notify you soon!",
                    [{ text: "OK", onPress: () => router.back() }]
                );
            }
        } catch (e) {
            console.log('Error checking application status:', e);
        }
    };

    const handleDishInputChange = (text: string) => {
        setDishInput(text);
        if (text.trim().length < 2) {
            setDishSuggestions([]);
            return;
        }
        const lower = text.toLowerCase();
        const matches = GHANAIAN_DISHES.filter(
            d => d.toLowerCase().includes(lower) && !dishTags.includes(d)
        ).slice(0, 5);
        setDishSuggestions(matches);
    };

    const addDishTag = (dish?: string) => {
        const trimmed = (typeof dish === 'string' ? dish : dishInput).trim();
        if (!trimmed) return;
        if (dishTags.includes(trimmed)) return;
        setDishTags(prev => [...prev, trimmed]);
        setDishInput('');
        setDishSuggestions([]);
    };

    const removeDishTag = (tagToRemove: string) => {
        setDishTags(prev => prev.filter(t => t !== tagToRemove));
    };

    const toggleSpecialty = (specialty: string) => {
        if (selectedSpecialties.includes(specialty)) {
            setSelectedSpecialties(prev => prev.filter(s => s !== specialty));
        } else {
            setSelectedSpecialties(prev => [...prev, specialty]);
        }
    };

    const handleSubmit = async () => {
        if (loading) return; // Prevent double-tap
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // 0. Double-check: prevent duplicate applications at DB level
            const { data: existingApp } = await supabase
                .from('cook_applications')
                .select('id, status')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .maybeSingle();

            if (existingApp) {
                Alert.alert(
                    "Application Pending",
                    "You already have a kitchen application under review. We'll notify you soon!",
                    [{ text: "OK", onPress: () => router.replace('/(tabs)/profile') }]
                );
                return;
            }

            // 1. Create the application record
            const insertPayload = {
                    user_id: user.id,
                    kitchen_name: kitchenName,
                    bio: bio,
                    location: location,
                    location_description: locationDescription || null,
                    specialties: selectedSpecialties,
                    cooking_frequency: frequency,
                    max_session_capacity: capacity,
                    example_dishes: dishTags.join(', ') || null,
                    status: 'pending'
            };
            console.log('INSERT PAYLOAD:', JSON.stringify(insertPayload));

            const { error: appError } = await supabase
                .from('cook_applications')
                .insert(insertPayload);

            console.log('INSERT RESULT:', JSON.stringify(appError));
            if (appError) throw appError;

            // Upload kitchen image if provided
            const kitchenImageUrl = await uploadKitchenImage(user.id);

            // 2. Update profile with application data + GPS coordinates + pending status
            const profileUpdate: any = {
                    cook_application_status: 'pending',
                    kitchen_name: kitchenName,
                    bio: bio,
                    location: location,
                    location_description: locationDescription || null,
                    latitude: locationLat,
                    longitude: locationLng,
                    specialties: selectedSpecialties,
                    example_dishes: dishTags.join(', ') || null,
            };
            if (kitchenImageUrl) profileUpdate.kitchen_image_url = kitchenImageUrl;

            const { error: profileError } = await supabase
                .from('profiles')
                .update(profileUpdate)
                .eq('id', user.id);

            console.log('PROFILE UPDATE RESULT:', JSON.stringify(profileError));
            if (profileError) throw profileError;

            Alert.alert(
                "Application Submitted! 🥘",
                "We've received your kitchen application. Our team will review it and get back to you soon.",
                [{ text: "Back to Profile", onPress: () => router.replace('/(tabs)/profile') }]
            );
        } catch (error: any) {
            console.error('Cook application error:', error);
            Alert.alert('Error', error.message || 'Failed to submit application');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-warm-cream" edges={['top']}>
            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2 rounded-full active:bg-gray-100">
                    <ArrowLeft size={24} color="#2D241E" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-text-main font-sans-bold">Become a Cook</Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
                {/* Step indicator */}
                <View className="mb-6">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-xs font-bold text-clay-primary uppercase tracking-widest font-sans-bold">Step {step} of 5</Text>
                        <Text className="text-xs text-text-sub font-sans">
                            {step === 1 ? 'Kitchen Info' : step === 2 ? 'Cooking Style' : step === 3 ? 'Capacity' : step === 4 ? 'Dishes' : 'Agreement'}
                        </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-clay-primary' : 'bg-gray-200'}`} />
                        ))}
                    </View>
                </View>

                {step === 1 ? (
                    <View>
                        <View className="mb-6">
                            <View className="w-12 h-12 bg-clay-primary/10 rounded-2xl items-center justify-center mb-4 border border-clay-primary/15">
                                <ChefHat size={24} color="#D65A31" />
                            </View>
                            <Text className="text-2xl font-bold text-text-main mb-1.5 font-sans-bold">Identify your Kitchen</Text>
                            <Text className="text-sm text-text-sub font-sans leading-relaxed">Let's set up your kitchen details so eaters can find and trust you.</Text>
                        </View>

                        {/* Photo Upload Card */}
                        <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-5 shadow-sm">
                            <Text className="text-xs font-bold text-text-main mb-3 uppercase tracking-widest font-sans-bold">Kitchen Cover Photo</Text>
                            <TouchableOpacity onPress={pickKitchenImage} activeOpacity={0.9}>
                                {kitchenImageUri ? (
                                    <View className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-gray-50 border border-gray-100">
                                        <Image source={{ uri: kitchenImageUri }} className="w-full h-full object-cover" />
                                        <View className="absolute bottom-3 right-3 bg-black/60 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                                            <Camera size={14} color="white" />
                                            <Text className="text-white text-xs font-bold font-sans-bold">Change Cover</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View className="w-full aspect-[16/10] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 items-center justify-center p-4">
                                        <View className="w-12 h-12 rounded-full bg-clay-primary/10 items-center justify-center mb-3">
                                            <Camera size={22} color="#D65A31" />
                                        </View>
                                        <Text className="text-text-main text-sm font-bold font-sans-bold">Add Cover Photo</Text>
                                        <Text className="text-text-sub text-xs font-sans text-center mt-1">Show off your cooking space or signature dish</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Profile Info Cards */}
                        <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-5 shadow-sm gap-5">
                            <View>
                                <Text className="text-xs font-bold text-text-main mb-2 uppercase tracking-widest font-sans-bold">Kitchen Name</Text>
                                <TextInput
                                    placeholder="e.g. Auntie Ama's Kitchen"
                                    placeholderTextColor="#9CA3AF"
                                    className="h-14 bg-gray-50 rounded-xl px-4 font-sans text-text-main border border-gray-200 text-base focus:border-clay-primary focus:bg-white"
                                    value={kitchenName}
                                    onChangeText={setKitchenName}
                                />
                            </View>

                            <View>
                                <Text className="text-xs font-bold text-text-main mb-2 uppercase tracking-widest font-sans-bold">About your Cooking</Text>
                                <TextInput
                                    placeholder="Tell eaters about your cooking style and background..."
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-gray-50 rounded-xl px-4 py-3 font-sans text-text-main min-h-[100px] border border-gray-200 text-base focus:border-clay-primary focus:bg-white"
                                    multiline
                                    textAlignVertical="top"
                                    value={bio}
                                    onChangeText={setBio}
                                />
                            </View>
                        </View>

                        {/* Location Verification Card */}
                        <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-6 shadow-sm">
                            <Text className="text-xs font-bold text-text-main mb-1.5 uppercase tracking-widest font-sans-bold">Kitchen Address</Text>
                            <Text className="text-xs text-text-sub font-sans mb-4 leading-relaxed">For verification, we lock in your GPS location. Eaters only see this when pickup is ready.</Text>

                            {locationLat ? (
                                <View className="bg-green-50 rounded-2xl p-4 border border-green-200 mb-4 flex-row items-center gap-3">
                                    <View className="w-10 h-10 rounded-full bg-kente-green/10 items-center justify-center">
                                        <CheckCircle size={20} color="#007A33" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-kente-green font-bold font-sans-bold text-sm">GPS Location Verified</Text>
                                        <Text className="text-text-main text-xs font-sans mt-0.5" numberOfLines={1}>{location}</Text>
                                    </View>
                                    <TouchableOpacity onPress={captureKitchenLocation} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                                        <Text className="text-xs text-text-main font-bold font-sans-bold">Re-sync</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={captureKitchenLocation}
                                    disabled={locationFetching}
                                    className="bg-clay-primary/10 rounded-2xl p-4 border border-clay-primary/20 flex-row items-center justify-center gap-2.5 mb-4 h-14 active:scale-98"
                                >
                                    {locationFetching ? (
                                        <ActivityIndicator size="small" color="#D65A31" />
                                    ) : (
                                        <>
                                            <Navigation size={20} color="#D65A31" />
                                            <Text className="text-clay-primary font-bold font-sans-bold text-base">Capture GPS Location</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}

                            <View>
                                <Text className="text-xs font-bold text-text-main mb-2 uppercase tracking-widest font-sans-bold">Nearby Landmark</Text>
                                <TextInput
                                    placeholder="e.g. Next to the big mango tree, opposite Shell..."
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-gray-50 rounded-xl px-4 py-3 font-sans text-text-main min-h-[70px] border border-gray-200 text-base focus:border-clay-primary focus:bg-white"
                                    multiline
                                    textAlignVertical="top"
                                    value={locationDescription}
                                    onChangeText={setLocationDescription}
                                />
                                <Text className="text-[10px] text-text-sub font-sans mt-1.5 leading-relaxed">Help pick up riders find you easily by describing landmarks.</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            className={`h-14 rounded-2xl flex-row items-center justify-center gap-2 mb-10 shadow-sm ${kitchenName && bio && locationLat ? 'bg-clay-primary active:scale-98' : 'bg-gray-300'}`}
                            onPress={() => setStep(2)}
                            disabled={!kitchenName || !bio || !locationLat}
                        >
                            <Text className="text-white font-bold text-base font-sans-bold">Next: Cooking Style</Text>
                            <ChevronRight size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                ) : step === 2 ? (
                    <View>
                        <View className="mb-6">
                            <View className="w-12 h-12 bg-kente-yellow/20 rounded-2xl items-center justify-center mb-4 border border-kente-yellow/30">
                                <Sparkles size={24} color="#D65A31" />
                            </View>
                            <Text className="text-2xl font-bold text-text-main mb-1.5 font-sans-bold">Cooking Style</Text>
                            <Text className="text-sm text-text-sub font-sans leading-relaxed">Specify your signature specialties and how often you'd like to sell.</Text>
                        </View>

                        {/* Specialties Section */}
                        <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-5 shadow-sm">
                            <Text className="text-xs font-bold text-text-main mb-3.5 uppercase tracking-widest font-sans-bold">Your Specialties</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                                {SPECIALTIES.map(specialty => {
                                    const isSelected = selectedSpecialties.includes(specialty);
                                    return (
                                        <TouchableOpacity
                                            key={specialty}
                                            onPress={() => toggleSpecialty(specialty)}
                                            className={`px-4 py-2.5 rounded-full border-2 ${isSelected ? 'bg-orange-50 border-clay-primary' : 'bg-white border-gray-200'} active:scale-95`}
                                        >
                                            <Text className={`font-sans-bold text-xs ${isSelected ? 'text-clay-primary' : 'text-text-main'}`}>{specialty}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Frequency Selection */}
                        <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-6 shadow-sm">
                            <Text className="text-xs font-bold text-text-main mb-4 uppercase tracking-widest font-sans-bold">Cooking Frequency</Text>
                            {FREQUENCIES.map(freq => {
                                const isSelected = frequency === freq.id;
                                return (
                                    <TouchableOpacity
                                        key={freq.id}
                                        onPress={() => setFrequency(freq.id)}
                                        className={`p-4 rounded-2xl border mb-3 flex-row items-center justify-between ${isSelected ? 'bg-orange-50/50 border-clay-primary' : 'bg-gray-50 border-gray-100'} active:scale-98`}
                                    >
                                        <View className="flex-1 pr-4">
                                            <Text className={`font-bold font-sans-bold text-base ${isSelected ? 'text-clay-primary' : 'text-text-main'}`}>{freq.label}</Text>
                                            <Text className="text-xs text-text-sub font-sans mt-0.5">{freq.desc}</Text>
                                        </View>
                                        <View className={`w-5 h-5 rounded-full border items-center justify-center ${isSelected ? 'bg-clay-primary border-clay-primary' : 'border-gray-300 bg-white'}`}>
                                            {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Buttons */}
                        <View className="flex-row gap-4 mb-10">
                            <TouchableOpacity className="flex-1 h-14 rounded-2xl bg-white border border-gray-200 items-center justify-center active:scale-98" onPress={() => setStep(1)}>
                                <Text className="font-bold text-text-sub font-sans-bold text-base">Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`flex-[2] h-14 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm ${selectedSpecialties.length > 0 ? 'bg-clay-primary active:scale-98' : 'bg-gray-300'}`}
                                onPress={() => setStep(3)}
                                disabled={selectedSpecialties.length === 0}
                            >
                                <Text className="text-white font-bold text-base font-sans-bold">Next: Capacity</Text>
                                <ChevronRight size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : step === 3 ? (
                    <View>
                        <View className="mb-6">
                            <View className="w-12 h-12 bg-kente-green/10 rounded-2xl items-center justify-center mb-4 border border-kente-green/15">
                                <Users size={24} color="#007A33" />
                            </View>
                            <Text className="text-2xl font-bold text-text-main mb-1.5 font-sans-bold">Session Capacity</Text>
                            <Text className="text-sm text-text-sub font-sans leading-relaxed">Choose the maximum food volume you can prepare for a single pickup batch.</Text>
                        </View>

                        {/* Capacity Selection */}
                        <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-6 shadow-sm">
                            <Text className="text-xs font-bold text-text-main mb-4 uppercase tracking-widest font-sans-bold">Session Size</Text>
                            {CAPACITIES.map(cap => {
                                const isSelected = capacity === cap.id;
                                return (
                                    <TouchableOpacity
                                        key={cap.id}
                                        onPress={() => setCapacity(cap.id)}
                                        className={`p-4 rounded-2xl border mb-3 flex-row items-center justify-between ${isSelected ? 'bg-green-50/50 border-kente-green' : 'bg-gray-50 border-gray-100'} active:scale-98`}
                                    >
                                        <View className="flex-1 pr-4">
                                            <Text className={`font-bold font-sans-bold text-base ${isSelected ? 'text-kente-green' : 'text-text-main'}`}>{cap.label} Servings</Text>
                                            <Text className="text-xs text-text-sub font-sans mt-0.5">{cap.desc}</Text>
                                        </View>
                                        <View className={`w-5 h-5 rounded-full border items-center justify-center ${isSelected ? 'bg-kente-green border-kente-green' : 'border-gray-300 bg-white'}`}>
                                            {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Buttons */}
                        <View className="flex-row gap-4 mb-10">
                            <TouchableOpacity className="flex-1 h-14 rounded-2xl bg-white border border-gray-200 items-center justify-center active:scale-98" onPress={() => setStep(2)}>
                                <Text className="font-bold text-text-sub font-sans-bold text-base">Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-[2] h-14 rounded-2xl flex-row items-center justify-center gap-2 bg-clay-primary shadow-sm active:scale-98"
                                onPress={() => setStep(4)}
                            >
                                <Text className="text-white font-bold text-base font-sans-bold">Next: Dishes</Text>
                                <ChevronRight size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : step === 4 ? (
                    <View>
                        <View className="mb-6">
                            <View className="w-12 h-12 bg-clay-primary/10 rounded-2xl items-center justify-center mb-4 border border-clay-primary/15">
                                <UtensilsCrossed size={24} color="#D65A31" />
                            </View>
                            <Text className="text-2xl font-bold text-text-main mb-1.5 font-sans-bold">Dish Preview</Text>
                            <Text className="text-sm text-text-sub font-sans leading-relaxed">Name some signature dishes you intend to prepare and share.</Text>
                        </View>

                        {/* Dish Examples Tag Input */}
                        <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-6 shadow-sm">
                            <Text className="text-xs font-bold text-text-main mb-1 uppercase tracking-widest font-sans-bold">Menu Dishes</Text>
                            <Text className="text-xs text-text-sub font-sans mb-3 leading-relaxed">Type a dish to get suggestions — tap one to add it as a tag. These help eaters find your kitchen.</Text>

                            {/* Input Row */}
                            <View className="flex-row gap-2 items-center mb-2">
                                <TextInput
                                    placeholder="e.g. Jollof Rice, Waakye..."
                                    placeholderTextColor="#9CA3AF"
                                    className="flex-1 h-14 bg-gray-50 rounded-xl px-4 font-sans text-text-main border border-gray-200 text-base"
                                    value={dishInput}
                                    onChangeText={handleDishInputChange}
                                    onSubmitEditing={() => addDishTag()}
                                    returnKeyType="done"
                                />
                                <TouchableOpacity
                                    onPress={() => addDishTag()}
                                    className="w-14 h-14 bg-clay-primary rounded-xl items-center justify-center active:scale-95 shadow-sm"
                                >
                                    <Plus size={22} color="white" />
                                </TouchableOpacity>
                            </View>

                            {/* Autocomplete Suggestions */}
                            {dishSuggestions.length > 0 && (
                                <View className="bg-gray-50 rounded-2xl border border-gray-200 mb-3 overflow-hidden">
                                    {dishSuggestions.map((suggestion, index) => (
                                        <TouchableOpacity
                                            key={suggestion}
                                            onPress={() => addDishTag(suggestion)}
                                            className={`px-4 py-3 flex-row items-center justify-between active:bg-orange-50 ${index < dishSuggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
                                        >
                                            <Text className="text-sm text-text-main font-sans">{suggestion}</Text>
                                            <View className="bg-clay-primary/10 px-2.5 py-1 rounded-full">
                                                <Text className="text-xs text-clay-primary font-sans-bold">+ Add</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Added Tags */}
                            {dishTags.length > 0 ? (
                                <View className="flex-row flex-wrap gap-2.5 mt-1">
                                    {dishTags.map((tag) => (
                                        <View key={tag} className="flex-row items-center gap-1.5 bg-orange-50 border border-clay-primary/20 pl-3.5 pr-2 py-1.5 rounded-full">
                                            <Text className="text-sm font-sans-bold text-clay-primary">{tag}</Text>
                                            <TouchableOpacity onPress={() => removeDishTag(tag)} className="w-5 h-5 rounded-full items-center justify-center bg-clay-primary/10">
                                                <X size={12} color="#D65A31" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View className="items-center py-5 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 mt-1">
                                    <Text className="text-xs text-text-sub font-sans text-center px-4 leading-relaxed">No dishes added yet — start typing above to see suggestions</Text>
                                </View>
                            )}
                        </View>

                        {/* Buttons */}
                        <View className="flex-row gap-4 mb-10">
                            <TouchableOpacity className="flex-1 h-14 rounded-2xl bg-white border border-gray-200 items-center justify-center active:scale-98" onPress={() => setStep(3)}>
                                <Text className="font-bold text-text-sub font-sans-bold text-base">Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`flex-[2] h-14 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm ${dishTags.length > 0 ? 'bg-clay-primary active:scale-98' : 'bg-gray-300'}`}
                                onPress={() => setStep(5)}
                                disabled={dishTags.length === 0}
                            >
                                <Text className="text-white font-bold text-base font-sans-bold">Agreement</Text>
                                <ChevronRight size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View>
                        <View className="mb-6">
                            <View className="w-12 h-12 bg-kente-green/10 rounded-2xl items-center justify-center mb-4 border border-kente-green/15">
                                <Shield size={24} color="#007A33" />
                            </View>
                            <Text className="text-2xl font-bold text-text-main mb-1.5 font-sans-bold">Trusted Kitchen Code</Text>
                            <Text className="text-sm text-text-sub font-sans leading-relaxed">Agree to our safety and quality guidelines to finish your application.</Text>
                        </View>

                        {/* Safety Guidelines Card */}
                        <View className="bg-white p-6 rounded-3xl border border-gray-100 mb-6 shadow-sm">
                            <Text className="text-sm font-bold text-text-main mb-4 font-sans-bold">Quality Commitments:</Text>
                            <View className="gap-4">
                                <View className="flex-row items-start gap-3">
                                    <View className="w-5 h-5 rounded-full bg-green-100 items-center justify-center mt-0.5">
                                        <Check size={12} color="#007A33" />
                                    </View>
                                    <Text className="text-sm text-text-sub font-sans flex-1 leading-relaxed">Keep your preparation area hygienic and clean at all times.</Text>
                                </View>
                                <View className="flex-row items-start gap-3">
                                    <View className="w-5 h-5 rounded-full bg-green-100 items-center justify-center mt-0.5">
                                        <Check size={12} color="#007A33" />
                                    </View>
                                    <Text className="text-sm text-text-sub font-sans flex-1 leading-relaxed">Provide fresh ingredients and accurate description of allergens.</Text>
                                </View>
                                <View className="flex-row items-start gap-3">
                                    <View className="w-5 h-5 rounded-full bg-green-100 items-center justify-center mt-0.5">
                                        <Check size={12} color="#007A33" />
                                    </View>
                                    <Text className="text-sm text-text-sub font-sans flex-1 leading-relaxed">Accurately represent location details and prep times for pickup batches.</Text>
                                </View>
                            </View>
                        </View>

                        {/* Actions */}
                        <TouchableOpacity
                            className={`h-14 rounded-2xl flex-row items-center justify-center gap-2 mb-4 shadow-sm ${!loading ? 'bg-clay-primary active:scale-98' : 'bg-gray-300'}`}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white font-bold text-base font-sans-bold">Submit Application</Text>
                                    <Sparkles size={20} color="white" />
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="h-14 items-center justify-center mb-10 rounded-2xl border border-gray-200 bg-white active:scale-98"
                            onPress={() => setStep(4)}
                            disabled={loading}
                        >
                            <Text className="text-text-sub font-bold font-sans-bold text-base">Back to Dishes</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
