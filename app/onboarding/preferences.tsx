import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { GUEST_QUESTIONS as STEPS, Option } from '@/constants/guestQuestions';
import { Button } from '@/components/ui/Button';
import { OnboardingHeader } from '@/components/ui/OnboardingHeader';
import { palette, type, fonts } from '@/constants/theme';
import { savePreferences, loadPreferences, GuestPreferences } from '@/lib/preferencesOnboarding';
import { hasPrimedPermissions } from '@/lib/permissionsOnboarding';

// A tappable answer. Icon and text flip together: accent icon on a light chip, white on the selected (accent) chip,
// and the chip gives a small springy pop when it becomes selected.
function Choice({ option, selected, onPress, row }: { option: Option; selected: boolean; onPress: () => void; row?: boolean }) {
    const Icon = option.icon;
    const scale = useRef(new Animated.Value(1)).current;
    const first = useRef(true);

    useEffect(() => {
        if (first.current) { first.current = false; return; }
        if (selected) {
            scale.setValue(0.94);
            Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
        }
    }, [selected]);

    const iconColor = selected ? '#FFFFFF' : palette.accent;
    const textColor = selected ? '#FFFFFF' : palette.ink;

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                accessibilityRole={row ? 'radio' : 'checkbox'}
                accessibilityState={row ? { selected } : { checked: selected }}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: row ? 12 : 8,
                    ...(row ? { minHeight: 64, paddingHorizontal: 16, borderRadius: 16 } : { height: 46, paddingHorizontal: 16, borderRadius: 9999 }),
                    backgroundColor: selected ? palette.accent : palette.surface,
                    borderWidth: row ? 1 : 1.5,
                    borderColor: selected ? palette.accent : '#DDC1B6',
                }}
            >
                <Icon size={row ? 24 : 18} color={iconColor} strokeWidth={2} />
                <Text style={{ ...(row ? type.card : type.body), fontFamily: selected ? fonts.bold : fonts.semibold, color: textColor, ...(row && { flex: 1 }) }}>{option.label}</Text>
                {selected && <Check size={row ? 20 : 16} color="#FFFFFF" strokeWidth={3} />}
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function GuestPreferencesScreen() {
    const router = useRouter();
    // ?edit=1 opens the same questions from Profile: answers are pre-filled and finishing goes back, not on to ID/permissions.
    const { edit, start } = useLocalSearchParams<{ edit?: string; start?: string }>();
    const isEdit = edit === '1';
    // ?start=N opens at question N (Profile uses this to jump to the first unanswered one).
    const [stepIndex, setStepIndex] = useState(() => Math.min(Math.max(parseInt(start || '0', 10) || 0, 0), STEPS.length - 1));
    const [answers, setAnswers] = useState<GuestPreferences>({});
    const [finishing, setFinishing] = useState(false);
    useEffect(() => {
        if (isEdit) loadPreferences().then(setAnswers);
    }, [isEdit]);
    const fade = useRef(new Animated.Value(1)).current;
    const slide = useRef(new Animated.Value(0)).current;

    const step = STEPS[stepIndex];
    const picked = answers[step.id] || [];
    const isLast = stepIndex === STEPS.length - 1;

    const toggle = (option: Option) => {
        setAnswers((prev) => {
            const current = prev[step.id] || [];
            let next: string[];
            if (step.single || option.exclusive) {
                next = current.includes(option.id) ? [] : [option.id];
            } else {
                const withoutExclusive = current.filter((id) => !step.options.find((o) => o.id === id)?.exclusive);
                next = withoutExclusive.includes(option.id) ? withoutExclusive.filter((id) => id !== option.id) : [...withoutExclusive, option.id];
            }
            return { ...prev, [step.id]: next };
        });
    };

    const finish = async (final: GuestPreferences) => {
        setFinishing(true);
        try { await savePreferences(final); } catch {}
        if (isEdit) { router.back(); return; }
        // Sign-up no longer includes the ID check (it moves to the first booking). Straight on to permissions / the map.
        const primed = await hasPrimedPermissions();
        router.replace(primed ? '/(tabs)/explore/map' : '/onboarding/permissions');
    };

    // Slide the next/previous question in from the matching side.
    const goTo = (index: number, direction: 1 | -1) => {
        Animated.parallel([
            Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
            Animated.timing(slide, { toValue: -16 * direction, duration: 120, useNativeDriver: true }),
        ]).start(() => {
            setStepIndex(index);
            slide.setValue(16 * direction);
            Animated.parallel([
                Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]).start();
        });
    };

    const next = () => (isLast ? finish(answers) : goTo(stepIndex + 1, 1));
    const skip = () => {
        // While editing, Skip keeps the existing answer; at sign-up it leaves the question blank.
        const kept = isEdit ? answers : { ...answers, [step.id]: [] };
        setAnswers(kept);
        isLast ? finish(kept) : goTo(stepIndex + 1, 1);
    };

    return (
        <SafeAreaView className="flex-1 bg-brand-canvas" edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" />

            <OnboardingHeader currentStep={stepIndex + 1} totalSteps={STEPS.length} />

            {/* Back / Skip */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 36 }}>
                {stepIndex > 0 ? (
                    <TouchableOpacity onPress={() => goTo(stepIndex - 1, -1)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Previous question">
                        <ArrowLeft size={22} color={palette.ink} />
                    </TouchableOpacity>
                ) : <View />}
                <TouchableOpacity onPress={skip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button">
                    <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.ink }}>Skip</Text>
                </TouchableOpacity>
            </View>

            <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateX: slide }] }}>
                <ScrollView
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={{ ...type.micro, color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        Question {stepIndex + 1} of {STEPS.length}
                    </Text>
                    <Text style={{ ...type.hero, color: palette.ink, marginTop: 6 }}>{step.title}</Text>
                    <Text style={{ ...type.body, color: palette.muted, marginTop: 6, marginBottom: 22 }}>{step.subtitle}</Text>

                    {step.single ? (
                        // One answer: full-width rows
                        <View style={{ gap: 10 }}>
                            {step.options.map((option) => (
                                <Choice key={option.id} option={option} selected={picked.includes(option.id)} onPress={() => toggle(option)} row />
                            ))}
                        </View>
                    ) : (
                        // Many answers: wrapping pills
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {step.options.map((option) => (
                                <Choice key={option.id} option={option} selected={picked.includes(option.id)} onPress={() => toggle(option)} />
                            ))}
                        </View>
                    )}
                </ScrollView>
            </Animated.View>

            {/* Footer */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 10 }}>
                <Text style={{ ...type.meta, fontFamily: fonts.regular, color: palette.muted, textAlign: 'center' }}>
                    {step.single ? 'Pick one' : picked.length > 0 ? `${picked.length} selected` : 'Pick as many as you like'}
                </Text>
                <Button
                    label={isLast ? "Let's eat" : 'Continue'}
                    onPress={next}
                    showArrow
                    loading={finishing}
                    disabled={picked.length === 0}
                />
            </View>
        </SafeAreaView>
    );
}
