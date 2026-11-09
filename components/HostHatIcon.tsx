import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { palette } from '@/constants/theme';

// Host icon: a chef hat over its stove-base band, outlined. The tab bar uses it for the host's Kitchen tab.
export default function HostHatIcon({ size = 24, color = palette.ink, strokeWidth = 1.75 }: { size?: number; color?: string; strokeWidth?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12 4.5C14.485 4.5 16.5 6.29 16.5 8.5C16.5 8.893 16.447 9.274 16.347 9.635C18.157 10.155 19.5 11.66 19.5 13.5C19.5 15.71 17.485 17.5 15 17.5H9C6.515 17.5 4.5 15.71 4.5 13.5C4.5 11.66 5.843 10.155 7.653 9.635C7.55181 9.26514 7.50035 8.88345 7.5 8.5C7.5 6.29 9.515 4.5 12 4.5Z"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M7 17.5V19.75C7 20.164 7.336 20.5 7.75 20.5H16.25C16.664 20.5 17 20.164 17 19.75V17.5"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
