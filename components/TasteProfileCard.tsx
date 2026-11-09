import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ChevronRight, Lock, Sparkles, Utensils } from 'lucide-react-native';
import { palette, fonts } from '@/constants/theme';
import { GUEST_QUESTIONS, PRIVATE_QUESTION_ID } from '@/constants/guestQuestions';
import type { GuestPreferences } from '@/lib/preferencesOnboarding';
import TasteProfile, { PickChip, summarizeTaste } from '@/components/TasteProfile';

const OPEN_KEY = 'yendidii_taste_profile_open';
const PREVIEW_CHIPS = 3;
const CARD_BORDER = 'rgba(194, 83, 39, 0.22)';
const AMBER_TEXT = '#7A4B00';
const AMBER_ICON = '#B26B00';

// "Your taste profile" on the guest's own profile. Collapsed it is one tappable row with a short preview, and the allergies
// line stays visible even then (it's the one thing a guest must not forget is set). It remembers whether it was left open.
export default function TasteProfileCard({ prefs }: { prefs: GuestPreferences }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(OPEN_KEY).then((v) => { if (v === '1') setOpen(true); }).catch(() => {});
    }, []);

    const toggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const next = !open;
        setOpen(next);
        AsyncStorage.setItem(OPEN_KEY, next ? '1' : '0').catch(() => {});
    };

    const total = GUEST_QUESTIONS.length;
    const answered = GUEST_QUESTIONS.filter((q) => prefs[q.id]?.length).length;
    const { picks, allergies } = summarizeTaste(prefs, prefs[PRIVATE_QUESTION_ID]);
    const hasAnswers = picks.length > 0 || allergies.length > 0;
    const firstOpen = Math.max(0, GUEST_QUESTIONS.findIndex((q) => !prefs[q.id]?.length));
    const goEdit = () => router.push('/onboarding/preferences?edit=1');

    return (
        <View className="mb-6 px-6">
            {/* Not finished the sign-up questions yet: invite them to pick up where they left off */}
            {answered < total && (
                <TouchableOpacity
                    onPress={() => router.push(`/onboarding/preferences?edit=1&start=${firstOpen}`)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    className="mb-3 rounded-2xl p-4 flex-row items-center gap-3"
                    style={{ backgroundColor: palette.accent }}
                >
                    <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        <Sparkles size={20} color="#FFFFFF" />
                    </View>
                    <View className="flex-1">
                        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' }}>
                            {answered === 0 ? 'Finish your taste profile' : 'Pick up where you left off'}
                        </Text>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 1 }}>
                            {answered === 0
                                ? "Tell us what you love so we can match you to the right tables."
                                : `${answered} of ${total} answered. Add ${total - answered} more to help hosts plan your night.`}
                        </Text>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
                            <View style={{ height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', width: `${(answered / total) * 100}%` }} />
                        </View>
                    </View>
                    <ChevronRight size={20} color="#FFFFFF" />
                </TouchableOpacity>
            )}

            <View style={{ backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: CARD_BORDER, overflow: 'hidden' }}>
                {!hasAnswers ? (
                    <View style={{ padding: 16 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: palette.ink, marginBottom: 6 }}>Your taste profile</Text>
                        <TasteProfile
                            taste={prefs}
                            dietary={prefs[PRIVATE_QUESTION_ID]}
                            emptyText="Tell us what you love to eat so hosts and other guests know who's joining the table."
                        />
                    </View>
                ) : (
                    <>
                        {/* The whole row opens and closes it */}
                        <TouchableOpacity
                            onPress={toggle}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: open }}
                            accessibilityLabel={`Your taste profile, ${picks.length} picks${allergies.length ? `, ${allergies.length} allergies` : ''}`}
                            accessibilityHint={open ? 'Collapse' : 'Expand'}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
                        >
                            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFDBCD', alignItems: 'center', justifyContent: 'center' }}>
                                <Utensils size={18} color={palette.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: palette.ink }}>Your taste profile</Text>
                                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: palette.muted, marginTop: 1 }}>
                                    {picks.length} {picks.length === 1 ? 'pick' : 'picks'}
                                </Text>
                            </View>
                            {/* Edit only while it is open, so the closed row stays clean */}
                            {open && (
                                <TouchableOpacity onPress={goEdit} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Edit taste profile">
                                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.accent }}>Edit</Text>
                                </TouchableOpacity>
                            )}
                            {open ? <ChevronDown size={20} color={palette.ink} style={{ transform: [{ rotate: '180deg' }] }} /> : <ChevronDown size={20} color={palette.ink} />}
                        </TouchableOpacity>

                        {!open ? (
                            <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
                                {picks.length > 0 && (
                                    <View style={{ flexDirection: 'row', gap: 8, overflow: 'hidden', height: 28 }}>
                                        {picks.slice(0, PREVIEW_CHIPS).map((o) => <PickChip key={o.id} label={o.label} Icon={o.icon} small />)}
                                        {picks.length > PREVIEW_CHIPS && (
                                            <>
                                                <LinearGradient
                                                    pointerEvents="none"
                                                    colors={['rgba(251,245,242,0)', palette.surface]}
                                                    start={{ x: 0, y: 0.5 }}
                                                    end={{ x: 1, y: 0.5 }}
                                                    style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80 }}
                                                />
                                                <View style={{ position: 'absolute', right: 0, top: 0, height: 28, paddingHorizontal: 10, borderRadius: 9999, backgroundColor: '#FFDBCD', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#9C3F12' }}>+{picks.length - PREVIEW_CHIPS}</Text>
                                                </View>
                                            </>
                                        )}
                                    </View>
                                )}
                                {allergies.length > 0 && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Lock size={13} color={AMBER_ICON} />
                                        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: AMBER_TEXT }}>
                                            {allergies.length} {allergies.length === 1 ? 'allergy' : 'allergies'} (private)
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                                <TasteProfile taste={prefs} dietary={prefs[PRIVATE_QUESTION_ID]} />
                                <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: palette.muted, marginTop: 14 }}>
                                    Other guests see your food, vibe and dining picks. Allergies are only shared with hosts you book.
                                </Text>
                            </View>
                        )}
                    </>
                )}
            </View>
        </View>
    );
}
