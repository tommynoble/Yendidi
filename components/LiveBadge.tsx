import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { palette, type } from '@/constants/theme';

const LIVE_GREEN = '#00A862';
const LIVE_TEXT = '#006A3C';

// Status for a host's event: a small pulsing green dot and "Live" while guests can book it, a still grey dot and "Paused" otherwise.
export default function LiveBadge({ live = true }: { live?: boolean }) {
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!live) return;
        const loop = Animated.loop(
            Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true })
        );
        loop.start();
        return () => loop.stop();
    }, [live]);

    return (
        <View accessibilityLabel={live ? 'Live' : 'Paused'} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
                {live && (
                    <Animated.View
                        style={{
                            position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: LIVE_GREEN,
                            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                        }}
                    />
                )}
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: live ? LIVE_GREEN : palette.skeleton }} />
            </View>
            <Text style={{ fontFamily: type.micro.fontFamily, fontSize: 10, lineHeight: 13, color: live ? LIVE_TEXT : palette.muted }}>{live ? 'Live' : 'Paused'}</Text>
        </View>
    );
}
