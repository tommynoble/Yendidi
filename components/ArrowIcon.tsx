import React from 'react';
import { View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { palette } from '@/constants/theme';

// "More" arrow for section headings (pass it as SectionHeader's actionIcon, with actionLabel="").
// Sits on a faint orange wash so it reads as tappable without shouting.
export default function ArrowIcon({ size = 16 }: { size?: number }) {
    const circle = size + 12;
    return (
        <View style={{ width: circle, height: circle, borderRadius: circle / 2, backgroundColor: 'rgba(194, 83, 39,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRight size={size} color={palette.accent} strokeWidth={2.25} />
        </View>
    );
}
