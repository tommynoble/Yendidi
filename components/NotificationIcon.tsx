import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { palette } from '@/constants/theme';

// Notifications bell. With `hasUnread` it gets an orange dot on its top-right corner, e.g. when an order comes in.
export default function NotificationIcon({ size = 24, color = palette.inkSoft, hasUnread = false }: { size?: number; color?: string; hasUnread?: boolean }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M18 16V11C18 7.93 16.37 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.64 5.36 6 7.92 6 11V16L4.71 17.29C4.08 17.92 4.52 19 5.41 19H18.59C19.48 19 19.92 17.92 19.29 17.29L18 16Z"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path d="M10 20C10 21.1 10.9 22 12 22C13.1 22 14 21.1 14 20" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
            {hasUnread && <Circle cx="18" cy="5" r="4" fill={palette.accent} stroke={palette.canvas} strokeWidth={1.5} />}
        </Svg>
    );
}
