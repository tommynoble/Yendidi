import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSegments } from 'expo-router';
import IntroVideoScreen from '@/components/IntroVideoScreen';

// How long the app screen gets to draw its first frame (and start its queries) once it's open, before the intro lifts.
const PAINT_GRACE_MS = 450;
const FADE_MS = 300;

// The intro video as a layer on top of the whole app, not a screen you navigate away from. The app's first screen opens
// underneath it while it plays, and the layer only fades out once (a) the intro sequence has finished and (b) the app has
// navigated to its real first screen and had a moment to paint. So there is never a frame with nothing drawn.
export default function IntroOverlay() {
    const segments = useSegments();
    const [introDone, setIntroDone] = useState(false);
    const [visible, setVisible] = useState(true);
    const opacity = useRef(new Animated.Value(1)).current;

    // The entry route (app/index.tsx) has no segments; once it has redirected, the first real screen's segments appear.
    const appOpen = segments.length > 0;

    useEffect(() => {
        if (!introDone || !appOpen) return;
        const timer = setTimeout(() => {
            Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => setVisible(false));
        }, PAINT_GRACE_MS);
        return () => clearTimeout(timer);
    }, [introDone, appOpen, opacity]);

    if (!visible) return null;

    return (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity, zIndex: 1000, elevation: 1000 }]} pointerEvents="auto">
            <IntroVideoScreen source={require('@/assets/video/home.mp4')} onContinue={() => setIntroDone(true)} />
        </Animated.View>
    );
}
