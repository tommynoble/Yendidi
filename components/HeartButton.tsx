import React from 'react';
import { TouchableOpacity, ViewStyle } from 'react-native';
import { Heart } from 'lucide-react-native';
import { palette } from '@/constants/theme';

type HeartButtonProps = {
    saved: boolean;
    onPress: () => void;
    /** Diameter of the round backing, in px (keep >= 24 for the touch target). */
    size?: number;
    iconSize?: number;
    /** Positioning only, e.g. { position: 'absolute', top: 8, left: 8 }. */
    style?: ViewStyle;
};

// Save/favourite heart for photo cards: a `surface` (#FBF5F2) heart on a 55% black circle. Even over a pure-white photo the circle
// composites to about #737373, so the icon stays above the 3:1 WCAG 1.4.11 asks for. Outline while unsaved; once saved it fills accent orange and the circle goes solid `ink` brown (orange on it is about 3.1:1, just over the 3:1 WCAG 1.4.11 asks for), and it exposes its name and saved state to screen readers.
export default function HeartButton({ saved, onPress, size = 28, iconSize = 14, style }: HeartButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save dish'}
            accessibilityState={{ selected: saved }}
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: saved ? palette.ink : 'rgba(0,0,0,0.55)',
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                style,
            ]}
        >
            <Heart size={iconSize} color={saved ? palette.accent : palette.surface} fill={saved ? palette.accent : 'transparent'} />
        </TouchableOpacity>
    );
}
