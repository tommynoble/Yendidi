import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, ChefHat, MapPin, Info, Sparkles, Users, UtensilsCrossed, Shield } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

const SPECIALTIES = [
    'Rice Dishes', 'Soups & Stews', 'Grills & Kebabs', 'Traditional Snacks', 'Seafood', 'Pastries'
];

const FREQUENCIES = [
    { id: 'occasionally', label: 'Occasionally', desc: 'Once in a while' },
    { id: 'weekly', label: 'Weekly', desc: 'Every week' },
    { id: 'multiple_times_weekly', label: 'Often', desc: 'Multiple times a week' }
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
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
    const [frequency, setFrequency] = useState('weekly');
    const [capacity, setCapacity] = useState(20);
    const [exampleDishes, setExampleDishes] = useState('');

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
                    specialties: selectedSpecialties,
                    cooking_frequency: frequency,
                    max_session_capacity: capacity,
                    status: 'pending'
            };
            console.log('INSERT PAYLOAD:', JSON.stringify(insertPayload));

            const { error: appError } = await supabase
                .from('cook_applications')
                .insert(insertPayload);

            console.log('INSERT RESULT:', JSON.stringify(appError));
            if (appError) throw appError;

            // 2. Update profile status
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    cook_application_status: 'pending'
                })
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
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <View className="flex-1 bg-warm-cream">
            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
                    <ArrowLeft size={24} color="#2D241E" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-text-main font-sans-bold">Apply to Cook</Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                {step === 1 ? (
                    <View>
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-6">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-clay-primary' : 'bg-gray-200'}`} />
                                ))}
                            </View>
                            <View className="w-16 h-16 bg-clay-primary/10 rounded-2xl items-center justify-center mb-6 border border-clay-primary/20">
                                <ChefHat size={32} color="#D65A31" />
                            </View>
                            <Text className="text-2xl font-bold text-text-main mb-2 font-sans-bold">Identify your Kitchen</Text>
                            <Text className="text-sm text-text-sub font-sans">Every cook on YɛnDidii is verified for quality and community trust.</Text>
                        </View>

                        <View className="bg-white p-6 rounded-3xl border border-gray-100 mb-8 shadow-sm">
                            <View className="mb-5">
                                <Text className="text-xs font-bold text-text-main mb-2 py-1 uppercase tracking-widest font-sans-bold">Kitchen Name</Text>
                                <TextInput
                                    placeholder="e.g. Auntie Ama's Specialties"
                                    placeholderTextColor="#9CA3AF"
                                    className="h-14 bg-gray-50 rounded-xl px-4 font-sans text-text-main border border-gray-200 text-base focus:border-clay-primary focus:bg-white"
                                    value={kitchenName}
                                    onChangeText={setKitchenName}
                                />
                            </View>

                            <View className="mb-5">
                                <Text className="text-xs font-bold text-text-main mb-2 py-1 uppercase tracking-widest font-sans-bold">About your Kitchen</Text>
                                <TextInput
                                    placeholder="Tell eaters about your cooking style and background..."
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-gray-50 rounded-xl px-4 py-3 font-sans text-text-main min-h-[120px] border border-gray-200 text-base focus:border-clay-primary focus:bg-white"
                                    multiline
                                    textAlignVertical="top"
                                    value={bio}
                                    onChangeText={setBio}
                                />
                            </View>

                            <View>
                                <Text className="text-xs font-bold text-text-main mb-2 py-1 uppercase tracking-widest font-sans-bold">General Location</Text>
                                <View className={`flex-row items-center bg-gray-50 rounded-xl px-4 h-14 border ${location ? 'border-clay-primary bg-white' : 'border-gray-200'}`}>
                                    <MapPin size={20} color={location ? "#D65A31" : "#9CA3AF"} />
                                    <TextInput
                                        placeholder="e.g. East Legon, Accra"
                                        placeholderTextColor="#9CA3AF"
                                        className="flex-1 ml-3 font-sans text-text-main text-base"
                                        value={location}
                                        onChangeText={setLocation}
                                    />
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity
                            className={`h-14 rounded-2xl flex-row items-center justify-center gap-2 mb-10 ${kitchenName && bio && location ? 'bg-clay-primary' : 'bg-gray-300'}`}
                            onPress={() => setStep(2)}
                            disabled={!kitchenName || !bio || !location}
                        >
                            <Text className="text-white font-bold text-base font-sans-bold">Next: Cooking Style</Text>
                            <ChevronRight size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                ) : step === 2 ? (
                    <View>
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-6">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-clay-primary' : 'bg-gray-200'}`} />
                                ))}
                            </View>
                            <View className="w-16 h-16 bg-kente-yellow/20 rounded-2xl items-center justify-center mb-6 border border-kente-yellow/30">
                                <Sparkles size={32} color="#D65A31" />
                            </View>
                            <Text className="text-2xl font-bold text-text-main mb-2 font-sans-bold">Cooking Style</Text>
                            <Text className="text-sm text-text-sub font-sans">How often do you host sessions and what are your specialties?</Text>
                        </View>

                        <View className="mb-8">
                            <Text className="text-xs font-bold text-text-sub mb-4 uppercase tracking-widest font-sans-bold">Specialties</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {SPECIALTIES.map(specialty => (
                                    <TouchableOpacity
                                        key={specialty}
                                        onPress={() => toggleSpecialty(specialty)}
                                        className={`px-4 py-2.5 rounded-full border ${selectedSpecialties.includes(specialty) ? 'bg-clay-primary border-clay-primary' : 'bg-white border-gray-200'}`}
                                    >
                                        <Text className={`font-medium font-sans text-xs ${selectedSpecialties.includes(specialty) ? 'text-white' : 'text-text-main'}`}>{specialty}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View className="mb-8">
                            <Text className="text-xs font-bold text-text-sub mb-4 uppercase tracking-widest font-sans-bold">Frequency</Text>
                            {FREQUENCIES.map(freq => (
                                <TouchableOpacity
                                    key={freq.id}
                                    onPress={() => setFrequency(freq.id)}
                                    className={`p-4 rounded-2xl border mb-3 flex-row items-center justify-between ${frequency === freq.id ? 'bg-orange-50 border-clay-primary' : 'bg-white border-gray-100'}`}
                                >
                                    <View>
                                        <Text className={`font-bold font-sans-bold ${frequency === freq.id ? 'text-clay-primary' : 'text-text-main'}`}>{freq.label}</Text>
                                        <Text className="text-xs text-text-sub font-sans">{freq.desc}</Text>
                                    </View>
                                    {frequency === freq.id && <View className="w-5 h-5 rounded-full bg-clay-primary items-center justify-center"><ChevronRight size={12} color="white" /></View>}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View className="flex-row gap-4 mb-10">
                            <TouchableOpacity className="flex-1 h-14 rounded-2xl bg-white border border-gray-100 items-center justify-center" onPress={() => setStep(1)}>
                                <Text className="font-bold text-text-sub font-sans-bold">Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`flex-[2] h-14 rounded-2xl flex-row items-center justify-center gap-2 ${selectedSpecialties.length > 0 ? 'bg-clay-primary' : 'bg-gray-300'}`}
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
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-6">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-clay-primary' : 'bg-gray-200'}`} />
                                ))}
                            </View>
                            <View className="w-16 h-16 bg-kente-green/10 rounded-2xl items-center justify-center mb-6 border border-kente-green/20">
                                <Users size={32} color="#007A33" />
                            </View>
                            <Text className="text-2xl font-bold text-text-main mb-2 font-sans-bold">Session Capacity</Text>
                            <Text className="text-sm text-text-sub font-sans">How many people can you comfortably cook for in a single pot session?</Text>
                        </View>

                        <View className="mb-8">
                            {CAPACITIES.map(cap => (
                                <TouchableOpacity
                                    key={cap.id}
                                    onPress={() => setCapacity(cap.id)}
                                    className={`p-4 rounded-2xl border mb-3 flex-row items-center justify-between ${capacity === cap.id ? 'bg-green-50 border-kente-green' : 'bg-white border-gray-100'}`}
                                >
                                    <View>
                                        <Text className={`font-bold font-sans-bold ${capacity === cap.id ? 'text-kente-green' : 'text-text-main'}`}>{cap.label} People</Text>
                                        <Text className="text-xs text-text-sub font-sans">{cap.desc}</Text>
                                    </View>
                                    {capacity === cap.id && <View className="w-5 h-5 rounded-full bg-kente-green items-center justify-center"><ChevronRight size={12} color="white" /></View>}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View className="flex-row gap-4 mb-10">
                            <TouchableOpacity className="flex-1 h-14 rounded-2xl bg-white border border-gray-100 items-center justify-center" onPress={() => setStep(2)}>
                                <Text className="font-bold text-text-sub font-sans-bold">Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-[2] h-14 rounded-2xl flex-row items-center justify-center gap-2 bg-clay-primary"
                                onPress={() => setStep(4)}
                            >
                                <Text className="text-white font-bold text-base font-sans-bold">Next: Dish Preview</Text>
                                <ChevronRight size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : step === 4 ? (
                    <View>
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-6">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-clay-primary' : 'bg-gray-200'}`} />
                                ))}
                            </View>
                            <View className="w-16 h-16 bg-clay-primary/10 rounded-2xl items-center justify-center mb-6 border border-clay-primary/20">
                                <UtensilsCrossed size={32} color="#D65A31" />
                            </View>
                            <Text className="text-2xl font-bold text-text-main mb-2 font-sans-bold">Dish Preview</Text>
                            <Text className="text-sm text-text-sub font-sans">What are some examples of dishes you plan to host sessions for?</Text>
                        </View>

                        <View className="bg-white p-6 rounded-3xl border border-gray-100 mb-8 shadow-sm">
                            <Text className="text-xs font-bold text-text-main mb-2 py-1 uppercase tracking-widest font-sans-bold">Example Dishes</Text>
                            <TextInput
                                placeholder="e.g. Jollof with grilled chicken, Fufu with Light Soup..."
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 rounded-xl px-4 py-3 font-sans text-text-main min-h-[140px] border border-gray-200 text-base focus:border-clay-primary focus:bg-white"
                                multiline
                                textAlignVertical="top"
                                value={exampleDishes}
                                onChangeText={setExampleDishes}
                            />
                        </View>

                        <TouchableOpacity
                            className="bg-clay-primary/5 p-4 rounded-xl flex-row items-center gap-3 mb-8"
                            onPress={() => Alert.alert('Feature coming soon', 'Image upload will be available in the next phase.')}
                        >
                            <View className="w-10 h-10 bg-white rounded-lg items-center justify-center border border-clay-primary/20">
                                <Sparkles size={18} color="#D65A31" />
                            </View>
                            <Text className="text-clay-primary font-bold font-sans-bold">Add Example Photos</Text>
                        </TouchableOpacity>

                        <View className="flex-row gap-4 mb-10">
                            <TouchableOpacity className="flex-1 h-14 rounded-2xl bg-white border border-gray-100 items-center justify-center" onPress={() => setStep(3)}>
                                <Text className="font-bold text-text-sub font-sans-bold">Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`flex-[2] h-14 rounded-2xl flex-row items-center justify-center gap-2 ${exampleDishes.length > 5 ? 'bg-clay-primary' : 'bg-gray-300'}`}
                                onPress={() => setStep(5)}
                                disabled={exampleDishes.length <= 5}
                            >
                                <Text className="text-white font-bold text-base font-sans-bold">Final Step</Text>
                                <ChevronRight size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View>
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-6">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-clay-primary' : 'bg-gray-200'}`} />
                                ))}
                            </View>
                            <View className="w-16 h-16 bg-kente-yellow/20 rounded-2xl items-center justify-center mb-6 border border-kente-yellow/30">
                                <Shield size={32} color="#D65A31" />
                            </View>
                            <Text className="text-2xl font-bold text-text-main mb-2 font-sans-bold">Trusted Kitchen Agreement</Text>
                            <Text className="text-sm text-text-sub font-sans">By applying to cook on YɛnDidii, you agree to our quality and safety standards.</Text>
                        </View>

                        <View className="bg-orange-50 p-6 rounded-3xl border border-orange-100 mb-8">
                            <Text className="text-clay-primary text-sm leading-6 font-sans mb-4">
                                • You agree to host clean, high-quality cooking sessions.{"\n"}
                                • You understand that sessions require a minimum number of participants.{"\n"}
                                • You will accurately represent your dishes in every pot.
                            </Text>
                        </View>

                        <TouchableOpacity
                            className={`h-14 rounded-2xl flex-row items-center justify-center gap-2 mb-4 ${!loading ? 'bg-clay-primary' : 'bg-gray-300'}`}
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
                            className="h-14 items-center justify-center mb-10"
                            onPress={() => setStep(4)}
                            disabled={loading}
                        >
                            <Text className="text-text-sub font-bold font-sans-bold">Go Back</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
            </View>
        </SafeAreaView>
    );
}
