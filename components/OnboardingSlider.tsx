import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, Animated, Easing, PanResponder, LayoutAnimation, useWindowDimensions, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { palette } from '@/constants/theme';

type Slide = {
    key: string;
    image: ImageSourcePropType;
};

const PHOTO_SLIDES: Slide[] = [
    { key: 'p-fufu', image: require('@/assets/images/dishes/fufu_light_soup.jpg') },
    { key: 'p-jollof', image: require('@/assets/images/dishes/jollof_rice_chicken.jpg') },
    { key: 'p-waakye', image: require('@/assets/images/dishes/waakye_special.jpg') },
    { key: 'p-banku', image: require('@/assets/images/dishes/banku_tilapia.jpg') },
];

const INTERVAL_MS = 4200;
const SLIDE_MS = 700;
const BORDER = 2;
const MAX_LISTING_SLIDES = 4;

// Only hosts' own uploaded photos: stock or placeholder links would look out of place next to the real ones.
const realPhotoUrl = (raw?: string | null): string | null => {
    const first = (raw || '').split(',')[0].trim();
    if (!first || first.includes('unsplash.com') || first.includes('placeholder')) return null;
    return first;
};

// The newest available listings that have a real photo, for the welcome page. Any failure (or no access before sign-in)
// just means the bundled slides are used on their own.
async function fetchLatestListingSlides(): Promise<Slide[]> {
    const { data, error } = await supabase
        .from('listings')
        .select('id, image')
        .eq('available', true)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error || !data) return [];

    const slides: Slide[] = [];
    for (const row of data) {
        const uri = realPhotoUrl(row.image);
        if (!uri) continue;
        slides.push({ key: `l-${row.id}`, image: { uri } });
        if (slides.length >= MAX_LISTING_SLIDES) break;
    }
    // Load the photos now, so a slide never arrives blank.
    await Promise.all(slides.map((s) => Image.prefetch((s.image as { uri: string }).uri).catch(() => false)));
    return slides;
}

// Auto-advancing photo slider for the welcome page. Slides glide sideways and loop forever in the same direction; you can
// also drag it with a finger (it follows the finger, then settles on the nearest slide). The timer restarts after every change.
// `horizontalMargin` is the space left on each side of the slider.
export default function OnboardingSlider({ height = 340, horizontalMargin = 20 }: { height?: number; horizontalMargin?: number }) {
    const { width: screenWidth } = useWindowDimensions();
    const width = screenWidth - horizontalMargin * 2 - BORDER * 2;
    const innerHeight = height - BORDER * 2;

    const { data: listingSlides = [] } = useQuery({
        queryKey: ['welcome-latest-listings'],
        queryFn: fetchLatestListingSlides,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    // A bundled photo first (so the first slide never changes when the listings arrive), then listing and bundled photos alternating.
    const slides = useMemo(() => {
        const out: Slide[] = [PHOTO_SLIDES[0]];
        const longest = Math.max(listingSlides.length, PHOTO_SLIDES.length - 1);
        for (let i = 0; i < longest; i++) {
            if (listingSlides[i]) out.push(listingSlides[i]);
            if (PHOTO_SLIDES[i + 1]) out.push(PHOTO_SLIDES[i + 1]);
        }
        return out;
    }, [listingSlides]);

    // `n` counts slides forever (it never wraps), so looping is just n + 1 and the slide shown is slides[n % count].
    // `pos` is where the slider is right now, in the same units, animated natively; a slide with number `abs` sits at (abs - pos) widths.
    const [n, setN] = useState(0);
    const nRef = useRef(0);
    const busy = useRef(false);
    const dragging = useRef(false);
    const pos = useRef(new Animated.Value(0)).current;
    const widthRef = useRef(width);
    const countRef = useRef(slides.length);
    widthRef.current = width;
    countRef.current = slides.length;

    const settleOn = (target: number) => {
        busy.current = true;
        nRef.current = target;
        LayoutAnimation.configureNext(LayoutAnimation.create(300, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
        setN(target);
        Animated.timing(pos, {
            toValue: target,
            duration: SLIDE_MS,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
        }).start(() => { busy.current = false; });
    };
    const settleRef = useRef(settleOn);
    settleRef.current = settleOn;

    // Advance on a timer. Depending on `n` restarts the countdown after every change, swipes included.
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const tick = () => {
            if (busy.current || dragging.current) {
                timer = setTimeout(tick, 500);
                return;
            }
            settleRef.current(nRef.current + 1);
        };
        timer = setTimeout(tick, INTERVAL_MS);
        return () => clearTimeout(timer);
    }, [n]);

    const pan = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => !busy.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
            onPanResponderGrant: () => { dragging.current = true; },
            onPanResponderMove: (_, g) => { pos.setValue(nRef.current - g.dx / widthRef.current); },
            onPanResponderRelease: (_, g) => {
                dragging.current = false;
                const far = Math.abs(g.dx) > widthRef.current * 0.2 || Math.abs(g.vx) > 0.5;
                if (far && g.dx < 0) settleRef.current(nRef.current + 1);
                else if (far && g.dx > 0) settleRef.current(nRef.current - 1);
                else settleRef.current(nRef.current);
            },
            onPanResponderTerminate: () => {
                dragging.current = false;
                settleRef.current(nRef.current);
            },
        }),
    ).current;

    const count = slides.length;
    const activeIndex = ((n % count) + count) % count;
    const slideAt = (abs: number) => slides[((abs % count) + count) % count];
    // Only the slide in view and its two neighbours are drawn; keys follow the slide number so none are redrawn as the window moves.
    const visible = [n - 1, n, n + 1];

    return (
        <View
            {...pan.panHandlers}
            style={{
                marginHorizontal: horizontalMargin,
                marginTop: 12,
                height,
                borderRadius: 22,
                borderWidth: BORDER,
                borderColor: 'rgba(194, 83, 39, 0.55)',
                overflow: 'hidden',
                backgroundColor: palette.surface,
            }}
        >
            {visible.map((abs) => (
                <Animated.View
                    key={abs}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width,
                        height: innerHeight,
                        transform: [{ translateX: pos.interpolate({ inputRange: [abs - 1, abs + 1], outputRange: [width, -width] }) }],
                    }}
                >
                    <Image source={slideAt(abs).image} style={{ width, height: innerHeight }} resizeMode="cover" />
                    {/* soft shade at the bottom so the page dots stay visible on bright photos */}
                    <LinearGradient
                        colors={['transparent', 'rgba(35, 25, 21, 0.35)']}
                        start={{ x: 0.5, y: 0.6 }}
                        end={{ x: 0.5, y: 1 }}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                </Animated.View>
            ))}

            {/* Page dots */}
            <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }} pointerEvents="none">
                {slides.map((s, i) => (
                    <View
                        key={s.key}
                        style={{ width: i === activeIndex ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === activeIndex ? palette.surface : 'rgba(251,245,242,0.55)' }}
                    />
                ))}
            </View>
        </View>
    );
}
