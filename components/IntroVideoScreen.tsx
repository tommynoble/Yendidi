import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer, VideoSource } from 'expo-video';
import { SafeAreaView } from 'react-native-safe-area-context';

const HOLD_MS = 4500;

// Full-screen intro shown the moment the app opens, before the session check
// even resolves. Without a video `source` it falls back to a solid brand
// background with the same logo/tagline overlay — drop a video in later by
// just passing `source`, no other changes needed. Plays entirely on its own,
// like a brief greeting: the wordmark rises and fades in over the video,
// holds a moment, then animates back down and out into onboarding — no tap
// or swipe required.
export default function IntroVideoScreen({ source, onContinue }: {
    source?: VideoSource;
    onContinue: () => void;
}) {
    const player = useVideoPlayer(source ?? null, (p) => {
        if (source) {
            p.loop = true;
            p.play();
        }
    });

    const fade = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;
    const screenFade = useRef(new Animated.Value(1)).current;
    const wordmarkFade = useRef(new Animated.Value(0)).current;
    const wordmarkTranslateY = useRef(new Animated.Value(14)).current;
    const taglineFade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            // Logo appears first
            Animated.parallel([
                Animated.timing(fade, { toValue: 1, duration: 700, delay: 400, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 700, delay: 400, useNativeDriver: true }),
            ]),
            // "Yendidii" rises in on its own beat below the logo
            Animated.parallel([
                Animated.timing(wordmarkFade, { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.timing(wordmarkTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]),
            // Then the tagline settles in
            Animated.timing(taglineFade, { toValue: 1, duration: 400, useNativeDriver: true }),
            // Hold so it reads as a greeting, not a flash
            Animated.delay(HOLD_MS),
            // Animate back down and out, taking the whole screen with it
            Animated.parallel([
                Animated.timing(translateY, { toValue: 24, duration: 500, useNativeDriver: true }),
                Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }),
                Animated.timing(wordmarkFade, { toValue: 0, duration: 400, useNativeDriver: true }),
                Animated.timing(taglineFade, { toValue: 0, duration: 400, useNativeDriver: true }),
                Animated.timing(screenFade, { toValue: 0, duration: 500, delay: 150, useNativeDriver: true }),
            ]),
        ]).start(() => onContinue());
    }, []);

    return (
        <Animated.View style={[StyleSheet.absoluteFill, !source && { backgroundColor: '#BF592B' }, { opacity: screenFade }]}>
            {source && (
                <VideoView
                    player={player}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={false}
                />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(191,89,43,0.35)' }]} />

            <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="none">
                <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: fade, transform: [{ translateY }] }}>
                    <Image
                        source={require('@/assets/images/logo.png')}
                        style={{ width: 96, height: 96, borderRadius: 24, marginBottom: 16, overflow: 'hidden' }}
                        resizeMode="contain"
                    />
                    <Animated.Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={{
                            fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: 'white', paddingHorizontal: 24, textAlign: 'center',
                            opacity: wordmarkFade, transform: [{ translateY: wordmarkTranslateY }],
                        }}
                    >
                        Yendidii
                    </Animated.Text>
                    <Animated.Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={{
                            fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4, paddingHorizontal: 24, textAlign: 'center',
                            opacity: taglineFade,
                        }}
                    >
                        Let's Eat Together
                    </Animated.Text>
                </Animated.View>
            </SafeAreaView>
        </Animated.View>
    );
}
