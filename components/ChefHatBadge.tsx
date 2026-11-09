import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, G } from 'react-native-svg';
import { KITCHEN_POT_PATH } from '@/components/KitchenPotIcon';

// The Kitchen Mode icon: a white cooking pot with steam on a rounded orange tile.
export default function ChefHatBadge({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="chefTile" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#B85226" />
          <Stop offset="100%" stopColor="#E07545" />
        </LinearGradient>
      </Defs>

      <Rect x="0" y="0" width="48" height="48" rx="16" fill="url(#chefTile)" />
      <Rect x="0.5" y="0.5" width="47" height="47" rx="15.5" fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={1} />

      <G transform="translate(14.1, 11) scale(1.24)">
        <Path d={KITCHEN_POT_PATH} fill="#FFFFFF" />
      </G>
    </Svg>
  );
}
