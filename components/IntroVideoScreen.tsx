import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer, VideoSource } from 'expo-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '@/constants/theme';

const HOLD_MS = 4500;

// Full-screen intro shown the moment the app opens, before the session check
// even resolves. The base is always the brand orange (same as the native splash screen, so the hand-off is seamless
// and the video fades in over it). Without a video `source` it stays a solid brand
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
            // Silent video that never takes over the phone's audio: muted, and mixed with whatever else is playing
            // so the user's background music keeps going while the intro runs.
            p.muted = true;
            p.audioMixingMode = 'mixWithOthers';
            p.loop = true;
            p.play();
        }
    });

    // Orange until the video has drawn its first frame (continuing the native splash), then the page colour: if the video
    // is ever not drawing (handing over to the next screen), what shows behind it is the app's colour, never a flash of orange.
    const [videoReady, setVideoReady] = useState(!source);

    const fade = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;
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
            // Wordmark animates back down and out. The screen itself is NOT faded away: that would show the plain orange
            // behind the video. The video stays up until the app screen takes over, so it goes video -> app.
            Animated.parallel([
                Animated.timing(translateY, { toValue: 24, duration: 500, useNativeDriver: true }),
                Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }),
                Animated.timing(wordmarkFade, { toValue: 0, duration: 400, useNativeDriver: true }),
                Animated.timing(taglineFade, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
        ]).start(() => onContinue());
    }, []);

    return (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: videoReady ? palette.canvas : palette.accent }]}>
            {source && (
                <VideoView
                    player={player}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={false}
                    onFirstFrameRender={() => setVideoReady(true)}
                />
            )}
            {/* the orange wash over the video, and the solid orange before it starts */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: videoReady ? 'rgba(194, 83, 39,0.35)' : palette.accent }]} />

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
                        Eat. Drink. Socialize.
                    </Animated.Text>
                </Animated.View>
            </SafeAreaView>
        </Animated.View>
    );
}
