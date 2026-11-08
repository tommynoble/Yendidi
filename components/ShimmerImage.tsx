import React, { useState } from 'react';
import { View, Image, ImageSourcePropType, ImageResizeMode, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import ShimmerBox from '@/components/ShimmerBox';

// An image that shows a shimmering placeholder until it has downloaded, so there are no blank gaps while photos load.
// Photos bundled with the app (require) are instant, so they skip the placeholder. Give it the size the image should fill.
export default function ShimmerImage({ source, style, resizeMode = 'cover' }: { source: ImageSourcePropType; style?: StyleProp<ViewStyle>; resizeMode?: ImageResizeMode }) {
    const [done, setDone] = useState(typeof source === 'number');

    return (
        <View style={[{ overflow: 'hidden' }, style]}>
            <Image source={source} style={StyleSheet.absoluteFillObject} resizeMode={resizeMode} onLoadEnd={() => setDone(true)} />
            {!done && <ShimmerBox style={StyleSheet.absoluteFillObject} />}
        </View>
    );
}
