import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { palette } from '@/constants/theme';

// Messages icon: a chat bubble with three orange dots. With `hasUnread` an orange dot sits on its top-right corner.
export default function MessagesIcon({ size = 24, color = palette.inkSoft, hasUnread = false }: { size?: number; color?: string; hasUnread?: boolean }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12 3C6.477 3 2 6.918 2 11.75C2 14.2 3.19 16.39 5.09 17.92C4.9 19.16 4.34 20.37 3.32 21.22C3.09 21.41 3.24 21.78 3.54 21.75C6.07 21.5 8.16 20.25 9.53 19.46C10.33 19.68 11.15 19.8 12 19.8C17.523 19.8 22 15.882 22 11.05C22 6.218 17.523 3 12 3Z"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Circle cx="8" cy="11.5" r="1.25" fill={palette.accent} />
            <Circle cx="12" cy="11.5" r="1.25" fill={palette.accent} />
            <Circle cx="16" cy="11.5" r="1.25" fill={palette.accent} />
            {hasUnread && <Circle cx="18" cy="5" r="4" fill={palette.accent} stroke={palette.canvas} strokeWidth={1.5} />}
        </Svg>
    );
}
