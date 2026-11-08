import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { palette } from '@/constants/theme';

// Watchlist icon: a bookmark with a small heart inside. `isSaved` fills the whole bookmark in the brand orange
// (and drops the heart), e.g. for the selected tab.
export default function WatchlistIcon({ size = 24, color = palette.ink, isSaved = false }: { size?: number; color?: string; isSaved?: boolean }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M5 4.75C5 3.7835 5.7835 3 6.75 3H17.25C18.2165 3 19 3.7835 19 4.75V21L12 16.5L5 21V4.75Z"
                stroke={isSaved ? palette.accent : color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={isSaved ? palette.accent : 'none'}
            />
            {!isSaved && (
                <Path
                    d="M12 7.5C11.1 6.6 9.6 6.6 8.7 7.5C7.8 8.4 7.8 9.9 8.7 10.8L12 14L15.3 10.8C16.2 9.9 16.2 8.4 15.3 7.5C14.4 6.6 12.9 6.6 12 7.5Z"
                    fill={palette.accent}
                />
            )}
        </Svg>
    );
}
