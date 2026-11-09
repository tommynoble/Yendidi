import React from 'react';
import { View, Text } from 'react-native';
import { Lock, TriangleAlert } from 'lucide-react-native';
import { palette, type, fonts } from '@/constants/theme';
import { GUEST_QUESTIONS, PRIVATE_QUESTION_ID, type Option } from '@/constants/guestQuestions';
import type { GuestPreferences } from '@/lib/preferencesOnboarding';

// Short group names for the profile (the full question text is too long here).
const GROUP_LABELS: Record<string, string> = {
    foods: 'Loves to eat',
    vibe: 'Table vibe',
    company: 'Likes dining with',
    travel: 'Up for trying new spots',
    dietary: 'Allergies & dietary needs',
};

// Warning colours for allergies, so a nut allergy never looks like a food preference.
const AMBER_BG = '#FFF4E0';
const AMBER_BORDER = '#E5A93D';
const AMBER_TEXT = '#7A4B00';
const AMBER_ICON = '#B26B00';

// The public picks as flat lists, plus the private allergy options, for building a short summary.
export function summarizeTaste(taste: GuestPreferences, dietary?: string[]) {
    const picks: Option[] = GUEST_QUESTIONS
        .filter((q) => q.id !== PRIVATE_QUESTION_ID)
        .flatMap((q) => q.options.filter((o) => taste[q.id]?.includes(o.id)));
    const dietaryStep = GUEST_QUESTIONS.find((q) => q.id === PRIVATE_QUESTION_ID);
    const allergies: Option[] = dietaryStep?.options.filter((o) => dietary?.includes(o.id)) || [];
    return { picks, allergies };
}

// A pick: solid terracotta with white text, so the choices read at a glance against the cream card.
export function PickChip({ label, Icon, small }: { label: string; Icon: React.ComponentType<any>; small?: boolean }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: small ? 28 : 32, paddingHorizontal: small ? 10 : 12, borderRadius: 9999, backgroundColor: palette.accent }}>
            <Icon size={small ? 13 : 14} color="#FFFFFF" strokeWidth={2} />
            <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: '#FFFFFF' }}>{label}</Text>
        </View>
    );
}

function AllergyChip({ label, Icon }: { label: string; Icon: React.ComponentType<any> }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 9999, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: AMBER_BORDER }}>
            <Icon size={14} color={AMBER_ICON} strokeWidth={2} />
            <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: AMBER_TEXT }}>{label}</Text>
        </View>
    );
}

// A guest's answers as grouped chips. `taste` is the public part. Pass `dietary` ONLY for the guest's own view
// (or a host viewing their booked guest): it shows in its own warning box under a lock label, and is never part of the public profile.
export default function TasteProfile({ taste, dietary, emptyText }: { taste: GuestPreferences; dietary?: string[]; emptyText?: string }) {
    const groups = GUEST_QUESTIONS.filter((q) => q.id !== PRIVATE_QUESTION_ID && taste[q.id]?.length);
    const { allergies } = summarizeTaste(taste, dietary);

    if (groups.length === 0 && allergies.length === 0) {
        return <Text style={{ ...type.body, color: palette.muted }}>{emptyText || 'No answers yet.'}</Text>;
    }

    return (
        <View style={{ gap: 14 }}>
            {groups.map((q) => (
                <View key={q.id} style={{ gap: 8 }}>
                    <Text style={{ ...type.micro, color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{GROUP_LABELS[q.id]}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {q.options.filter((o) => taste[q.id].includes(o.id)).map((o) => <PickChip key={o.id} label={o.label} Icon={o.icon} />)}
                    </View>
                </View>
            ))}

            {allergies.length > 0 && (
                <View style={{ gap: 10, padding: 12, borderRadius: 16, backgroundColor: AMBER_BG, borderWidth: 1, borderColor: 'rgba(229, 169, 61, 0.55)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TriangleAlert size={14} color={AMBER_ICON} />
                        <Text style={{ ...type.micro, flex: 1, color: AMBER_TEXT, textTransform: 'uppercase', letterSpacing: 0.6 }}>{GROUP_LABELS.dietary}</Text>
                        <Lock size={12} color={AMBER_ICON} />
                        <Text style={{ ...type.micro, color: AMBER_TEXT, textTransform: 'uppercase', letterSpacing: 0.6 }}>Private</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {allergies.map((o) => <AllergyChip key={o.id} label={o.label} Icon={o.icon} />)}
                    </View>
                </View>
            )}
        </View>
    );
}
