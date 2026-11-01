import React from 'react';
import { View, Text } from 'react-native';
import { Lock } from 'lucide-react-native';
import { palette, type, fonts } from '@/constants/theme';
import { GUEST_QUESTIONS, PRIVATE_QUESTION_ID } from '@/constants/guestQuestions';
import type { GuestPreferences } from '@/lib/preferencesOnboarding';

// Short group names for the profile (the full question text is too long here).
const GROUP_LABELS: Record<string, string> = {
    foods: 'Loves to eat',
    vibe: 'Table vibe',
    company: 'Likes dining with',
    travel: 'Travel',
    dietary: 'Allergies & dietary needs',
};

function Chip({ label, Icon }: { label: string; Icon: React.ComponentType<any> }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 9999, backgroundColor: palette.canvas }}>
            <Icon size={14} color={palette.accent} strokeWidth={2} />
            <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: palette.ink }}>{label}</Text>
        </View>
    );
}

// A guest's answers as grouped chips. `taste` is the public part. Pass `dietary` ONLY for the guest's own view
// (or a host viewing their booked guest): it shows under a lock label, and is never part of the public profile.
export default function TasteProfile({ taste, dietary, emptyText }: { taste: GuestPreferences; dietary?: string[]; emptyText?: string }) {
    const groups = GUEST_QUESTIONS.filter((q) => q.id !== PRIVATE_QUESTION_ID && taste[q.id]?.length);
    const dietaryStep = GUEST_QUESTIONS.find((q) => q.id === PRIVATE_QUESTION_ID);
    const dietaryOptions = dietaryStep?.options.filter((o) => dietary?.includes(o.id)) || [];

    if (groups.length === 0 && dietaryOptions.length === 0) {
        return <Text style={{ ...type.body, color: palette.muted }}>{emptyText || 'No answers yet.'}</Text>;
    }

    return (
        <View style={{ gap: 14 }}>
            {groups.map((q) => (
                <View key={q.id} style={{ gap: 8 }}>
                    <Text style={{ ...type.micro, color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{GROUP_LABELS[q.id]}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {q.options.filter((o) => taste[q.id].includes(o.id)).map((o) => <Chip key={o.id} label={o.label} Icon={o.icon} />)}
                    </View>
                </View>
            ))}

            {dietaryOptions.length > 0 && (
                <View style={{ gap: 8, paddingTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Lock size={12} color={palette.muted} />
                        <Text style={{ ...type.micro, color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{GROUP_LABELS.dietary} · private</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {dietaryOptions.map((o) => <Chip key={o.id} label={o.label} Icon={o.icon} />)}
                    </View>
                    <Text style={{ ...type.micro, fontFamily: fonts.regular, color: palette.muted }}>Only you and hosts you book with can see this.</Text>
                </View>
            )}
        </View>
    );
}
