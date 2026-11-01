import React from 'react';
import { View, Text } from 'react-native';
import { Calendar, CheckCircle2, MapPin } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import { palette, type } from '@/constants/theme';

type TimeLocationCardsProps = {
    /** e.g. "Sunday, Nov 8" */
    dateTitle: string;
    timeLine?: string;
    /** small green note under the time, e.g. "4 spots left" */
    timeNote?: string;
    locationTitle: string;
    locationTag?: string;
    locationLine?: string;
    locationNote?: string;
    /** Whether the user has confirmed they're coming. Tapping the pill calls onConfirmPress. */
    confirmed?: boolean;
    onConfirmPress?: () => void;
};

// Two compact stacked cards: when, and where (Time & Location Cards_margin.svg).
export default function TimeLocationCards({ dateTitle, timeLine, timeNote, locationTitle, locationTag, locationLine, locationNote, confirmed = false, onConfirmPress }: TimeLocationCardsProps) {
    const card = { backgroundColor: palette.surface, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 } as const;
    const iconBox = { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' } as const;

    return (
        <View style={{ gap: 8 }}>
            <View style={card}>
                <View style={[iconBox, { backgroundColor: '#FFDBCE' }]}>
                    <Calendar size={16} color="#370E00" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ ...type.cardTitleSmall, color: palette.ink }}>{dateTitle}</Text>
                    {!!timeLine && <Text style={{ ...type.meta, fontFamily: 'PlusJakartaSans_400Regular', color: palette.muted }}>{timeLine}</Text>}
                    {!!timeNote && <Text style={{ ...type.meta, fontFamily: 'PlusJakartaSans_700Bold', color: '#006D40', marginTop: 1 }}>{timeNote}</Text>}
                </View>
                {/* Tap to confirm you're coming; tap again to undo */}
                <TouchableOpacity
                    onPress={onConfirmPress}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={confirmed ? 'Confirmed. Tap to undo' : 'Tap to confirm your seat'}
                    accessibilityState={{ selected: confirmed }}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 9999,
                        backgroundColor: confirmed ? 'rgba(0,106,60,0.1)' : palette.canvas,
                    }}
                >
                    {confirmed && <CheckCircle2 size={14} color="#006A3C" />}
                    <Text style={{ ...type.micro, color: confirmed ? '#006A3C' : palette.ink }}>{confirmed ? 'Confirmed' : 'Tap to confirm'}</Text>
                </TouchableOpacity>
            </View>

            <View style={card}>
                <View style={[iconBox, { backgroundColor: '#8AF5B4' }]}>
                    <MapPin size={16} color="#007243" />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={{ ...type.meta, fontFamily: 'PlusJakartaSans_700Bold', color: palette.ink, flexShrink: 1 }} numberOfLines={1}>{locationTitle}</Text>
                        {!!locationTag && <Text style={{ ...type.micro, color: '#715C00' }}>{locationTag}</Text>}
                    </View>
                    {!!locationLine && <Text style={{ ...type.meta, fontFamily: 'PlusJakartaSans_400Regular', color: palette.muted }}>{locationLine}</Text>}
                    {!!locationNote && <Text style={{ ...type.micro, fontFamily: 'PlusJakartaSans_400Regular', color: palette.muted, marginTop: 1 }}>{locationNote}</Text>}
                </View>
            </View>
        </View>
    );
}
