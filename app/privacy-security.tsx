import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Phone, BadgeCheck, Calendar, LogOut, Trash2, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function PrivacySecurityScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [signingOutAll, setSigningOutAll] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [phone, setPhone] = useState('');
    const [verified, setVerified] = useState(false);
    const [memberSince, setMemberSince] = useState<string | null>(null);

    useEffect(() => {
        loadAccount();
    }, []);

    const loadAccount = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('phone, verified, created_at')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            setPhone(data.phone || user.phone || '');
            setVerified(!!data.verified);
            setMemberSince(data.created_at || null);
        } catch (e) {
            // Non-fatal — actions below still work without the summary card.
        } finally {
            setLoading(false);
        }
    };

    const handleSignOutAllDevices = () => {
        Alert.alert(
            'Sign Out Everywhere',
            'This will sign you out on every device where you\'re logged in, including this one.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out Everywhere',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setSigningOutAll(true);
                            const { error } = await supabase.auth.signOut({ scope: 'global' });
                            if (error) throw error;
                            router.replace('/onboarding/community');
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                            setSigningOutAll(false);
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This permanently deletes your account, orders, listings, and reviews. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Are you absolutely sure?',
                            'Your account and all associated data will be permanently erased.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Delete My Account',
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            setDeleting(true);
                                            const { error } = await supabase.rpc('delete_user_account');
                                            if (error) throw error;
                                            await supabase.auth.signOut();
                                            router.replace('/onboarding/community');
                                        } catch (e: any) {
                                            Alert.alert('Error', e.message);
                                            setDeleting(false);
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
            <View className="flex-1 bg-warm-cream">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center gap-3 bg-surface border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
                        <ArrowLeft size={24} color="#2D241E" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-text-main font-sans-bold">Privacy & Security</Text>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <ActivityIndicator size="small" color="#D65A31" style={{ marginTop: 20 }} />
                    ) : (
                        <View className="bg-surface p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                            <Text className="text-xs font-bold text-text-main mb-4 uppercase tracking-widest font-sans-bold">Account</Text>

                            <View className="flex-row items-center gap-3 mb-4">
                                <Phone size={18} color="#8A7269" />
                                <Text className="text-text-main font-sans text-sm flex-1">{phone || 'Not set'}</Text>
                            </View>

                            <View className="flex-row items-center gap-3 mb-4">
                                <BadgeCheck size={18} color={verified ? '#2E7D32' : '#8A7269'} />
                                <Text className="text-text-main font-sans text-sm flex-1">
                                    {verified ? 'Verified account' : 'Not yet verified'}
                                </Text>
                            </View>

                            {memberSince && (
                                <View className="flex-row items-center gap-3">
                                    <Calendar size={18} color="#8A7269" />
                                    <Text className="text-text-main font-sans text-sm flex-1">
                                        Member since {new Date(memberSince).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Security actions */}
                    <View className="bg-surface rounded-3xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
                        <TouchableOpacity
                            onPress={handleSignOutAllDevices}
                            disabled={signingOutAll}
                            className="flex-row items-center gap-3 px-6 py-4"
                            activeOpacity={0.7}
                        >
                            <LogOut size={18} color="#2D241E" />
                            <Text className="text-text-main font-sans-bold text-sm flex-1">Sign Out of All Devices</Text>
                            {signingOutAll ? <ActivityIndicator size="small" color="#D65A31" /> : <ChevronRight size={18} color="#C9BDB6" />}
                        </TouchableOpacity>
                    </View>

                    {/* Danger zone */}
                    <View className="bg-surface rounded-3xl border border-[#F5D5D5] shadow-sm mb-6 overflow-hidden">
                        <TouchableOpacity
                            onPress={handleDeleteAccount}
                            disabled={deleting}
                            className="flex-row items-center gap-3 px-6 py-4"
                            activeOpacity={0.7}
                        >
                            <Trash2 size={18} color="#C62828" />
                            <Text className="text-[#C62828] font-sans-bold text-sm flex-1">Delete Account</Text>
                            {deleting ? <ActivityIndicator size="small" color="#C62828" /> : <ChevronRight size={18} color="#E8B4B4" />}
                        </TouchableOpacity>
                    </View>

                    <View className="h-10" />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
