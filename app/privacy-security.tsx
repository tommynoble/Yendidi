import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck, KeyRound, MonitorSmartphone, Smartphone, Mail, Clock, Check, Circle, EyeOff, LogOut, Trash2, TriangleAlert } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { palette, fonts } from '@/constants/theme';

const cardBorder = 'rgba(194, 83, 39, 0.25)';
const fieldBorder = 'rgba(194, 83, 39, 0.14)';
const fieldFill = '#FFF8F5';
const iconMuted = '#8A7269';

const card = {
    borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: cardBorder,
    shadowColor: palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3,
};

const maskPhone = (p: string) => (p.length > 4 ? `${p.slice(0, p.length > 8 ? 4 : 0)} •••••• ${p.slice(-2)}`.trim() : p);

function SectionHeading({ icon: Icon, title, right, color = palette.accent }: { icon: any; title: string; right?: string; color?: string }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon size={18} color={color} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: color === palette.accent ? palette.ink : color }}>{title}</Text>
            </View>
            {!!right && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>{right}</Text>}
        </View>
    );
}

export default function PrivacySecurityScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [signingOutOthers, setSigningOutOthers] = useState(false);
    const [signingOutAll, setSigningOutAll] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [phone, setPhone] = useState('');
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [email, setEmail] = useState('');
    const [lastSignIn, setLastSignIn] = useState<string | null>(null);
    const [idVerified, setIdVerified] = useState(false);
    const [addressConfirmed, setAddressConfirmed] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [hideLandmark, setHideLandmark] = useState(false);

    useEffect(() => {
        loadAccount();
    }, []);

    const loadAccount = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setPhone(user.phone ? (user.phone.startsWith('+') ? user.phone : `+${user.phone}`) : '');
            setPhoneVerified(!!user.phone_confirmed_at);
            setEmail(user.email || '');
            setLastSignIn(user.last_sign_in_at || null);

            const { data } = await supabase
                .from('profiles')
                .select('phone, id_verified, address_confirmed, role, cook_application_status')
                .eq('id', user.id)
                .single();
            if (data) {
                if (!user.phone && data.phone) setPhone(data.phone);
                setIdVerified(!!data.id_verified);
                setAddressConfirmed(!!data.address_confirmed);
                setIsHost(data.role === 'COOK' && data.cook_application_status === 'approved');
            }

            // Needs the kitchen-privacy database update; until it has been run the setting stays off.
            const { data: privacyRow } = await supabase.from('profiles').select('hide_landmark_until_booked').eq('id', user.id).single();
            setHideLandmark(!!privacyRow?.hide_landmark_until_booked);
        } catch (e) {
            // Non-fatal: the actions below still work without the summary.
        } finally {
            setLoading(false);
        }
    };

    const toggleHideLandmark = async (next: boolean) => {
        setHideLandmark(next);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');
            const { error } = await supabase.from('profiles').update({ hide_landmark_until_booked: next }).eq('id', user.id);
            if (error) throw error;
        } catch (e: any) {
            setHideLandmark(!next);
            Alert.alert('Could not save', e.message || 'Your privacy setting could not be saved.');
        }
    };

    const handleSignOutOthers = () => {
        Alert.alert('Sign out other sessions', 'You will stay signed in here. Every other device will need a new one-time code to sign in again.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out Others',
                onPress: async () => {
                    try {
                        setSigningOutOthers(true);
                        const { error } = await supabase.auth.signOut({ scope: 'others' });
                        if (error) throw error;
                        Alert.alert('Done', 'All your other sessions have been signed out.');
                    } catch (e: any) {
                        Alert.alert('Error', e.message);
                    } finally {
                        setSigningOutOthers(false);
                    }
                },
            },
        ]);
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

    // Protection checks come straight from the account: nothing here is a made-up score.
    const checks = [
        { label: 'Phone number verified', ok: phoneVerified },
        { label: 'Email address added', ok: !!email },
        { label: 'ID verified', ok: idVerified },
        ...(isHost ? [{ label: 'Kitchen address confirmed', ok: addressConfirmed }] : []),
    ];
    const passed = checks.filter(c => c.ok).length;
    const level = passed === checks.length
        ? { label: 'High protection', bg: '#6FF2A8', text: '#00522B' }
        : passed >= Math.ceil(checks.length / 2)
            ? { label: 'Good protection', bg: '#FFE9CC', text: '#9A5B00' }
            : { label: 'Needs attention', bg: '#FDEDED', text: '#C62828' };
    const lastSignInLabel = lastSignIn
        ? new Date(lastSignIn).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null;

    return (
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
            <View style={{ flex: 1, backgroundColor: palette.canvas }}>
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between bg-surface border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
                        <ArrowLeft size={24} color="#2D241E" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-text-main font-sans-bold">Privacy & Security</Text>
                    <View className="w-10" />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <ActivityIndicator size="small" color={palette.accent} style={{ marginTop: 32 }} />
                    ) : (
                        <>
                            {/* Account protection */}
                            <View style={{ ...card, marginBottom: 26 }}>
                                <View style={{ borderRadius: 16, overflow: 'hidden', padding: 16 }}>
                                    <View pointerEvents="none" style={{ position: 'absolute', top: -52, right: -44, width: 168, height: 168, borderRadius: 84, backgroundColor: palette.accent, opacity: 0.09 }} />
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#9C3F12', alignItems: 'center', justifyContent: 'center' }}>
                                            <ShieldCheck size={28} color="#FFFFFF" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: palette.ink }}>Account Protection</Text>
                                            <View style={{ alignSelf: 'flex-start', backgroundColor: level.bg, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 }}>
                                                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: level.text }}>{level.label}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: palette.bodyText, marginTop: 12 }}>
                                        {isHost
                                            ? 'Your identity, kitchen address and sign-in are protected by these checks.'
                                            : 'Your identity and sign-in are protected by these checks.'}
                                    </Text>

                                    <View style={{ gap: 10, marginTop: 14, backgroundColor: fieldFill, borderRadius: 12, borderWidth: 1, borderColor: fieldBorder, padding: 14 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.ink }}>Checks passed</Text>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#9C3F12' }}>{passed} of {checks.length}</Text>
                                        </View>
                                        <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E8D5CC', overflow: 'hidden' }}>
                                            <View style={{ width: `${(passed / checks.length) * 100}%`, height: 8, backgroundColor: '#9C3F12' }} />
                                        </View>
                                        {checks.map(c => (
                                            <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                {c.ok
                                                    ? <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#006A3C', alignItems: 'center', justifyContent: 'center' }}><Check size={13} color="#FFFFFF" /></View>
                                                    : <Circle size={20} color="#C9B0A5" />}
                                                <Text style={{ flex: 1, fontFamily: c.ok ? fonts.medium : fonts.regular, fontSize: 13, color: c.ok ? palette.ink : palette.muted }}>{c.label}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* Sign-in */}
                            <View style={{ marginBottom: 26 }}>
                                <SectionHeading icon={KeyRound} title="Sign-in & Access" right="One-time codes" />
                                <View style={{ ...card, padding: 14, gap: 12 }}>
                                    {!!phone && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFDBCD', alignItems: 'center', justifyContent: 'center' }}>
                                                <Smartphone size={20} color="#9C3F12" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.ink }}>SMS one-time code</Text>
                                                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.muted, marginTop: 1 }}>{maskPhone(phone)}</Text>
                                            </View>
                                            {phoneVerified && (
                                                <View style={{ backgroundColor: '#6FF2A8', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                                                    <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#00522B' }}>Verified</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                    {!!email && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFDBCD', alignItems: 'center', justifyContent: 'center' }}>
                                                <Mail size={20} color="#9C3F12" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.ink }}>Email one-time code</Text>
                                                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.muted, marginTop: 1 }}>{email}</Text>
                                            </View>
                                        </View>
                                    )}
                                    <View style={{ backgroundColor: fieldFill, borderRadius: 10, borderWidth: 1, borderColor: fieldBorder, paddingHorizontal: 12, paddingVertical: 10 }}>
                                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: palette.bodyText }}>
                                            YenDidii has no password to steal or guess. Every sign-in needs a fresh code sent to you.
                                        </Text>
                                    </View>
                                    {!!lastSignInLabel && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Clock size={15} color={iconMuted} />
                                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>Last sign-in {lastSignInLabel}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Devices & sessions */}
                            <View style={{ marginBottom: 26 }}>
                                <SectionHeading icon={MonitorSmartphone} title="Devices & Sessions" />
                                <View style={{ ...card, padding: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#D9F7E6', alignItems: 'center', justifyContent: 'center' }}>
                                            <Smartphone size={20} color="#006A3C" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.ink }}>{Platform.OS === 'ios' ? 'iPhone / iPad' : 'Android phone'}</Text>
                                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted, marginTop: 1 }}>YenDidii app · signed in</Text>
                                        </View>
                                        <View style={{ backgroundColor: '#D9F7E6', borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 }}>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#006A3C' }}>This device</Text>
                                        </View>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={handleSignOutOthers}
                                    disabled={signingOutOthers}
                                    activeOpacity={0.8}
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10, backgroundColor: '#FEEAE2', marginTop: 10 }}
                                >
                                    {signingOutOthers ? <ActivityIndicator size="small" color="#794833" /> : <LogOut size={18} color="#794833" />}
                                    <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: '#794833' }}>Sign Out All Other Sessions</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSignOutAllDevices}
                                    disabled={signingOutAll}
                                    activeOpacity={0.8}
                                    style={{ alignItems: 'center', justifyContent: 'center', height: 40, marginTop: 4 }}
                                >
                                    {signingOutAll
                                        ? <ActivityIndicator size="small" color={palette.accent} />
                                        : <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: palette.muted }}>Sign out of all devices, including this one</Text>}
                                </TouchableOpacity>
                            </View>

                            {/* Kitchen privacy (hosts only) */}
                            {isHost && (
                                <View style={{ marginBottom: 26 }}>
                                    <SectionHeading icon={EyeOff} title="Kitchen Privacy" />
                                    <View style={{ ...card, padding: 14 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFDBCD', alignItems: 'center', justifyContent: 'center' }}>
                                                <EyeOff size={20} color="#9C3F12" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.ink }}>Kitchen Door Cloaking</Text>
                                                <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: palette.muted, marginTop: 2 }}>
                                                    Hide your nearby-landmark line from guests until they have a confirmed booking with you.
                                                </Text>
                                            </View>
                                            <Switch
                                                value={hideLandmark}
                                                onValueChange={toggleHideLandmark}
                                                trackColor={{ false: '#E3CFC7', true: '#B85226' }}
                                                thumbColor="#FFFFFF"
                                                ios_backgroundColor="#E3CFC7"
                                            />
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Account operations */}
                            <View style={{ marginBottom: 8 }}>
                                <SectionHeading icon={TriangleAlert} title="Account Operations" color="#C62828" />
                                <View style={{ ...card, borderColor: '#F5D5D5', padding: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#C62828' }}>Delete Account</Text>
                                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: palette.muted, marginTop: 2 }}>
                                                Permanently erase your account, orders, listings and reviews.
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={handleDeleteAccount}
                                            disabled={deleting}
                                            activeOpacity={0.8}
                                            accessibilityRole="button"
                                            accessibilityLabel="Delete account"
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FDEDED', borderRadius: 9999, paddingHorizontal: 14, height: 34 }}
                                        >
                                            {deleting ? <ActivityIndicator size="small" color="#C62828" /> : <Trash2 size={15} color="#C62828" />}
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#C62828' }}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
