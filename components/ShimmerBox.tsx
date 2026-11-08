import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '@/constants/theme';

// Loading placeholder: the app's skeleton tan with a soft cream highlight sweeping across it, left to right, on a loop.
// Size it with `style` (width, height, borderRadius), like any View.
export default function ShimmerBox({ style }: { style?: StyleProp<ViewStyle> }) {
    const [w, setW] = useState(0);
    const sweep = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
        loop.start();
        return () => loop.stop();
    }, [sweep]);

    return (
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[{ backgroundColor: palette.skeleton, overflow: 'hidden' }, style]}>
            {w > 0 && (
                <Animated.View
                    pointerEvents="none"
                    style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: w, transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-w, w] }) }] }}
                >
                    <LinearGradient
                        colors={['rgba(255, 245, 240, 0)', 'rgba(255, 245, 240, 0.6)', 'rgba(255, 245, 240, 0)']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={{ flex: 1 }}
                    />
                </Animated.View>
            )}
        </View>
    );
}
