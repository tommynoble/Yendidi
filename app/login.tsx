import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, TextInput,
    KeyboardAvoidingView, Platform, Alert,
    ActivityIndicator, Pressable, Modal, FlatList, Animated, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Mail, Search, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '@/components/ui/Button';
import ProcessLoader from '@/components/ProcessLoader';
import { hasPrimedPermissions } from '@/lib/permissionsOnboarding';
import { palette, type, fonts } from '@/constants/theme';

const COUNTRIES = [
    { code: '+233', flag: '🇬🇭', name: 'Ghana' },
    { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
    { code: '+254', flag: '🇰🇪', name: 'Kenya' },
    { code: '+256', flag: '🇺🇬', name: 'Uganda' },
    { code: '+255', flag: '🇹🇿', name: 'Tanzania' },
    { code: '+27', flag: '🇿🇦', name: 'South Africa' },
    { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
    { code: '+221', flag: '🇸🇳', name: 'Senegal' },
    { code: '+237', flag: '🇨🇲', name: 'Cameroon' },
    { code: '+228', flag: '🇹🇬', name: 'Togo' },
    { code: '+229', flag: '🇧🇯', name: 'Benin' },
    { code: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
    { code: '+1', flag: '🇺🇸', name: 'United States' },
    { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
    { code: '+49', flag: '🇩🇪', name: 'Germany' },
    { code: '+33', flag: '🇫🇷', name: 'France' },
    { code: '+39', flag: '🇮🇹', name: 'Italy' },
    { code: '+34', flag: '🇪🇸', name: 'Spain' },
    { code: '+31', flag: '🇳🇱', name: 'Netherlands' },
    { code: '+46', flag: '🇸🇪', name: 'Sweden' },
    { code: '+47', flag: '🇳🇴', name: 'Norway' },
    { code: '+61', flag: '🇦🇺', name: 'Australia' },
    { code: '+86', flag: '🇨🇳', name: 'China' },
    { code: '+91', flag: '🇮🇳', name: 'India' },
    { code: '+81', flag: '🇯🇵', name: 'Japan' },
    { code: '+971', flag: '🇦🇪', name: 'UAE' },
    { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
    { code: '+55', flag: '🇧🇷', name: 'Brazil' },
    { code: '+52', flag: '🇲🇽', name: 'Mexico' },
];

// Lets the in-app browser close itself when Google sends the person back to the app.
WebBrowser.maybeCompleteAuthSession();

// Phone (SMS) sign-in is switched off for now: only email and Google show. Set to true to bring the Phone tab back.
const PHONE_SIGN_IN_ENABLED = false;

type AuthMode = 'phone' | 'otp' | 'name' | 'splash';
type AuthMethod = 'phone' | 'email';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function AuthScreen() {
    const router = useRouter();
    const { setCookMode, setUserName: setStoreName } = useAppStore();
    const [googleLoading, setGoogleLoading] = useState(false);
    const [mode, setMode] = useState<AuthMode>('phone');
    const [authMethod, setAuthMethod] = useState<AuthMethod>(PHONE_SIGN_IN_ENABLED ? 'phone' : 'email');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [lastSentPhone, setLastSentPhone] = useState<string | null>(null);
    const [lastSentEmail, setLastSentEmail] = useState<string | null>(null);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoVerifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [userName, setUserName] = useState('');
    const splashOpacity = useRef(new Animated.Value(0)).current;
    const splashScale = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        AsyncStorage.getItem('lastPhoneNumber').then(saved => {
            if (saved) setPhoneNumber(saved);
        });
        AsyncStorage.getItem('lastEmail').then(saved => {
            if (saved) setEmail(saved);
        });
    }, []);

    const filteredCountries = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.includes(countrySearch)
    );

    const otpRefs = React.useRef<(TextInput | null)[]>([]);

    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            if (autoVerifyTimerRef.current) clearTimeout(autoVerifyTimerRef.current);
        };
    }, []);

    const startCooldown = () => {
        setResendCooldown(60);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
            setResendCooldown((prev) => {
                if (prev <= 1) {
                    if (cooldownRef.current) clearInterval(cooldownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleOtpChange = (value: string, index: number) => {
        if (value.length > 1) {
            const digits = value.replace(/\D/g, '').slice(0, 6).split('');
            const newOtp = [...otp];
            digits.forEach((digit, i) => { if (i < 6) newOtp[i] = digit; });
            setOtp(newOtp);
            if (digits.length === 6) otpRefs.current[5]?.focus();
            else otpRefs.current[Math.min(digits.length, 5)]?.focus();
            return;
        }
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    };

    useEffect(() => {
        if (autoVerifyTimerRef.current) clearTimeout(autoVerifyTimerRef.current);
        if (otp.every(digit => digit !== '') && otp.join('').length === 6 && mode === 'otp' && !loading) {
            autoVerifyTimerRef.current = setTimeout(() => {
                handleVerifyCode().catch(() => {});
            }, 600);
        }
        return () => { if (autoVerifyTimerRef.current) clearTimeout(autoVerifyTimerRef.current); };
    }, [otp, mode]);

    const formatPhoneDisplay = (phone: string) => {
        if (phone.length <= 3) return phone;
        if (phone.length <= 6) return `${phone.slice(0, 3)} ${phone.slice(3)}`;
        return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
    };

    const getFullPhoneNumber = () => {
        let clean = phoneNumber.replace(/\D/g, '');
        clean = clean.replace(/^0+/, '');
        return `${selectedCountry.code}${clean}`;
    };

    const handleSendCode = async () => {
        if (authMethod === 'phone') {
            if (phoneNumber.length < 9 || resendCooldown > 0) return;
        } else {
            if (!isValidEmail(email) || resendCooldown > 0) return;
        }
        setLoading(true);
        try {
            if (authMethod === 'phone') {
                const fullPhone = getFullPhoneNumber();
                const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
                if (error) throw error;
                AsyncStorage.setItem('lastPhoneNumber', phoneNumber);
                setLastSentPhone(fullPhone);
            } else {
                const { error } = await supabase.auth.signInWithOtp({ email });
                if (error) throw error;
                AsyncStorage.setItem('lastEmail', email);
                setLastSentEmail(email);
            }
            setMode('otp');
            startCooldown();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send code');
        } finally {
            setLoading(false);
        }
    };

    // Where a freshly signed-in person goes next. Shared by the code sign-in and Google sign-in.
    // `googleName` is the name Google gave us, used so Google sign-ups aren't asked for it again.
    const routeAfterSignIn = async (authUser: User, googleName?: string) => {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('full_name, role, cook_application_status')
            .eq('id', authUser.id)
            .single();
        if (profileError && profileError.code !== 'PGRST116') console.error('Profile Fetch Error:', profileError);
        let fullName: string | null | undefined = profile?.full_name;
        if (!fullName && googleName) {
            const { error } = await supabase.from('profiles').upsert({
                id: authUser.id, full_name: googleName, role: 'EATER', updated_at: new Date(),
            });
            if (!error) fullName = googleName;
        }
        // First ever sign-in: the account was confirmed (by this very code) moments ago. Decided from the auth record,
        // not from the profile, because a profile row can already exist with a name for a brand-new account
        // (e.g. one created automatically), which used to send new people straight into the app.
        const confirmedAt = authUser.email_confirmed_at || authUser.phone_confirmed_at || authUser.confirmed_at;
        const isFirstSignIn = !!confirmedAt && !!authUser.last_sign_in_at
            && Math.abs(new Date(authUser.last_sign_in_at).getTime() - new Date(confirmedAt).getTime()) < 2 * 60 * 1000;

        if (fullName && isFirstSignIn) {
            // Brand-new account that already has a name: skip the name step, but still run the onboarding questions.
            setStoreName(fullName);
            setCookMode(false);
            setTimeout(() => { router.replace('/onboarding/preferences'); }, 100);
        } else if (fullName) {
            setStoreName(fullName);
            setCookMode(false);
            const primed = await hasPrimedPermissions();
            setTimeout(() => { router.replace(primed ? '/(tabs)' : '/onboarding/permissions'); }, 100);
        } else {
            setMode('name');
        }
    };

    // WhatsApp and Apple sign-in are in the design but not built yet.
    const handleComingSoon = (name: string) => {
        Alert.alert('Coming soon', `${name} sign-in isn't available yet. Please continue with Google or your email.`);
    };

    const handleGoogleSignIn = async () => {
        if (googleLoading || loading) return;
        setGoogleLoading(true);
        try {
            const redirectTo = Linking.createURL('auth/callback');
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo, skipBrowserRedirect: true },
            });
            if (error || !data?.url) throw error || new Error('Could not start Google sign-in');

            const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
            if (result.type !== 'success') return; // closed or cancelled: nothing to do

            // Supabase hands the session back either as ?code=... or as #access_token=...&refresh_token=...
            const [beforeHash, hash = ''] = result.url.split('#');
            const query = new URLSearchParams(beforeHash.split('?')[1] || '');
            const fragment = new URLSearchParams(hash);
            const failure = query.get('error_description') || fragment.get('error_description');
            if (failure) throw new Error(failure);

            let session = null;
            const code = query.get('code');
            const accessToken = fragment.get('access_token');
            const refreshToken = fragment.get('refresh_token');
            if (code) {
                const exchanged = await supabase.auth.exchangeCodeForSession(code);
                if (exchanged.error) throw exchanged.error;
                session = exchanged.data.session;
            } else if (accessToken && refreshToken) {
                const set = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
                if (set.error) throw set.error;
                session = set.data.session;
            }
            if (!session?.user) throw new Error('Google sign-in did not finish. Please try again.');

            const meta = session.user.user_metadata || {};
            const googleName = String(meta.full_name || meta.name || '').trim() || undefined;
            await routeAfterSignIn(session.user, googleName);
        } catch (error: any) {
            Alert.alert('Google sign-in failed', error?.message || 'Please try again, or use a code instead.');
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const token = otp.join('');
            const { data, error } = authMethod === 'phone'
                ? await supabase.auth.verifyOtp({ phone: lastSentPhone || getFullPhoneNumber(), token, type: 'sms' })
                : await supabase.auth.verifyOtp({ email: lastSentEmail || email, token, type: 'email' });
            if (error) throw error;
            if (data.session?.user) await routeAfterSignIn(data.session.user);
        } catch (error: any) {
            Alert.alert('Incorrect Code', `That code didn't work. Check your ${authMethod === 'phone' ? 'messages' : 'inbox'} and try again.`, [
                { text: 'Clear & Retry', onPress: () => { setOtp(['', '', '', '', '', '']); setTimeout(() => otpRefs.current[0]?.focus(), 100); } },
                { text: 'OK', style: 'cancel' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteProfile = useCallback(async (first: string, last: string) => {
        const fullName = `${first} ${last}`.trim();
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');
            setUserName(fullName);
            setStoreName(fullName);
            const { error } = await supabase.from('profiles').upsert({
                id: user.id, full_name: fullName, phone: authMethod === 'phone' ? getFullPhoneNumber() : null, role: 'EATER', updated_at: new Date(),
            });
            if (error) throw error;
            setCookMode(false);
            setMode('splash');
            Animated.parallel([
                Animated.timing(splashOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.spring(splashScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
            ]).start();
            // New sign-ups answer a few taste questions first; that screen then continues on to permissions / the app.
            setTimeout(() => { router.replace('/onboarding/preferences'); }, 2500);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    }, [phoneNumber, authMethod]);

    const handleBackToOtp = useCallback(() => setMode('otp'), []);

    return (
        <>
            <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }} edges={['top', 'bottom']}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>

                        {mode === 'phone' ? (
                            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
                                <TouchableOpacity style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 20 }} onPress={() => router.back()}>
                                    <ArrowLeft size={24} color="#2D241E" />
                                </TouchableOpacity>

                                <Text style={{ ...type.hero, color: palette.ink, marginBottom: 6, letterSpacing: -0.3 }}>
                                    {authMethod === 'phone' ? 'Enter your number' : 'Enter your email'}
                                </Text>
                                <Text style={{ ...type.card, fontFamily: fonts.regular, color: palette.muted, marginBottom: 24 }}>We'll send you a verification code</Text>

                                <TouchableOpacity
                                    onPress={() => handleComingSoon('WhatsApp')}
                                    activeOpacity={0.85}
                                    style={{ height: 56, borderRadius: 16, backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
                                >
                                    <Svg width={22} height={22} viewBox="77 212 20 21">
                                        <Path d="M87.1001 212.61C81.6401 212.61 77.1901 217.06 77.1901 222.52C77.1901 224.27 77.6501 225.97 78.5101 227.47L77.1101 232.61L82.3601 231.23C83.8101 232.02 85.4401 232.44 87.1001 232.44C92.5601 232.44 97.0101 227.99 97.0101 222.53C97.0101 219.88 95.9801 217.39 94.1101 215.52C92.2582 213.649 89.7324 212.601 87.1001 212.61ZM87.1101 214.28C89.3101 214.28 91.3701 215.14 92.9301 216.7C94.4764 218.246 95.3436 220.344 95.3401 222.53C95.3401 227.07 91.6401 230.77 87.1001 230.77C85.6201 230.77 84.1701 230.37 82.9001 229.62L82.6001 229.44L79.4801 230.26L80.3101 227.22L80.1101 226.91C79.2839 225.599 78.847 224.08 78.8501 222.53C78.8501 217.99 82.5501 214.29 87.0901 214.29L87.1101 214.28ZM91.6301 225.94C91.3801 225.81 90.1601 225.22 89.9301 225.13C89.7001 225.05 89.5401 225 89.3701 225.26C89.2001 225.51 88.7301 226.07 88.5801 226.23C88.4401 226.4 88.2901 226.42 88.0401 226.29C87.7901 226.16 86.9801 225.9 86.0101 225.04C85.2601 224.37 84.7501 223.54 84.6001 223.29C84.4601 223.04 84.5801 222.9 84.7101 222.78C84.8201 222.67 84.9601 222.49 85.0801 222.34C85.2101 222.2 85.2501 222.09 85.3301 221.92C85.4101 221.75 85.3701 221.61 85.3101 221.48C85.2501 221.35 84.7501 220.13 84.5401 219.63C84.3401 219.14 84.1301 219.21 83.9801 219.2H83.5001C83.3301 219.2 83.0601 219.26 82.8301 219.51C82.6001 219.76 81.9501 220.37 81.9501 221.61C81.9501 222.85 82.8501 224.05 82.9801 224.22C83.1101 224.39 84.7501 226.93 87.2801 228.01C87.8801 228.27 88.3501 228.42 88.7201 228.54C89.3301 228.73 89.8801 228.71 90.3201 228.44C90.8101 228.13 91.1301 227.68 91.2401 227.4C91.3601 227.11 91.3601 226.87 91.3201 226.81C91.2901 226.74 91.1201 226.69 90.8701 226.56L91.6301 225.94Z" fill="#FFFFFF" />
                                    </Svg>
                                    <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: '#FFFFFF' }}>Continue with WhatsApp</Text>
                                </TouchableOpacity>

                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                                    <TouchableOpacity
                                        onPress={handleGoogleSignIn}
                                        disabled={googleLoading || loading}
                                        activeOpacity={0.85}
                                        style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(221,193,182,0.6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: googleLoading ? 0.6 : 1 }}
                                    >
                                        <Svg width={20} height={20} viewBox="70.06 292.61 20 20">
                                            <Path d="M88.8601 302.818C88.8601 302.168 88.8017 301.543 88.6934 300.943H80.0601V304.493H84.9934C84.7767 305.635 84.1267 306.602 83.1517 307.252V309.56H86.1267C87.8601 307.96 88.8601 305.61 88.8601 302.818" fill="#4285F4" />
                                            <Path d="M80.06 311.777C82.535 311.777 84.61 310.96 86.1267 309.56L83.1517 307.252C82.335 307.802 81.2934 308.135 80.06 308.135C77.6767 308.135 75.6517 306.527 74.9267 304.36H71.8767V306.727C73.385 309.718 76.4767 311.777 80.06 311.777" fill="#34A853" />
                                            <Path d="M74.9268 304.351C74.7434 303.801 74.6351 303.218 74.6351 302.61C74.6351 302.001 74.7434 301.418 74.9268 300.868V298.493H71.8768C71.2518 299.735 70.8934 301.126 70.8934 302.61C70.8934 304.093 71.2518 305.485 71.8768 306.726L74.2518 304.876L74.9268 304.351" fill="#FBBC05" />
                                            <Path d="M80.06 297.093C81.41 297.093 82.61 297.56 83.5684 298.46L86.1934 295.835C84.6017 294.352 82.535 293.443 80.06 293.443C76.4767 293.443 73.385 295.502 71.8767 298.493L74.9267 300.86C75.6517 298.693 77.6767 297.093 80.06 297.093" fill="#EA4335" />
                                        </Svg>
                                        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.ink }}>Google</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => handleComingSoon('Apple')}
                                        activeOpacity={0.85}
                                        style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(221,193,182,0.6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                                    >
                                        <Svg width={18} height={19} viewBox="258.5 294.5 16 17">
                                            <Path d="M271.862 308.86C271.17 309.893 270.437 310.902 269.32 310.918C268.203 310.943 267.845 310.26 266.578 310.26C265.303 310.26 264.912 310.902 263.853 310.943C262.762 310.985 261.937 309.843 261.237 308.835C259.812 306.777 258.72 302.985 260.187 300.435C260.912 299.168 262.212 298.368 263.62 298.343C264.687 298.327 265.703 299.068 266.362 299.068C267.012 299.068 268.245 298.177 269.537 298.31C270.078 298.335 271.595 298.527 272.57 299.96C272.495 300.01 270.762 301.027 270.778 303.135C270.803 305.652 272.987 306.493 273.012 306.502C272.987 306.56 272.662 307.702 271.862 308.86M269.578 297.927C270.095 297.302 270.445 296.427 270.353 295.552C269.603 295.585 268.703 296.052 268.162 296.677C267.687 297.227 267.278 298.118 267.387 298.977C268.212 299.043 269.062 298.552 269.578 297.927" fill="#231915" />
                                        </Svg>
                                        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.ink }}>Apple</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 24 }}>
                                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(221,193,182,0.5)' }} />
                                    <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.5, color: '#8A7269' }}>OR WITH EMAIL</Text>
                                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(221,193,182,0.5)' }} />
                                </View>

                                {PHONE_SIGN_IN_ENABLED && <View style={{ flexDirection: 'row', backgroundColor: '#F2DFD7', borderRadius: 14, padding: 4, marginBottom: 12 }}>
                                    {(['phone', 'email'] as const).map((methodOption) => (
                                        <TouchableOpacity
                                            key={methodOption}
                                            onPress={() => setAuthMethod(methodOption)}
                                            style={{
                                                flex: 1, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                                                backgroundColor: authMethod === methodOption ? palette.surface : 'transparent',
                                            }}
                                        >
                                            <Text style={{
                                                ...type.body, fontFamily: fonts.semibold,
                                                color: authMethod === methodOption ? palette.ink : palette.muted,
                                            }}>
                                                {methodOption === 'phone' ? 'Phone' : 'Email'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>}

                                {authMethod === 'phone' ? (
                                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                                        <TouchableOpacity
                                            style={{ height: 56, paddingHorizontal: 14, backgroundColor: '#FFF1EC', borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(221,193,182,0.5)' }}
                                            onPress={() => setShowCountryPicker(true)}
                                        >
                                            <Text style={{ fontSize: 18 }}>{selectedCountry.flag}</Text>
                                            <Text style={{ ...type.card, color: palette.ink }}>{selectedCountry.code}</Text>
                                            <Text style={{ color: palette.muted, fontSize: 11 }}>▼</Text>
                                        </TouchableOpacity>

                                        <View style={{ flex: 1, height: 56, backgroundColor: '#FFF1EC', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(221,193,182,0.5)', flexDirection: 'row', alignItems: 'center' }}>
                                            <TextInput
                                                placeholder="24 123 4567"
                                                placeholderTextColor="rgba(138,114,105,0.6)"
                                                keyboardType="phone-pad"
                                                value={formatPhoneDisplay(phoneNumber)}
                                                onChangeText={(text) => setPhoneNumber(text.replace(/\s/g, ''))}
                                                maxLength={15}
                                                style={{ flex: 1, ...type.card, fontFamily: fonts.regular, color: palette.ink }}
                                            />
                                        </View>
                                    </View>
                                ) : (
                                    <View style={{ height: 56, backgroundColor: '#FFF1EC', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(221,193,182,0.5)', flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                        <Mail size={20} color="#8A7269" />
                                        <TextInput
                                            placeholder="name@example.com"
                                            placeholderTextColor="rgba(138,114,105,0.6)"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            value={email}
                                            onChangeText={setEmail}
                                            returnKeyType="go"
                                            onSubmitEditing={handleSendCode}
                                            style={{ flex: 1, ...type.card, fontFamily: fonts.regular, color: palette.ink }}
                                        />
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={handleSendCode}
                                    disabled={loading || (authMethod === 'phone' ? phoneNumber.length < 7 : !isValidEmail(email))}
                                    activeOpacity={0.85}
                                    style={{
                                        height: 56, borderRadius: 16, backgroundColor: palette.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        opacity: (authMethod === 'phone' ? phoneNumber.length < 7 : !isValidEmail(email)) ? 0.55 : 1,
                                        shadowColor: palette.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
                                    }}
                                >
                                    {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                                        <>
                                            <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: '#FFFFFF' }}>
                                                {authMethod === 'phone' ? 'Send Code' : 'Continue with Email'}
                                            </Text>
                                            <ArrowRight size={20} color="#FFFFFF" />
                                        </>
                                    )}
                                </TouchableOpacity>

                                <Text style={{ ...type.body, fontFamily: fonts.regular, color: palette.ink, textAlign: 'center', lineHeight: 22, marginTop: 24, paddingHorizontal: 24 }}>
                                    By continuing, you agree to our{' '}
                                    <Text style={{ fontFamily: fonts.bold, color: '#D4693A' }}>Terms</Text>
                                    {' '}and{' '}
                                    <Text style={{ fontFamily: fonts.bold, color: '#D4693A' }}>Privacy</Text>.
                                </Text>
                            </View>

                        ) : mode === 'otp' ? (
                            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
                                <TouchableOpacity style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 20 }} onPress={() => setMode('phone')}>
                                    <ArrowLeft size={24} color="#2D241E" />
                                </TouchableOpacity>

                                <Text style={{ ...type.hero, color: palette.ink, marginBottom: 6, letterSpacing: -0.3 }}>
                                    {authMethod === 'phone' ? 'Verify your number' : 'Verify your email'}
                                </Text>
                                <Text style={{ ...type.card, fontFamily: fonts.regular, color: palette.muted, marginBottom: 32, lineHeight: 22 }}>
                                    Enter the 6-digit code sent to{'\n'}
                                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: palette.ink }}>
                                        {authMethod === 'phone' ? `${selectedCountry.code} ${formatPhoneDisplay(phoneNumber)}` : email}
                                    </Text>
                                </Text>

                                {/* OTP Grid */}
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 28 }}>
                                    {otp.map((digit, index) => (
                                        <View key={index} style={{ flex: 1, height: 56, backgroundColor: digit ? palette.surface : palette.surface, borderRadius: 14, borderWidth: 1.5, borderColor: digit ? palette.accent : '#DDC1B6', alignItems: 'center', justifyContent: 'center' }}>
                                            <TextInput
                                                ref={ref => { otpRefs.current[index] = ref; }}
                                                value={digit}
                                                onChangeText={(value) => handleOtpChange(value, index)}
                                                keyboardType="number-pad"
                                                maxLength={index === 0 ? 6 : 1}
                                                style={{ ...type.section, color: palette.ink, textAlign: 'center', width: '100%', height: '100%' }}
                                                textContentType="oneTimeCode"
                                                autoComplete="one-time-code"
                                                onKeyPress={({ nativeEvent }) => {
                                                    if (nativeEvent.key === 'Backspace' && !digit && index > 0) otpRefs.current[index - 1]?.focus();
                                                }}
                                            />
                                        </View>
                                    ))}
                                </View>

                                <TouchableOpacity onPress={handleSendCode} disabled={loading || resendCooldown > 0} style={{ marginBottom: 32 }}>
                                    <Text style={{ ...type.body, fontFamily: fonts.semibold, color: resendCooldown > 0 ? palette.muted : palette.accent, textAlign: 'center' }}>
                                        {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
                                    </Text>
                                </TouchableOpacity>

                                <View style={{ flex: 1 }} />

                                <Button
                                    label="Verify"
                                    onPress={handleVerifyCode}
                                    showArrow
                                    loading={loading}
                                    disabled={!otp.every(d => d)}
                                />
                            </View>

                        ) : mode === 'name' ? (
                            <UserProfileForm
                                onBack={handleBackToOtp}
                                onSubmit={handleCompleteProfile}
                                loading={loading}
                            />
                        ) : mode === 'splash' ? (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent }}>
                                <Animated.View style={{ opacity: splashOpacity, transform: [{ scale: splashScale }], alignItems: 'center' }}>
                                    <Text style={{ fontSize: 72, marginBottom: 16 }}>🍽️</Text>
                                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 32, color: 'white', marginBottom: 10, letterSpacing: -0.5 }}>Let's Eat!</Text>
                                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 17, color: 'rgba(255,255,255,0.85)' }}>
                                        Welcome, {userName.split(' ')[0]}!
                                    </Text>
                                </Animated.View>
                            </View>
                        ) : null}
                    </Pressable>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Country Code Picker Modal */}
            <Modal visible={showCountryPicker} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(35,25,21,0.5)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: palette.ink }}>Select Country</Text>
                                <TouchableOpacity onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2DFD7', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={18} color={palette.ink} />
                                </TouchableOpacity>
                            </View>

                            <View style={{ marginHorizontal: 20, marginBottom: 12, height: 48, backgroundColor: palette.surface, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#DDC1B6' }}>
                                <Search size={16} color={palette.muted} />
                                <TextInput
                                    placeholder="Search country..."
                                    placeholderTextColor={palette.muted}
                                    value={countrySearch}
                                    onChangeText={setCountrySearch}
                                    style={{ flex: 1, ...type.card, fontFamily: fonts.regular, color: palette.ink }}
                                    autoCorrect={false}
                                />
                            </View>

                            <FlatList
                                data={filteredCountries}
                                keyExtractor={(item) => item.code + item.name}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: item.code === selectedCountry.code ? palette.surface : 'transparent' }}
                                        onPress={() => { setSelectedCountry(item); setShowCountryPicker(false); setCountrySearch(''); }}
                                    >
                                        <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                                        <Text style={{ flex: 1, ...type.card, fontFamily: fonts.regular, color: palette.ink }}>{item.name}</Text>
                                        <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.muted }}>{item.code}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <ProcessLoader 
                visible={loading} 
                message={
                    mode === 'phone' ? 'Sending Code...' :
                    mode === 'otp' ? 'Verifying Code...' :
                    mode === 'name' ? 'Creating Profile...' :
                    'Please wait...'
                }
            />
        </>
    );
}

