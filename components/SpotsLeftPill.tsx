import React from 'react';
import { View, Text } from 'react-native';
import { spots, SPOTS_LOW_AT, type } from '@/constants/theme';

// Outlined "N spots left" pill. Amber while there is room; pink when SPOTS_LOW_AT or fewer remain
// (and for "Fully booked"). Colours and threshold live in constants/theme.ts.
export default function SpotsLeftPill({ remaining }: { remaining: number }) {
    const left = Math.max(0, remaining || 0);
    const colours = left <= SPOTS_LOW_AT ? spots.low : spots.ok;
    const label = left === 0 ? 'Fully booked' : `${left} spot${left === 1 ? '' : 's'} left`;
    return (
        <View
            style={{
                alignSelf: 'flex-start',
                backgroundColor: colours.bg,
                borderColor: colours.border,
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
            }}
        >
            <Text style={{ ...type.micro, color: colours.text }} numberOfLines={1}>{label}</Text>
        </View>
    );
}
