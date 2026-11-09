import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import CountBadge from '@/components/CountBadge';
import { palette } from '@/constants/theme';

// Barely-there lift: a faint copy of the icon sits a point lower behind it (same as the category pills).
const LIFT_COLOR = 'rgba(140, 53, 18, 0.07)';

// Messages icon: a chat bubble with three orange dots. With `count` a number badge sits on its top-right corner (hidden at 0); `hasUnread` alone gives a plain dot.
export default function MessagesIcon({ size = 24, color = palette.inkSoft, hasUnread = false, count = 0 }: { size?: number; color?: string; hasUnread?: boolean; count?: number }) {
    const bubble = (stroke: string, dots: string) => (
        <>
            <Path
                d="M12 3C6.477 3 2 6.918 2 11.75C2 14.2 3.19 16.39 5.09 17.92C4.9 19.16 4.34 20.37 3.32 21.22C3.09 21.41 3.24 21.78 3.54 21.75C6.07 21.5 8.16 20.25 9.53 19.46C10.33 19.68 11.15 19.8 12 19.8C17.523 19.8 22 15.882 22 11.05C22 6.218 17.523 3 12 3Z"
                stroke={stroke}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Circle cx="8" cy="11.5" r="1.25" fill={dots} />
            <Circle cx="12" cy="11.5" r="1.25" fill={dots} />
            <Circle cx="16" cy="11.5" r="1.25" fill={dots} />
        </>
    );
    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', top: 1, left: 0 }}>
                {bubble(LIFT_COLOR, LIFT_COLOR)}
            </Svg>
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                {bubble(color, palette.accent)}
                {hasUnread && count < 1 && <Circle cx="18" cy="5" r="4" fill={palette.accent} stroke={palette.canvas} strokeWidth={1.5} />}
            </Svg>
            <CountBadge count={count} />
        </View>
    );
}
