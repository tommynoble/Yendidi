import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import CountBadge from '@/components/CountBadge';
import { palette } from '@/constants/theme';

// Barely-there lift: a faint copy of the icon sits a point lower behind it (same as the category pills).
const LIFT_COLOR = 'rgba(140, 53, 18, 0.07)';

// Notifications bell. With `count` a number badge sits on its top-right corner (hidden at 0); `hasUnread` alone gives a plain dot.
export default function NotificationIcon({ size = 24, color = palette.inkSoft, hasUnread = false, count = 0 }: { size?: number; color?: string; hasUnread?: boolean; count?: number }) {
    const bell = (stroke: string) => (
        <>
            <Path
                d="M18 16V11C18 7.93 16.37 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.64 5.36 6 7.92 6 11V16L4.71 17.29C4.08 17.92 4.52 19 5.41 19H18.59C19.48 19 19.92 17.92 19.29 17.29L18 16Z"
                stroke={stroke}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path d="M10 20C10 21.1 10.9 22 12 22C13.1 22 14 21.1 14 20" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" />
        </>
    );
    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', top: 1, left: 0 }}>
                {bell(LIFT_COLOR)}
            </Svg>
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                {bell(color)}
                {hasUnread && count < 1 && <Circle cx="18" cy="5" r="4" fill={palette.accent} stroke={palette.canvas} strokeWidth={1.5} />}
            </Svg>
            <CountBadge count={count} />
        </View>
    );
}
