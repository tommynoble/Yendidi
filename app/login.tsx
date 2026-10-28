import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, TextInput,
    KeyboardAvoidingView, Platform, Alert,
    ActivityIndicator, Pressable, Modal, FlatList, Animated, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, ArrowRight, ChevronLeft, Search, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '@/components/ui/Button';
import ProcessLoader from '@/components/ProcessLoader';
import { hasPrimedPermissions } from '@/lib/permissionsOnboarding';

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

type AuthMode = 'phone' | 'otp' | 'name' | 'splash';
type AuthMethod = 'phone' | 'email';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function AuthScreen() {
    const router = useRouter();
    const { setCookMode, setUserName: setStoreName } = useAppStore();
    const [mode, setMode] = useState<AuthMode>('phone');
    const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
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

    const handleVerifyCode = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const token = otp.join('');
            const { data, error } = authMethod === 'phone'
                ? await supabase.auth.verifyOtp({ phone: lastSentPhone || getFullPhoneNumber(), token, type: 'sms' })
                : await supabase.auth.verifyOtp({ email: lastSentEmail || email, token, type: 'email' });
            if (error) throw error;
            if (data.session?.user) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('full_name, role, cook_application_status')
                    .eq('id', data.session.user.id)
                    .single();
                if (profileError && profileError.code !== 'PGRST116') console.error('Profile Fetch Error:', profileError);
                if (profile?.full_name) {
                    setStoreName(profile.full_name);
                    setCookMode(false);
                    const primed = await hasPrimedPermissions();
                    setTimeout(() => { router.replace(primed ? '/(tabs)' : '/onboarding/permissions'); }, 100);
                } else {
                    setMode('name');
                }
            }
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
            const primed = await hasPrimedPermissions();
            setTimeout(() => { router.replace(primed ? '/(tabs)' : '/onboarding/permissions'); }, 2500);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    }, [phoneNumber, authMethod]);

    const handleBackToOtp = useCallback(() => setMode('otp'), []);

    return (
        <>
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F8E4DD' }} edges={['top', 'bottom']}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>

                        {mode === 'phone' ? (
                            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
                                <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2DFD7', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }} onPress={() => router.back()}>
                                    <ChevronLeft size={22} color="#231915" />
                                </TouchableOpacity>

                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: '#231915', marginBottom: 6, letterSpacing: -0.3 }}>
                                    {authMethod === 'phone' ? 'Enter your number' : 'Enter your email'}
                                </Text>
                                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#56423B', marginBottom: 20 }}>We'll send you a verification code</Text>

                                <View style={{ flexDirection: 'row', backgroundColor: '#F2DFD7', borderRadius: 14, padding: 4, marginBottom: 20 }}>
                                    {(['phone', 'email'] as const).map((methodOption) => (
                                        <TouchableOpacity
                                            key={methodOption}
                                            onPress={() => setAuthMethod(methodOption)}
                                            style={{
                                                flex: 1, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                                                backgroundColor: authMethod === methodOption ? '#F7EEE7' : 'transparent',
                                            }}
                                        >
                                            <Text style={{
                                                fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14,
                                                color: authMethod === methodOption ? '#231915' : '#8A7269',
                                            }}>
                                                {methodOption === 'phone' ? 'Phone' : 'Email'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {authMethod === 'phone' ? (
                                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                                        <TouchableOpacity
                                            style={{ height: 54, paddingHorizontal: 14, backgroundColor: '#F7EEE7', borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#DDC1B6' }}
                                            onPress={() => setShowCountryPicker(true)}
                                        >
                                            <Text style={{ fontSize: 18 }}>{selectedCountry.flag}</Text>
                                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: '#231915' }}>{selectedCountry.code}</Text>
                                            <Text style={{ color: '#8A7269', fontSize: 11 }}>▼</Text>
                                        </TouchableOpacity>

                                        <View style={{ flex: 1, height: 54, backgroundColor: '#F7EEE7', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#DDC1B6', flexDirection: 'row', alignItems: 'center' }}>
                                            <TextInput
                                                placeholder="24 123 4567"
                                                placeholderTextColor="#8A7269"
                                                keyboardType="phone-pad"
                                                value={formatPhoneDisplay(phoneNumber)}
                                                onChangeText={(text) => setPhoneNumber(text.replace(/\s/g, ''))}
                                                maxLength={15}
                                                style={{ flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, color: '#231915' }}
                                            />
                                        </View>
                                    </View>
                                ) : (
                                    <View style={{ height: 54, backgroundColor: '#F7EEE7', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#DDC1B6', flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                        <TextInput
                                            placeholder="you@example.com"
                                            placeholderTextColor="#8A7269"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            value={email}
                                            onChangeText={setEmail}
                                            style={{ flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, color: '#231915' }}
                                        />
                                    </View>
                                )}

                                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#8A7269', marginBottom: 20 }}>
                                    {authMethod === 'phone' ? 'Standard SMS rates may apply' : "We'll email you a 6-digit code"}
                                </Text>

                                <View style={{ flex: 1 }} />

                                <Button
                                    label="Send Code"
                                    onPress={handleSendCode}
                                    showArrow
                                    loading={loading}
                                    disabled={authMethod === 'phone' ? phoneNumber.length < 7 : !isValidEmail(email)}
                                />
                            </View>

                        ) : mode === 'otp' ? (
                            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
                                <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2DFD7', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }} onPress={() => setMode('phone')}>
                                    <ChevronLeft size={22} color="#231915" />
                                </TouchableOpacity>

                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: '#231915', marginBottom: 6, letterSpacing: -0.3 }}>
                                    {authMethod === 'phone' ? 'Verify your number' : 'Verify your email'}
                                </Text>
                                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#56423B', marginBottom: 32, lineHeight: 22 }}>
                                    Enter the 6-digit code sent to{'\n'}
                                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#231915' }}>
                                        {authMethod === 'phone' ? `${selectedCountry.code} ${formatPhoneDisplay(phoneNumber)}` : email}
                                    </Text>
                                </Text>

                                {/* OTP Grid */}
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 28 }}>
                                    {otp.map((digit, index) => (
                                        <View key={index} style={{ flex: 1, height: 56, backgroundColor: digit ? '#FFF1EC' : '#F7EEE7', borderRadius: 14, borderWidth: 1.5, borderColor: digit ? '#BF592B' : '#DDC1B6', alignItems: 'center', justifyContent: 'center' }}>
                                            <TextInput
                                                ref={ref => { otpRefs.current[index] = ref; }}
                                                value={digit}
                                                onChangeText={(value) => handleOtpChange(value, index)}
                                                keyboardType="number-pad"
                                                maxLength={index === 0 ? 6 : 1}
                                                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#231915', textAlign: 'center', width: '100%', height: '100%' }}
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
                                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: resendCooldown > 0 ? '#8A7269' : '#BF592B', textAlign: 'center' }}>
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
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#BF592B' }}>
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
                        <View style={{ backgroundColor: '#FFF8F6', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#231915' }}>Select Country</Text>
                                <TouchableOpacity onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2DFD7', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={18} color="#231915" />
                                </TouchableOpacity>
                            </View>

                            <View style={{ marginHorizontal: 20, marginBottom: 12, height: 48, backgroundColor: '#F7EEE7', borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#DDC1B6' }}>
                                <Search size={16} color="#8A7269" />
                                <TextInput
                                    placeholder="Search country..."
                                    placeholderTextColor="#8A7269"
                                    value={countrySearch}
                                    onChangeText={setCountrySearch}
                                    style={{ flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#231915' }}
                                    autoCorrect={false}
                                />
                            </View>

                            <FlatList
                                data={filteredCountries}
                                keyExtractor={(item) => item.code + item.name}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: item.code === selectedCountry.code ? '#FFF1EC' : 'transparent' }}
                                        onPress={() => { setSelectedCountry(item); setShowCountryPicker(false); setCountrySearch(''); }}
                                    >
                                        <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                                        <Text style={{ flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#231915' }}>{item.name}</Text>
                                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#56423B' }}>{item.code}</Text>
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
            <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2DFD7', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }} onPress={onBack}>
                <ChevronLeft size={22} color="#231915" />
            </TouchableOpacity>

            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: '#231915', marginBottom: 6, letterSpacing: -0.3 }}>What's your name?</Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#56423B', marginBottom: 32 }}>So hosts know who's ordering</Text>

            <View style={{ gap: 12, marginBottom: 32 }}>
                {[
                    { value: firstName, setter: setFirstName, placeholder: 'First name' },
                    { value: lastName, setter: setLastName, placeholder: 'Last name' },
                ].map(({ value, setter, placeholder }) => (
                    <View key={placeholder} style={{ height: 54, backgroundColor: '#F7EEE7', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: value ? '#BF592B' : '#DDC1B6', justifyContent: 'center' }}>
                        <TextInput
                            placeholder={placeholder}
                            placeholderTextColor="#8A7269"
                            value={value}
                            onChangeText={setter}
                            style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, color: '#231915' }}
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
