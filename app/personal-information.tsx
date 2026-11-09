import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Phone, Mail, Calendar, BadgeCheck, ShieldCheck, Save } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { palette, fonts } from '@/constants/theme';

const fieldBorder = 'rgba(194, 83, 39, 0.25)';
const iconMuted = '#8A7269';

export default function PersonalInformationScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [isApprovedHost, setIsApprovedHost] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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
                .select('full_name, phone, created_at, avatar_url, role, cook_application_status')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            setFullName(data.full_name || '');
            setPhone(data.phone || user.phone || '');
            setEmail(user.email || '');
            setPhoneVerified(!!user.phone_confirmed_at);
            setAvatarUrl(data.avatar_url || null);
            setIsApprovedHost(data.role === 'COOK' && data.cook_application_status === 'approved');
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

        if (!phoneVerified && phone.trim() && phone.replace(/\D/g, '').length < 9) {
            Alert.alert('Check your number', 'Please enter a full phone number.');
            return;
        }

        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            const update: Record<string, any> = { full_name: fullName.trim() };
            if (!phoneVerified) update.phone = phone.trim() || null;

            const { error } = await supabase
                .from('profiles')
                .update(update)
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
            <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: palette.canvas }} edges={['top']}>
                <ActivityIndicator size="large" color={palette.accent} />
            </SafeAreaView>
        );
    }

    const labelStyle = { fontFamily: fonts.bold, fontSize: 14, color: palette.ink };
    const fieldBox = {
        height: 48, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: fieldBorder,
        paddingHorizontal: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    };
    const fieldText = { fontFamily: fonts.regular, fontSize: 15, color: palette.ink, flex: 1 };
    const initial = (fullName.trim()[0] || '?').toUpperCase();
    const since = memberSince
        ? new Date(memberSince).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    return (
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
            <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                {/* Top bar, same as Kitchen Settings and Earnings & Payouts */}
                <View className="px-6 py-4 flex-row items-center justify-between bg-surface border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back" className="w-10 h-10 items-center justify-center -ml-2">
                        <ArrowLeft size={24} color="#2D241E" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-text-main font-sans-bold">Personal Information</Text>
                    <View className="w-10" />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* Heading: same eyebrow + title position as the host payout page */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1, color: palette.muted, textTransform: 'uppercase' }}>Profile credentials</Text>
                            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 18, color: palette.ink }}>Personal Information</Text>
                        </View>
                    </View>

                    {/* Profile card */}
                    <View style={{ borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: fieldBorder, shadowColor: palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3, marginBottom: 24 }}>
                        <View style={{ borderRadius: 16, overflow: 'hidden', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -34, width: 128, height: 128, borderRadius: 64, backgroundColor: palette.accent, opacity: 0.07 }} />
                            <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#FFEDE5', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4 }}>
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: palette.accent }}>{initial}</Text>
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: palette.ink }}>{fullName.trim() || 'Your name'}</Text>
                                {(phoneVerified || isApprovedHost) && (
                                    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#006A3C', borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 }}>
                                        <BadgeCheck size={14} color="#FFFFFF" />
                                        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: '#FFFFFF' }}>Verified</Text>
                                    </View>
                                )}
                                {since && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                        <Calendar size={14} color={palette.accent} />
                                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: palette.muted }}>Member since {since}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Full name (editable) */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={[labelStyle, { marginBottom: 8 }]}>Full Name</Text>
                        <View style={fieldBox}>
                            <User size={20} color={iconMuted} />
                            <TextInput
                                placeholder="Your full name"
                                placeholderTextColor="#9CA3AF"
                                style={[fieldText, { height: 46 }]}
                                value={fullName}
                                onChangeText={setFullName}
                                autoCapitalize="words"
                            />
                        </View>
                    </View>

                    {/* Phone (read-only) */}
                    <View style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={labelStyle}>Phone Number</Text>
                            {phoneVerified && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <ShieldCheck size={16} color="#006A3C" />
                                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: '#006A3C' }}>Verified</Text>
                                </View>
                            )}
                        </View>
                        <View style={fieldBox}>
                            <Phone size={20} color={iconMuted} />
                            {phoneVerified ? (
                                <Text style={fieldText}>{phone}</Text>
                            ) : (
                                <TextInput
                                    placeholder="e.g. 024 123 4567"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="phone-pad"
                                    autoComplete="tel"
                                    maxLength={20}
                                    style={[fieldText, { height: 46 }]}
                                    value={phone}
                                    onChangeText={t => setPhone(t.replace(/[^0-9+\s-]/g, ''))}
                                />
                            )}
                        </View>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted, marginTop: 6, marginLeft: 4 }}>{phoneVerified ? 'To change your phone number, please contact support.' : 'Add your mobile number.'}</Text>
                    </View>

                    {/* Email (read-only, only when the account has one) */}
                    {!!email && (
                        <View style={{ marginBottom: 20 }}>
                            <Text style={[labelStyle, { marginBottom: 8 }]}>Email Address</Text>
                            <View style={fieldBox}>
                                <Mail size={20} color={iconMuted} />
                                <Text numberOfLines={1} style={fieldText}>{email}</Text>
                            </View>
                        </View>
                    )}

                    {/* Save */}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Save changes"
                        style={{ marginTop: 8, height: 52, borderRadius: 8, backgroundColor: palette.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: palette.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 4, opacity: saving ? 0.7 : 1 }}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Save size={20} color="#FFFFFF" />
                                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#FFFFFF' }}>Save Changes</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
