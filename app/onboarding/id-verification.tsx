import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IdCard, BookUser, Car, ShieldCheck, ScanFace, Lock, Check, LucideIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { OnboardingHeader } from '@/components/ui/OnboardingHeader';
import { palette, type, fonts } from '@/constants/theme';
import { hasPrimedPermissions } from '@/lib/permissionsOnboarding';
import { BOOKING_ID_REASON, skipIdCheckForNow, runAfterIdGate } from '@/lib/idVerification';

// Soft gate: guests can skip now and browse freely, and are asked again before their first "Reserve a Seat".
// Set to true for a hard gate (no skip). Don't turn it on until the scan itself is wired up, or guests get stuck here.
const ID_GATE_IS_HARD = false;

const ID_OPTIONS: { id: string; icon: LucideIcon; title: string; note: string }[] = [
    { id: 'ghana-card', icon: IdCard, title: 'Ghana Card / National ID', note: 'Fastest, about a minute' },
    { id: 'passport', icon: BookUser, title: 'International Passport', note: 'Photo page only' },
    { id: 'license', icon: Car, title: "Driver's License", note: 'Front of the card' },
];

export default function IdVerificationScreen() {
    const router = useRouter();
    // Opened from "Reserve a Seat" / checkout with ?reason=book: the guest needs verifying to book, so show why,
    // and "Maybe later" goes back to what they were doing instead of on through sign-up.
    const { reason } = useLocalSearchParams<{ reason?: string; returnTo?: string }>();
    const isBooking = reason === 'book';
    const [selected, setSelected] = useState<string | null>(null);

    const goNext = async () => {
        if (isBooking) {
            // For now, "Maybe later" carries on to payment (see lib/idVerification.ts). Go back, then resume what they were doing.
            skipIdCheckForNow();
            router.back();
            setTimeout(runAfterIdGate, 300);
            return;
        }
        const primed = await hasPrimedPermissions();
        router.replace(primed ? '/(tabs)/explore/map' : '/onboarding/permissions');
    };

    const verify = () => {
        // The ID scan and selfie check aren't built yet; this is where they will start.
        Alert.alert('Coming soon', "ID verification is almost ready. You can keep exploring for now, and we'll ask again before your first booking.", [
            { text: 'Continue', onPress: goNext },
        ]);
    };

    return (
        <SafeAreaView className="flex-1 bg-brand-canvas" edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" />
            {!isBooking && <OnboardingHeader currentStep={6} totalSteps={7} />}

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: isBooking ? 36 : 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(0,106,60,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    <ShieldCheck size={32} color="#006A3C" strokeWidth={2} />
                </View>

                <Text style={{ ...type.hero, color: palette.ink }}>Safety goes both ways.</Text>
                <Text style={{ ...type.body, color: palette.muted, marginTop: 6, marginBottom: 22 }}>
                    {isBooking ? BOOKING_ID_REASON : 'Hosts open their real homes to our community. A quick ID check keeps every table safe for guests and hosts.'}
                </Text>

                {isBooking && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(0,106,60,0.1)' }}>
                        <Lock size={14} color="#006A3C" />
                        <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: '#006A3C', flex: 1 }}>
                            One-time verification: once verified, your future bookings take just one tap.
                        </Text>
                    </View>
                )}

                <View style={{ gap: 10 }}>
                    {ID_OPTIONS.map((option) => {
                        const isSelected = selected === option.id;
                        const Icon = option.icon;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                onPress={() => setSelected(option.id)}
                                activeOpacity={0.85}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: isSelected }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                    minHeight: 68,
                                    paddingHorizontal: 16,
                                    borderRadius: 16,
                                    backgroundColor: isSelected ? palette.accent : palette.surface,
                                    borderWidth: 1,
                                    borderColor: isSelected ? palette.accent : '#DDC1B6',
                                }}
                            >
                                <Icon size={24} color={isSelected ? '#FFFFFF' : palette.accent} strokeWidth={2} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ ...type.card, fontFamily: isSelected ? fonts.bold : fonts.semibold, color: isSelected ? '#FFFFFF' : palette.ink }}>{option.title}</Text>
                                    <Text style={{ ...type.meta, fontFamily: fonts.regular, color: isSelected ? 'rgba(255,255,255,0.9)' : palette.muted }}>{option.note}</Text>
                                </View>
                                {isSelected && <Check size={20} color="#FFFFFF" strokeWidth={3} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* What happens next */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: palette.surface }}>
                    <ScanFace size={22} color={palette.accent} />
                    <Text style={{ ...type.meta, fontFamily: fonts.regular, color: palette.muted, flex: 1 }}>
                        You'll scan your ID, then take a quick 3-second selfie to confirm it's you.
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 4 }}>
                    <Lock size={14} color={palette.muted} />
                    <Text style={{ ...type.micro, fontFamily: fonts.regular, color: palette.muted, flex: 1 }}>
                        Your ID is only used to verify you and is never shown to hosts.
                    </Text>
                </View>
            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 6 }}>
                <Button label="Verify now" onPress={verify} showArrow disabled={!selected} />
                {!ID_GATE_IS_HARD && (
                    <>
                        <TouchableOpacity onPress={goNext} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button">
                            <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.ink }}>{isBooking ? 'Maybe later' : 'Skip for now'}</Text>
                        </TouchableOpacity>
                        <Text style={{ ...type.micro, fontFamily: fonts.regular, color: palette.muted, textAlign: 'center' }}>
                            {isBooking ? "You can verify later. It will be required to book soon." : "You can browse freely. We'll ask before your first booking."}
                        </Text>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}
