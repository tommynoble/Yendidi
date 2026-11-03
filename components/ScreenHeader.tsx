import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, fonts } from '@/constants/theme';

// The shared top area for the Kitchen-mode tabs (Bookings, Kitchen, Messages): a raised cream block with a title and a
// subtitle, optional back button / action icons, and optional controls (like tabs) underneath. It handles the top inset itself.
export default function ScreenHeader({ title, subtitle, left, right, children }: {
    title: string;
    subtitle?: string;
    left?: React.ReactNode;
    right?: React.ReactNode;
    children?: React.ReactNode;
}) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={{
                backgroundColor: palette.surface,
                paddingHorizontal: 24,
                paddingTop: insets.top + 48,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
                shadowColor: '#2D241E',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.22,
                shadowRadius: 20,
                elevation: 10,
                zIndex: 10,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: children ? 16 : 0 }}>
                {left}
                <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, color: palette.ink }}>{title}</Text>
                    {!!subtitle && (
                        <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.muted }}>{subtitle}</Text>
                    )}
                </View>
                {right}
            </View>
            {children}
        </View>
    );
}
