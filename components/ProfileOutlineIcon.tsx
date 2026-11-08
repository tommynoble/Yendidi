import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { palette } from '@/constants/theme';

// Profile icon: a round head over a shoulders arc, outlined.
export default function ProfileOutlineIcon({ size = 24, color = palette.ink, strokeWidth = 1.75 }: { size?: number; color?: string; strokeWidth?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="7.5" r="4" stroke={color} strokeWidth={strokeWidth} />
            <Path d="M4.75 19.25C5.45 15.65 8.4 13.5 12 13.5C15.6 13.5 18.55 15.65 19.25 19.25" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        </Svg>
    );
}
