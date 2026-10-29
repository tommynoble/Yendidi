import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

// Shopping cart in the shape of Container (2).svg (20x20), drawn as a thin outline.
// `strokeWidth` is in the 20-unit box; lower is thinner.
export default function CartIcon({ size = 14, color = '#55433C', strokeWidth = 1.4 }: { size?: number; color?: string; strokeWidth?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
            <Path
                d="M1 1h2.6l3.3 9.8h7.7l3.2-8H4.6M6.9 10.8 6 13.4h11"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Circle cx={6.3} cy={17.2} r={1.4} stroke={color} strokeWidth={strokeWidth} />
            <Circle cx={15.6} cy={17.2} r={1.4} stroke={color} strokeWidth={strokeWidth} />
        </Svg>
    );
}
