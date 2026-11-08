import React, { useEffect, useState } from 'react';
import { View, Text, Image, ImageSourcePropType, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { palette, type, fonts } from '@/constants/theme';
import ShimmerBox from '@/components/ShimmerBox';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FeatureCardProps = {
    /** small label on the top left, e.g. "EXCLUSIVE" */
    tag: string;
    title: string;
    subtitle?: string;
    /** text of the button pill at the bottom */
    cta: string;
    /** Remote photo; use `image` instead for a file bundled with the app. */
    imageUrl?: string;
    image?: ImageSourcePropType;
    /** Which part of a bundled photo stays in view when it has to be cropped: 0 keeps the top, 1 the bottom. Default 0.5 (centre). */
    focusY?: number;
    /** 'top-right' pins a bundled photo to the top-right corner of the card (subject on the right, text clear on the left). Default 'cover'. */
    anchor?: 'cover' | 'top-right' | 'logo';
    /** Card background, for a logo that sits on its own colour (used with anchor 'logo'). */
    bgColor?: string;
    /** Tall editorial version for the main "Hand-Picked" row: bigger, text across the full width. Compact by default. */
    tall?: boolean;
    onPress: () => void;
    /** Defaults to 68% of the screen so the next card peeks in when used in a sideways row. */
    width?: number;
};

// Photo card for the "Featured" row: dark warm gradient over the photo, a brand-orange tag, headline, optional line of
// text and a frosted, fully rounded button pill.
export default function FeatureCard({ tag, title, subtitle, cta, imageUrl, image, focusY = 0.5, anchor = 'cover', bgColor, tall = false, onPress, width = SCREEN_WIDTH * (tall ? 0.64 : 0.68) }: FeatureCardProps) {
    const [box, setBox] = useState<{ w: number; h: number } | null>(null);
    // web photos show a shimmer until they arrive; bundled ones are instant
    const [photoLoaded, setPhotoLoaded] = useState(typeof image === 'number');

    // "cover" always crops from the centre. For bundled photos we scale to cover ourselves and choose which part stays visible.
    // Web photos have no size up front, so ask for it; until it arrives the photo simply fills the card.
    const [remoteSize, setRemoteSize] = useState<{ width: number; height: number } | null>(null);
    useEffect(() => {
        if (image || !imageUrl) return;
        let cancelled = false;
        Image.getSize(imageUrl, (width, height) => { if (!cancelled) setRemoteSize({ width, height }); }, () => {});
        return () => { cancelled = true; };
    }, [image, imageUrl]);
    const asset = typeof image === 'number' ? Image.resolveAssetSource(image) : remoteSize;
    let photoStyle: any = StyleSheet.absoluteFillObject;
    let fadeLeft: number | null = null; // where the photo's left edge is, when it doesn't reach the card's left edge
    if (asset && box && asset.width && asset.height) {
        if (anchor === 'logo') {
            // a logo is shown whole, small, in the top-right corner, on the card's own background colour
            const lw = box.w * 0.44;
            photoStyle = { position: 'absolute', width: lw, height: (lw * asset.height) / asset.width, right: 14, top: 22 };
        } else if (anchor === 'top-right') {
            // fill the height and at least 75% of the width, then pin to the top-right corner
            let scale = Math.max(box.h / asset.height, (box.w * 0.75) / asset.width);
            // a wide photo that would end up wider than the card is scaled to ~108% of the card's width instead, so the
            // subject really lands on the right (the card's colour and overlay cover whatever is left below it)
            if (asset.width * scale > box.w * 1.3) scale = (box.w * 1.08) / asset.width;
            const dw = asset.width * scale;
            const dh = asset.height * scale;
            // nudge past the right edge so the subject sits a little further right (the card clips the overflow)
            const left = box.w - dw + box.w * 0.1;
            photoStyle = { position: 'absolute', width: dw, height: dh, left, top: 0 };
            if (left > 0) fadeLeft = left;
        } else {
            const scale = Math.max(box.w / asset.width, box.h / asset.height);
            const dw = asset.width * scale;
            const dh = asset.height * scale;
            photoStyle = { position: 'absolute', width: dw, height: dh, left: (box.w - dw) / 2, top: (box.h - dh) * focusY };
        }
    }

    // The shadow sits on an outer wrapper: iOS drops a view's own shadow when that view also clips its content (overflow hidden).
    return (
        <View
            style={{
                width,
                borderRadius: 24,
                backgroundColor: bgColor ?? palette.ink,
                shadowColor: palette.ink,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.26,
                shadowRadius: 18,
                elevation: 7,
            }}
        >
        <TouchableOpacity
            onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            activeOpacity={0.9}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${cta}`}
            style={{
                borderRadius: 24,
                overflow: 'hidden',
                backgroundColor: bgColor ?? palette.ink,
            }}
        >
            {!photoLoaded && <ShimmerBox style={StyleSheet.absoluteFillObject} />}
            <Image
                source={image ?? { uri: imageUrl }}
                style={photoStyle}
                resizeMode={anchor === 'logo' ? 'contain' : 'cover'}
                onLoadEnd={() => setPhotoLoaded(true)}
            />
            {/* soft edge where a right-pinned photo meets the card's plain dark left side */}
            {fadeLeft !== null && (
                <LinearGradient
                    colors={['rgba(61, 37, 30, 1)', 'rgba(61, 37, 30, 0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ position: 'absolute', top: 0, bottom: 0, left: fadeLeft, width: 60 }}
                />
            )}
            {/* tall cards carry more text over the photo: the bottom half fades into our orange accent so the text stays readable */}
            <LinearGradient
                colors={tall ? ['rgba(194, 83, 39, 0)', 'rgba(194, 83, 39, 0.3)', 'rgba(176, 72, 31, 0.78)'] : ['rgba(61, 37, 30, 0)', 'rgba(61, 37, 30, 0.12)', 'rgba(40, 24, 19, 0.82)']}
                locations={tall ? [0.28, 0.6, 1] : [0, 0.4, 1]}
                style={StyleSheet.absoluteFillObject}
            />
            {/* The card grows with its text, so a long title or line of text is never cut off. */}
            <View style={{ minHeight: tall ? 225 : 210, padding: 16, paddingTop: tall ? 22 : 22, justifyContent: 'space-between', gap: 16, zIndex: 1 }}>
                <View style={{ flexDirection: 'row' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 9999, backgroundColor: 'rgba(194, 83, 39, 0.9)', borderWidth: 1, borderColor: 'rgba(255, 245, 240, 0.3)' }}>
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' }} />
                        <Text style={{ ...type.micro, fontSize: 9, lineHeight: 12, fontFamily: fonts.extrabold, color: '#FFFFFF', letterSpacing: 0.9, textTransform: 'uppercase' }}>{tag}</Text>
                    </View>
                </View>

                {/* text stays on the left half so the photo's subject on the right is clear */}
                <View style={{ gap: 6, maxWidth: anchor === 'top-right' || !tall ? '55%' : '100%' }}>
                    <Text style={{ fontFamily: fonts.extrabold, fontSize: tall ? 17 : 17, lineHeight: tall ? 22 : 22, color: '#FFF5F0', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }} numberOfLines={tall ? 3 : 3} ellipsizeMode="tail">{title}</Text>
                    {!!subtitle && (
                        <Text style={{ ...type.meta, fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: tall ? '#FFF5F0' : 'rgba(255, 245, 240, 0.85)', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 }} numberOfLines={3} ellipsizeMode="tail">{subtitle}</Text>
                    )}
                    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: tall ? 6 : 12, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 9999, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.35)' }}>
                        <Text style={{ ...type.body, fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' }}>{cta}</Text>
                        <ArrowRight size={14} color="#FFFFFF" />
                    </View>
                </View>
            </View>
        </TouchableOpacity>
        </View>
    );
}
