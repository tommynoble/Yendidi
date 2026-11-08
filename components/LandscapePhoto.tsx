import React from 'react';
import { View, ImageSourcePropType } from 'react-native';
import ShimmerImage from '@/components/ShimmerImage';

// Full-width photo in a fixed landscape frame (width / height), so every card photo is the same wide, short shape
// whatever the picture's own size. Children (heart button, badges) are drawn on top of the photo.
export default function LandscapePhoto({ source, ratio = 1.7, children }: { source: ImageSourcePropType; ratio?: number; children?: React.ReactNode }) {
    return (
        <View style={{ width: '100%', aspectRatio: ratio, overflow: 'hidden', backgroundColor: '#F2DFD7' }}>
            <ShimmerImage source={source} style={{ width: '100%', height: '100%' }} />
            {children}
        </View>
    );
}
