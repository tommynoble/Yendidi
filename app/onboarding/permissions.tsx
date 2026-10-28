import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MapPin, Bell, ChevronRight } from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { markPermissionsPrimed } from '@/lib/permissionsOnboarding';

type Step = 'location' | 'notifications';

const STEPS: { key: Step; icon: typeof MapPin; title: string; body: string; cta: string }[] = [
    {
        key: 'location',
        icon: MapPin,
        title: 'Find cooks near you',
        body: "We'll use your location to show kitchens and meal sessions close by, and to help hosts know where to deliver.",
        cta: 'Enable Location',
    },
    {
        key: 'notifications',
        icon: Bell,
        title: "Don't miss an update",
        body: "We'll let you know the moment your order is accepted, ready, or when a host posts a meal near you.",
        cta: 'Enable Notifications',
    },
];

export default function PermissionsOnboardingScreen() {
    const router = useRouter();
    const [stepIndex, setStepIndex] = useState(0);
    const [working, setWorking] = useState(false);
    const fade = React.useRef(new Animated.Value(1)).current;

    const step = STEPS[stepIndex];
    const Icon = step.icon;

    const finish = async () => {
        await markPermissionsPrimed();
        router.replace('/(tabs)');
    };

    const advance = () => {
        if (stepIndex < STEPS.length - 1) {
            Animated.sequence([
                Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }),
            ]).start(() => {
                setStepIndex((i) => i + 1);
                Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
            });
        } else {
            finish();
        }
    };

    const handleEnable = async () => {
        setWorking(true);
        try {
            if (step.key === 'location') {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const parts = [geo?.district || geo?.subregion, geo?.city || geo?.region].filter(Boolean);
                        await supabase.from('profiles').update({
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            location: parts.join(', ') || undefined,
                        }).eq('id', user.id);
                    }
                }
            } else {
                await registerForPushNotificationsAsync();
            }
        } catch (e) {
            // Permission prompts can be dismissed or fail silently (e.g. simulator
            // without location services) — either way we just move on.
        } finally {
            setWorking(false);
            advance();
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8E4DD' }} edges={['top', 'bottom']}>
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    {STEPS.map((_, i) => (
                        <View
                            key={i}
                            style={{
                                flex: 1, height: 4, borderRadius: 2,
                                backgroundColor: i <= stepIndex ? '#BF592B' : '#F2DFD7',
                            }}
                        />
                    ))}
                </View>

                <Animated.View style={{ opacity: fade, alignItems: 'center' }}>
                    <View style={{
                        width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFF1EC',
                        alignItems: 'center', justifyContent: 'center', marginBottom: 28,
                    }}>
                        <Icon size={36} color="#BF592B" />
                    </View>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: '#231915', textAlign: 'center', marginBottom: 10, letterSpacing: -0.3 }}>
                        {step.title}
                    </Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#56423B', textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 }}>
                        {step.body}
                    </Text>
                </Animated.View>

                <View style={{ gap: 12 }}>
                    <TouchableOpacity
                        onPress={handleEnable}
                        disabled={working}
                        style={{
                            backgroundColor: '#BF592B', borderRadius: 16, paddingVertical: 16,
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                            opacity: working ? 0.7 : 1,
                        }}
                    >
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: 'white' }}>
                            {step.cta}
                        </Text>
                        <ChevronRight size={18} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={advance} disabled={working}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#8A7269', textAlign: 'center' }}>
                            Not now
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
