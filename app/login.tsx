import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Pressable, Modal, FlatList, Animated, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, ArrowRight, ChevronLeft, Shield, Users, MapPin, Search, X, UtensilsCrossed, ChefHat } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';

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

type AuthMode = 'welcome' | 'phone' | 'otp' | 'name' | 'splash';

export default function AuthScreen() {
    const router = useRouter();
    const { setCookMode, setUserName: setStoreName } = useAppStore();
    const [mode, setMode] = useState<AuthMode>('welcome');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [lastSentPhone, setLastSentPhone] = useState<string | null>(null);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [userName, setUserName] = useState('');
    const splashOpacity = useRef(new Animated.Value(0)).current;
    const splashScale = useRef(new Animated.Value(0.8)).current;

    const filteredCountries = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.includes(countrySearch)
    );

    // Refs for OTP inputs
    const otpRefs = React.useRef<(TextInput | null)[]>([]);

    // Cleanup cooldown timer on unmount
    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
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
        // Handle auto-fill/paste of full code
        if (value.length > 1) {
            const pastedCode = value.slice(0, 6).split('');
            const newOtp = [...otp];
            pastedCode.forEach((digit, i) => {
                if (i < 6) newOtp[i] = digit;
            });
            setOtp(newOtp);
            // Focus last input or trigger verify
            if (pastedCode.length === 6) {
                otpRefs.current[5]?.focus();
                // We'll let the useEffect handle auto-triggering verify
            } else {
                otpRefs.current[Math.min(pastedCode.length, 5)]?.focus();
            }
            return;
        }

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    // Auto-verify when OTP is full
    useEffect(() => {
        if (otp.every(digit => digit !== '') && otp.join('').length === 6 && mode === 'otp' && !loading) {
            handleVerifyCode();
        }
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
        if (phoneNumber.length < 9 || resendCooldown > 0) return;
        setLoading(true);
        try {
            const fullPhone = getFullPhoneNumber();
            console.log('Sending OTP to:', fullPhone);
            const { error } = await supabase.auth.signInWithOtp({
                phone: fullPhone,
            });

            console.log('OTP Response:', { error });
            if (error) throw error;
            setLastSentPhone(fullPhone);
            setMode('otp');
            startCooldown();
        } catch (error: any) {
            console.error('OTP Send Error:', error);
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
            const fullPhone = lastSentPhone || getFullPhoneNumber();
            console.log('Verifying:', { fullPhone, token });

            const { data, error } = await supabase.auth.verifyOtp({
                phone: fullPhone,
                token,
                type: 'sms',
            });

            if (error) {
                console.error('Supabase Verify Error:', error);
                throw error;
            }

            // Check if profile exists
            if (data.session?.user) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('full_name, role, cook_application_status')
                    .eq('id', data.session.user.id)
                    .single();

                console.log('Profile check:', { profile, profileError: profileError?.code });

                if (profileError && profileError.code !== 'PGRST116') {
                    console.error('Profile Fetch Error:', profileError);
                }

                if (profile?.full_name) {
                    // Returning user with name — go straight to dashboard
                    console.log('Returning user, going to dashboard:', profile.full_name, profile.role);
                    setStoreName(profile.full_name);
                    
                    // ONLY unlock cook mode if they are a COOK AND they are approved
                    const isApprovedCook = profile.role === 'COOK' && profile.cook_application_status === 'approved';
                    setCookMode(isApprovedCook);
                    
                    setTimeout(() => {
                        router.replace('/(tabs)');
                    }, 100);
                } else {
                    // New user or missing profile — start with name entry
                    console.log('New user or incomplete profile, going to name entry');
                    setMode('name');
                }
            }
        } catch (error: any) {
            console.error('Verify Exception:', error);
            Alert.alert('Error', error.message || 'Invalid code');
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

            const updates = {
                id: user.id,
                full_name: fullName,
                phone: getFullPhoneNumber(),
                role: 'EATER',
                updated_at: new Date(),
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(updates);

            if (error) throw error;

            setCookMode(false);
            setMode('splash');

            Animated.parallel([
                Animated.timing(splashOpacity, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.spring(splashScale, {
                    toValue: 1,
                    friction: 4,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start();

            setTimeout(() => {
                router.replace('/(tabs)');
            }, 2500);

        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    }, [phoneNumber]);

    const handleBackToOtp = useCallback(() => {
        setMode('otp');
    }, []);

    const handleBackToName = useCallback(() => {
        setMode('name');
    }, []);

    return (
        <>
            <SafeAreaView className="flex-1 bg-warm-cream" edges={['top']}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    className="flex-1"
                >
                    <Pressable className="flex-1" onPress={Keyboard.dismiss}>
                        {/* Kente Strip */}
                        <View className="flex-row h-1.5 w-full">
                            <View className="bg-kente-red flex-1" />
                            <View className="bg-kente-yellow flex-1" />
                            <View className="bg-kente-green flex-1" />
                            <View className="bg-text-main flex-1" />
                        </View>

                        {mode === 'welcome' ? (
                            /* WELCOME SCREEN */
                            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                                {/* Hero Image */}
                                <View className="h-72 w-full relative">
                                    <Image
                                        source={{ uri: 'https://media.screensdesign.com/gasset/26737593-9563-4f13-9c77-bc02f46ac242.png' }}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                    <View className="absolute inset-0 bg-gradient-to-t from-warm-cream to-transparent" />
                                </View>

                                <View className="px-8 -mt-8">
                                    {/* Logo/Title */}
                                    <View className="items-center mb-6">
                                        <Text className="text-3xl font-bold text-text-main font-sans-bold">YɛnDidii</Text>
                                        <Text className="text-base text-text-sub font-sans mt-1">Let's eat together 🇬🇭</Text>
                                    </View>

                                    {/* Benefits */}
                                    <View className="gap-4 mb-8">
                                        <View className="flex-row items-center gap-4 bg-white p-4 rounded-2xl" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                                            <View className="w-12 h-12 bg-clay-primary/10 rounded-full items-center justify-center">
                                                <MapPin size={22} color="#D65A31" />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="font-bold text-text-main font-sans-bold">Find Home Cooks Nearby</Text>
                                                <Text className="text-sm text-text-sub font-sans">Authentic Ghanaian meals in your area</Text>
                                            </View>
                                        </View>

                                        <View className="flex-row items-center gap-4 bg-white p-4 rounded-2xl" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                                            <View className="w-12 h-12 bg-kente-green/10 rounded-full items-center justify-center">
                                                <Users size={22} color="#007A33" />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="font-bold text-text-main font-sans-bold">Join the Community</Text>
                                                <Text className="text-sm text-text-sub font-sans">2,000+ cooks & food lovers</Text>
                                            </View>
                                        </View>

                                        <View className="flex-row items-center gap-4 bg-white p-4 rounded-2xl" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                                            <View className="w-12 h-12 bg-kente-yellow/20 rounded-full items-center justify-center">
                                                <Shield size={22} color="#4E342E" />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="font-bold text-text-main font-sans-bold">Safe & Secure</Text>
                                                <Text className="text-sm text-text-sub font-sans">Verified cooks, secure payments</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* CTA Buttons */}
                                    <TouchableOpacity
                                        className="w-full h-14 bg-clay-primary rounded-2xl flex-row items-center justify-center gap-2 mb-4"
                                        onPress={() => setMode('phone')}
                                        style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                                    >
                                        <Phone size={20} color="white" />
                                        <Text className="text-white font-bold text-base font-sans-bold">Continue with Phone</Text>
                                    </TouchableOpacity>



                                    <Text className="text-center text-xs text-text-sub mt-6 mb-8 font-sans">
                                        By continuing, you agree to our Terms of Service and Privacy Policy
                                    </Text>
                                </View>
                            </ScrollView>
                        ) : mode === 'phone' ? (
                            /* PHONE NUMBER SCREEN */
                            <View className="flex-1 px-8 pt-4 pb-8">
                                <TouchableOpacity
                                    className="w-10 h-10 items-center justify-center -ml-2 mb-6"
                                    onPress={() => setMode('welcome')}
                                >
                                    <ChevronLeft size={28} color="#2D241E" />
                                </TouchableOpacity>

                                <Text className="text-2xl font-bold text-text-main mb-2 font-sans-bold">Enter your phone number</Text>
                                <Text className="text-base text-text-sub mb-8 font-sans">We'll send you a verification code</Text>

                                <View className="flex-row items-center gap-3 mb-6">
                                    <TouchableOpacity
                                        className="h-14 px-4 bg-white rounded-2xl flex-row items-center gap-2 border border-gray-200"
                                        onPress={() => setShowCountryPicker(true)}
                                    >
                                        <Text className="text-lg">{selectedCountry.flag}</Text>
                                        <Text className="text-text-main font-semibold font-sans-semibold">{selectedCountry.code}</Text>
                                        <Text className="text-gray-400 text-xs">▼</Text>
                                    </TouchableOpacity>

                                    <View className="flex-1 h-14 bg-white rounded-2xl px-4 border border-gray-200 flex-row items-center">
                                        <TextInput
                                            placeholder="24 123 4567"
                                            placeholderTextColor="#9CA3AF"
                                            keyboardType="phone-pad"
                                            value={formatPhoneDisplay(phoneNumber)}
                                            onChangeText={(text) => setPhoneNumber(text.replace(/\s/g, ''))}
                                            maxLength={15} // Increased to handle international numbers
                                            className="flex-1 text-text-main text-lg font-sans"
                                        />
                                    </View>
                                </View>

                                <Text className="text-sm text-text-sub font-sans mb-8">
                                    Standard SMS rates may apply
                                </Text>

                                <View className="flex-1" />

                                <TouchableOpacity
                                    className={`w-full h-14 rounded-2xl flex-row items-center justify-center gap-2 ${phoneNumber.length >= 7 && !loading ? 'bg-clay-primary' : 'bg-gray-300'}`}
                                    onPress={handleSendCode}
                                    disabled={phoneNumber.length < 7 || loading}
                                    style={phoneNumber.length >= 7 ? { shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-bold text-base font-sans-bold">Send Code</Text>
                                            <ArrowRight size={18} color="white" />
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : mode === 'otp' ? (
                            /* OTP VERIFICATION SCREEN */
                            <View className="flex-1 px-8 pt-4 pb-8">
                                <TouchableOpacity
                                    className="w-10 h-10 items-center justify-center -ml-2 mb-6"
                                    onPress={() => setMode('phone')}
                                >
                                    <ChevronLeft size={28} color="#2D241E" />
                                </TouchableOpacity>

                                <Text className="text-2xl font-bold text-text-main mb-2 font-sans-bold">Verify your number</Text>
                                <Text className="text-base text-text-sub mb-8 font-sans">
                                    Enter the 6-digit code sent to{'\n'}
                                    <Text className="text-text-main font-semibold font-sans-semibold">{selectedCountry.code} {formatPhoneDisplay(phoneNumber)}</Text>
                                </Text>

                                <View className="flex-row justify-between gap-2 mb-8">
                                    {otp.map((digit, index) => (
                                        <View
                                            key={index}
                                            className={`flex-1 h-14 bg-white rounded-xl border-2 items-center justify-center ${digit ? 'border-clay-primary' : 'border-gray-200'}`}
                                        >
                                            <TextInput
                                                ref={ref => { otpRefs.current[index] = ref; }}
                                                value={digit}
                                                onChangeText={(value) => handleOtpChange(value, index)}
                                                keyboardType="number-pad"
                                                maxLength={index === 0 ? 6 : 1}
                                                className="text-center text-xl font-bold text-text-main font-sans-bold w-full h-full"
                                                textContentType="oneTimeCode"
                                                autoComplete="one-time-code"
                                                onKeyPress={({ nativeEvent }) => {
                                                    if (nativeEvent.key === 'Backspace' && !digit && index > 0) {
                                                        otpRefs.current[index - 1]?.focus();
                                                    }
                                                }}
                                            />
                                        </View>
                                    ))}
                                </View>

                                <TouchableOpacity className="mb-8" onPress={handleSendCode} disabled={loading || resendCooldown > 0}>
                                    <Text className={`font-semibold text-center font-sans-semibold ${resendCooldown > 0 ? 'text-gray-400' : 'text-clay-primary'}`}>
                                        {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
                                    </Text>
                                </TouchableOpacity>

                                <View className="flex-1" />

                                <TouchableOpacity
                                    className={`w-full h-14 rounded-2xl flex-row items-center justify-center gap-2 ${otp.every(d => d) && !loading ? 'bg-clay-primary' : 'bg-gray-300'}`}
                                    onPress={handleVerifyCode}
                                    disabled={!otp.every(d => d) || loading}
                                    style={otp.every(d => d) ? { shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-bold text-base font-sans-bold">Verify</Text>
                                            <ArrowRight size={18} color="white" />
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : mode === 'name' ? (
                            <UserProfileForm
                                onBack={handleBackToOtp}
                                onSubmit={handleCompleteProfile}
                                loading={loading}
                            />
                        ) : mode === 'splash' ? (
                            /* SPLASH SCREEN */
                            <View className="flex-1 items-center justify-center bg-kente-green">
                                <Animated.View style={{ opacity: splashOpacity, transform: [{ scale: splashScale }], alignItems: 'center' }}>
                                    <Text style={{ fontSize: 72, marginBottom: 16 }}>🍽️</Text>
                                    <Text className="text-white text-3xl font-bold font-sans-bold mb-3">Let's Eat!</Text>
                                    <Text className="text-white/80 text-lg font-sans">
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
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    className="flex-1"
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: '#FAF9F6', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%' }}>
                            {/* Header */}
                            <View className="flex-row items-center justify-between px-6 pt-5 pb-3">
                                <Text className="text-lg font-bold text-text-main font-sans-bold">Select Country</Text>
                                <TouchableOpacity onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}>
                                    <X size={24} color="#2D241E" />
                                </TouchableOpacity>
                            </View>

                            {/* Search */}
                            <View className="mx-6 mb-3 h-12 bg-white rounded-xl px-4 flex-row items-center gap-2 border border-gray-200">
                                <Search size={18} color="#9CA3AF" />
                                <TextInput
                                    placeholder="Search country..."
                                    placeholderTextColor="#9CA3AF"
                                    value={countrySearch}
                                    onChangeText={setCountrySearch}
                                    className="flex-1 text-text-main font-sans"
                                    autoCorrect={false}
                                />
                            </View>

                            {/* Country List */}
                            <FlatList
                                data={filteredCountries}
                                keyExtractor={(item) => item.code + item.name}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        className="flex-row items-center gap-4 px-6 py-3.5"
                                        style={item.code === selectedCountry.code ? { backgroundColor: '#FFF0EB' } : {}}
                                        onPress={() => {
                                            setSelectedCountry(item);
                                            setShowCountryPicker(false);
                                            setCountrySearch('');
                                        }}
                                    >
                                        <Text className="text-2xl">{item.flag}</Text>
                                        <Text className="flex-1 text-text-main font-sans">{item.name}</Text>
                                        <Text className="text-text-sub font-sans-semibold">{item.code}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}


const UserProfileForm = React.memo(({ onBack, onSubmit, loading }: { onBack: () => void, onSubmit: (first: string, last: string) => void, loading: boolean }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    return (
        <View className="flex-1 px-8 pt-4">
            <TouchableOpacity
                className="w-10 h-10 items-center justify-center -ml-2 mb-6"
                onPress={onBack}
            >
                <ChevronLeft size={28} color="#2D241E" />
            </TouchableOpacity>

            <Text className="text-2xl font-bold text-text-main mb-2 font-sans-bold">What's your name?</Text>
            <Text className="text-base text-text-sub mb-8 font-sans">So cooks know who's ordering</Text>

            <View className="gap-4 mb-8">
                <View className="h-14 bg-white rounded-2xl px-4 border border-gray-200 justify-center">
                    <TextInput
                        placeholder="First name"
                        placeholderTextColor="#9CA3AF"
                        value={firstName}
                        onChangeText={setFirstName}
                        className="text-text-main text-base font-sans"
                    />
                </View>
                <View className="h-14 bg-white rounded-2xl px-4 border border-gray-200 justify-center">
                    <TextInput
                        placeholder="Last name"
                        placeholderTextColor="#9CA3AF"
                        value={lastName}
                        onChangeText={setLastName}
                        className="text-text-main text-base font-sans"
                    />
                </View>
            </View>

            <View className="flex-1" />

            <Pressable
                className={`w-full h-14 rounded-2xl flex-row items-center justify-center gap-2 mb-8 ${firstName && lastName && !loading ? 'bg-kente-green' : 'bg-gray-300'}`}
                onPress={() => onSubmit(firstName, lastName)}
                disabled={!firstName || !lastName || loading}
                style={firstName && lastName ? { shadowColor: '#007A33', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}}
            >
                {loading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text className="text-white font-bold text-base font-sans-bold">Let's Eat! 🍽️</Text>
                )}
            </Pressable>
        </View>
    );
});