const UserProfileForm = React.memo(({ onBack, onSubmit, loading }: { onBack: () => void; onSubmit: (first: string, last: string) => void; loading: boolean }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const isReady = !!firstName && !!lastName && !loading;

    return (
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
            <TouchableOpacity style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 20 }} onPress={onBack}>
                <ArrowLeft size={24} color="#2D241E" />
            </TouchableOpacity>

            <Text style={{ ...type.hero, color: palette.ink, marginBottom: 6, letterSpacing: -0.3 }}>What's your name?</Text>
            <Text style={{ ...type.card, fontFamily: fonts.regular, color: palette.muted, marginBottom: 32 }}>So hosts know who's ordering</Text>

            <View style={{ gap: 12, marginBottom: 32 }}>
                {[
                    { value: firstName, setter: setFirstName, placeholder: 'First name' },
                    { value: lastName, setter: setLastName, placeholder: 'Last name' },
                ].map(({ value, setter, placeholder }) => (
                    <View key={placeholder} style={{ height: 54, backgroundColor: palette.surface, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: value ? palette.accent : '#DDC1B6', justifyContent: 'center' }}>
                        <TextInput
                            placeholder={placeholder}
                            placeholderTextColor={palette.muted}
                            value={value}
                            onChangeText={setter}
                            style={{ ...type.card, fontFamily: fonts.regular, color: palette.ink }}
                        />
                    </View>
                ))}
            </View>

            <View style={{ flex: 1 }} />

            <Button
                label="Let's Eat! 🍽️"
                onPress={() => onSubmit(firstName, lastName)}
                loading={loading}
                disabled={!isReady}
            />
        </View>
    );
});
