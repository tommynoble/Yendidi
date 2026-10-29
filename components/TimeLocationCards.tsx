import React from 'react';
import { View, Text } from 'react-native';
import { Calendar, CalendarCheck, Clock, MapPin } from 'lucide-react-native';

type TimeLocationCardsProps = {
    /** e.g. "Sunday, Nov 8", or "Ready in 30 min" for dishes with no scheduled session */
    dateTitle: string;
    timeLine?: string;
    /** small green note under the time, e.g. "4 spots left" */
    timeNote?: string;
    scheduled: boolean;
    locationTitle: string;
    locationTag?: string;
    locationLine?: string;
    locationNote?: string;
};

// Two compact stacked cards: when, and where (Time & Location Cards_margin.svg).
export default function TimeLocationCards({ dateTitle, timeLine, timeNote, scheduled, locationTitle, locationTag, locationLine, locationNote }: TimeLocationCardsProps) {
    const card = { backgroundColor: 'rgba(191,89,43,0.06)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 } as const;
    const iconBox = { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' } as const;

    return (
        <View style={{ gap: 8 }}>
            <View style={card}>
                <View style={[iconBox, { backgroundColor: '#FFDBCE' }]}>
                    {scheduled ? <Calendar size={16} color="#370E00" /> : <Clock size={16} color="#370E00" />}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, lineHeight: 20, color: '#1B1C19' }}>{dateTitle}</Text>
                    {!!timeLine && <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 17, color: '#55433C' }}>{timeLine}</Text>}
                    {!!timeNote && <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, lineHeight: 14, color: '#006D40', marginTop: 1 }}>{timeNote}</Text>}
                </View>
                {scheduled && (
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#F2DFD7', alignItems: 'center', justifyContent: 'center' }}>
                        <CalendarCheck size={13} color="#55433C" />
                    </View>
                )}
            </View>

            <View style={card}>
                <View style={[iconBox, { backgroundColor: '#8AF5B4' }]}>
                    <MapPin size={16} color="#007243" />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, lineHeight: 20, color: '#1B1C19', flexShrink: 1 }} numberOfLines={1}>{locationTitle}</Text>
                        {!!locationTag && <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#715C00' }}>{locationTag}</Text>}
                    </View>
                    {!!locationLine && <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 17, color: '#55433C' }}>{locationLine}</Text>}
                    {!!locationNote && <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 15, color: '#88726B', marginTop: 1 }}>{locationNote}</Text>}
                </View>
            </View>
        </View>
    );
}
