import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Fork & knife from Link.svg, redrawn as stroked outlines so it matches the lucide tab icons.
// Native ratio is 15:20, so width is derived from height to keep it undistorted.
// `strokeWidth` is in lucide units (24px grid) so it lines up with the neighbouring icons.
export default function ForkKnifeIcon({ size = 22, color = '#000', strokeWidth = 2 }: { size?: number; color?: string; strokeWidth?: number }) {
    return (
        <Svg width={(size * 15) / 20} height={size} viewBox="28 4 15 20" fill="none">
            <Path
                d="M29.4 4.7V11M34.6 4.7V11M29.4 11a2.6 2.6 0 0 0 5.2 0M32 4.7V23.3M41.6 23.3V4.7c-2.2 0-3.9 2.2-3.9 5v4.9h3.9"
                stroke={color}
                strokeWidth={(strokeWidth * 20) / 24}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
