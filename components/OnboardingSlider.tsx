import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, useWindowDimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, type } from '@/constants/theme';

const SLIDES = [
    { image: require('@/assets/images/dishes/waakye_special.jpg'), quote: "Felt just like eating at my grandmother's house!" },
    { image: require('@/assets/images/dishes/jollof_rice_chicken.jpg'), quote: 'The best jollof I have had outside my own kitchen.' },
    { image: require('@/assets/images/dishes/fufu_light_soup.jpg'), quote: 'I came as a stranger and left with new friends.' },
    { image: require('@/assets/images/dishes/banku_tilapia.jpg'), quote: 'Fresh tilapia, warm hosts, and a seat saved for me.' },
];

const INTERVAL_MS = 3500;

// Auto-advancing photo slider for the welcome page. Swipe works too; auto-advance restarts after a swipe.
// `horizontalMargin` is the space left on each side of the slider, so slides are exactly one slider wide.
export default function OnboardingSlider({ height = 340, horizontalMargin = 20 }: { height?: number; horizontalMargin?: number }) {
    const { width: screenWidth } = useWindowDimensions();
    const width = screenWidth - horizontalMargin * 2;
    const scrollRef = useRef<ScrollView>(null);
    const [index, setIndex] = useState(0);

    // Advance on a timer. Depending on `index` restarts the countdown after every change, swipes included.
    useEffect(() => {
        const timer = setTimeout(() => {
            const next = (index + 1) % SLIDES.length;
            scrollRef.current?.scrollTo({ x: next * width, animated: true });
            setIndex(next);
        }, INTERVAL_MS);
        return () => clearTimeout(timer);
    }, [index, width]);

    const onSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    };

    return (
        <View style={{ marginHorizontal: horizontalMargin, marginTop: 12, height, borderRadius: 16, overflow: 'hidden' }}>
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onSwipeEnd}
                scrollEventThrottle={16}
            >
                {SLIDES.map((slide, i) => (
                    <View key={i} style={{ width, height }}>
                        <Image source={slide.image} style={{ width, height }} resizeMode="cover" />
                        <LinearGradient
                            colors={['transparent', 'rgba(35, 25, 21, 0.55)']}
                            start={{ x: 0.5, y: 0.4 }}
                            end={{ x: 0.5, y: 1 }}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        />
                        {/* Floating review card */}
                        <View
                            style={{
                                position: 'absolute',
                                top: 20,
                                right: 16,
                                maxWidth: 170,
                                padding: 12,
                                borderRadius: 16,
                                backgroundColor: 'rgba(255,255,255,0.96)',
                                transform: [{ rotate: '3deg' }],
                                shadowColor: palette.ink,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.14,
                                shadowRadius: 10,
                                elevation: 4,
                            }}
                        >
                            <View style={{ flexDirection: 'row', gap: 2, marginBottom: 4 }}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <Star key={s} size={11} color={palette.accent} fill={palette.accent} />
                                ))}
                            </View>
                            <Text style={{ ...type.micro, fontFamily: 'PlusJakartaSans_500Medium', color: palette.ink, fontStyle: 'italic' }}>"{slide.quote}"</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* Page dots */}
            <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }} pointerEvents="none">
                {SLIDES.map((_, i) => (
                    <View
                        key={i}
                        style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? palette.surface : 'rgba(251,245,242,0.55)' }}
                    />
                ))}
            </View>
        </View>
    );
}
