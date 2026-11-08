import React from 'react';
import { View, Text } from 'react-native';
import { palette, fonts } from '@/constants/theme';

// Warm tones that sit with the app's orange, one per chip.
const CHIP_COLORS = [palette.accent, '#D07A55', '#6FA98A', '#E0A15A'];
const PLACEHOLDER_LETTERS = 'AKMSTEJNYB';

// Placeholder initials, stable per listing so they don't change on re-render. Real guest names aren't
// visible to other eaters yet; pass `names` to show real initials once they are.
const placeholderInitials = (id: string, count: number) => {
    const seed = id ? id.charCodeAt(0) + id.charCodeAt(id.length - 1) * 3 : 0;
    return Array.from({ length: count }, (_, i) => PLACEHOLDER_LETTERS[(seed + i * 3) % PLACEHOLDER_LETTERS.length]);
};

// Overlapping round letter chips with a "+N" chip for the rest, like a guest stack.
export default function SeatStack({ id, names, booked = 0, size = 32 }: { id: string; names?: string[]; booked?: number; size?: number }) {
    const letters = names?.length ? names.slice(0, 4).map((n) => (n.trim().charAt(0) || '?').toUpperCase()) : placeholderInitials(id, 4);
    const extra = Math.max(0, booked);
    const overlap = size * 0.44;
    const ring = { borderWidth: 2, borderColor: palette.surface } as const;
    const chip = { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' } as const;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {letters.map((letter, i) => (
                <View key={i} style={[chip, ring, { backgroundColor: CHIP_COLORS[i % CHIP_COLORS.length], marginLeft: i === 0 ? 0 : -overlap, zIndex: letters.length - i }]}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.42, color: 'white' }}>{letter}</Text>
                </View>
            ))}
            {extra > 0 && (
                <View style={[chip, ring, { backgroundColor: '#F1E4DE', marginLeft: -overlap, zIndex: 0 }]}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.34, color: palette.bodyText }}>+{extra}</Text>
                </View>
            )}
        </View>
    );
}
