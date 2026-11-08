import React from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { palette, type, fonts } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type HandPickedCardProps = {
    /** small label on the photo, e.g. "Exclusive" */
    tag: string;
    title: string;
    subtitle?: string;
    cta: string;
    imageUrl: string;
    onPress: () => void;
    /** Defaults to 68% of the screen so the next card peeks in when used in a sideways row. */
    width?: number;
};

// Card for the "Hand-Picked for You" row, built like our event cards: cream surface with the orange outline and soft
// shadow, photo on top with an orange tag, then the title, a line of text and a solid orange button.
export default function HandPickedCard({ tag, title, subtitle, cta, imageUrl, onPress, width = SCREEN_WIDTH * 0.68 }: HandPickedCardProps) {
    return (
        <View
            style={{
                width,
                shadowColor: palette.ink,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.26,
                shadowRadius: 18,
                elevation: 7,
            }}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${cta}`}
                style={{ flex: 1, backgroundColor: palette.surface, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}
            >
                <View style={{ height: 180, backgroundColor: '#F2DFD7' }}>
                    <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999, backgroundColor: palette.accent, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }}>
                        <Text style={{ ...type.micro, fontSize: 10, lineHeight: 13, fontFamily: fonts.bold, color: '#FFFFFF', letterSpacing: 0.6, textTransform: 'uppercase' }}>{tag}</Text>
                    </View>
                </View>

                <View style={{ flex: 1, padding: 14, gap: 6 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, color: palette.accent }}>{title}</Text>
                    {!!subtitle && (
                        <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.bodyText }}>{subtitle}</Text>
                    )}
                    <View style={{ flexGrow: 1 }} />
                    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: palette.accent }}>
                        <Text style={{ ...type.body, fontSize: 13, lineHeight: 18, fontFamily: fonts.semibold, color: '#FFFFFF' }}>{cta}</Text>
                        <ArrowRight size={14} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
}
