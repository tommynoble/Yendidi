import React from 'react';
import { View, Text } from 'react-native';
import { palette, fonts } from '@/constants/theme';

// Number badge for the corner of an icon (bell, messages): the count of things waiting, capped at 9+, and nothing at all at zero.
// Sits at the icon's top-right; the ring is the colour of the surface behind the icon so the badge reads as cut out of it.
export default function CountBadge({ count, ringColor = palette.canvas }: { count: number; ringColor?: string }) {
    if (!count || count < 1) return null;
    const label = count > 9 ? '9+' : String(count);
    return (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute',
                top: -7,
                right: -9,
                minWidth: 19,
                height: 19,
                paddingHorizontal: label.length > 1 ? 4 : 0,
                borderRadius: 10,
                backgroundColor: palette.accent,
                borderWidth: 2,
                borderColor: ringColor,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Text allowFontScaling={false} style={{ fontFamily: fonts.bold, fontSize: 10, lineHeight: 12, color: '#FFFFFF' }}>{label}</Text>
        </View>
    );
}
