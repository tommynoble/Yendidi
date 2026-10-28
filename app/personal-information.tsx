import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Phone, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function PersonalInformationScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [memberSince, setMemberSince] = useState<string | null>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, phone, created_at')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            setFullName(data.full_name || '');
            setPhone(data.phone || user.phone || '');
            setMemberSince(data.created_at || null);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!fullName.trim()) {
            Alert.alert('Name Required', 'Please enter your full name.');
            return;
        }

        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName.trim() })
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert('Saved', 'Your information has been updated.');
            router.back();
        } catch (e: any) {
            Alert.alert('Error', e.message);
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
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
            <View className="flex-1 bg-warm-cream">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between bg-surface border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
                        <ArrowLeft size={24} color="#2D241E" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-text-main font-sans-bold">Personal Information</Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving} className="px-4 py-2 bg-clay-primary rounded-xl">
                        {saving ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Text className="text-white font-bold font-sans-bold text-sm">Save</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                    {/* Full Name */}
                    <View className="bg-surface p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                        <View className="flex-row items-center gap-2 mb-4">
                            <User size={20} color="#D65A31" />
                            <Text className="text-xs font-bold text-text-main uppercase tracking-widest font-sans-bold">Full Name</Text>
                        </View>
                        <TextInput
                            placeholder="Your full name"
                            placeholderTextColor="#9CA3AF"
                            className="h-14 bg-gray-50 rounded-xl px-4 font-sans text-text-main border border-gray-200 text-base"
                            value={fullName}
                            onChangeText={setFullName}
                            autoCapitalize="words"
                        />
                    </View>

                    {/* Phone (read-only) */}
                    <View className="bg-surface p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                        <View className="flex-row items-center gap-2 mb-4">
                            <Phone size={20} color="#D65A31" />
                            <Text className="text-xs font-bold text-text-main uppercase tracking-widest font-sans-bold">Phone Number</Text>
                        </View>
                        <View className="h-14 bg-gray-50 rounded-xl px-4 border border-gray-200 justify-center">
                            <Text className="text-text-main font-sans text-base">{phone || 'Not set'}</Text>
                        </View>
                        <Text className="text-[11px] text-text-sub font-sans mt-1.5">To change your phone number, please contact support.</Text>
                    </View>

                    {/* Member since (read-only) */}
                    {memberSince && (
                        <View className="bg-surface p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Calendar size={20} color="#D65A31" />
                                <Text className="text-xs font-bold text-text-main uppercase tracking-widest font-sans-bold">Member Since</Text>
                            </View>
                            <Text className="text-text-main font-sans text-base">
                                {new Date(memberSince).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </Text>
                        </View>
                    )}

                    <View className="h-10" />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
