import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Smile } from 'lucide-react-native';
import { palette, type, fonts } from '@/constants/theme';

export type TableGuest = {
    name: string;
    role?: string;
    /** circle background / initials colour, cycled when not given */
    bg?: string;
    fg?: string;
};

type TableGuestsProps = {
    guests: TableGuest[];
    seatsClaimed: number;
    spacesWaiting: number;
    /** right-hand label next to the title */
    mood?: string;
    /** when set, "Join fellowship" becomes a tappable link */
    onJoin?: () => void;
    /** set false when the title and counts are shown in a heading outside the card */
    showHeader?: boolean;
};

const PALETTE = [
    { bg: '#FFDBCE', fg: '#944421' },
    { bg: '#8DF8B7', fg: '#006D40' },
    { bg: '#FFE17B', fg: '#715C00' },
    { bg: '#F2DFD7', fg: palette.muted },
];

const initials = (name: string) =>
    name
        .replace(/[^A-Za-z\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');

// "Who's at the Table" card: seat counts, a row of guests, and a join prompt.
export default function TableGuests({ guests, seatsClaimed, spacesWaiting, mood = 'Friendly crowd', onJoin, showHeader = true }: TableGuestsProps) {
    return (
        <View style={{ backgroundColor: palette.surface, borderRadius: 16, padding: 14 }}>
            {showHeader && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flexShrink: 1 }}>
                    <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink }}>Who's at the Table</Text>
                    <Text style={{ ...type.micro, fontFamily: fonts.medium, color: palette.muted, marginTop: 1 }}>
                        {seatsClaimed} seat{seatsClaimed === 1 ? '' : 's'} claimed • {spacesWaiting} space{spacesWaiting === 1 ? '' : 's'} waiting
                    </Text>
                </View>
                {!!mood && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Smile size={13} color={palette.accent} />
                        <Text style={{ ...type.micro, color: palette.accent }}>{mood}</Text>
                    </View>
                )}
            </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: showHeader ? 14 : 0 }}>
                {guests.map((g, i) => {
                    const colour = { bg: g.bg ?? PALETTE[i % PALETTE.length].bg, fg: g.fg ?? PALETTE[i % PALETTE.length].fg };
                    return (
                        <View key={`${g.name}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
                            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colour.bg, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ ...type.cardTitleSmall, color: colour.fg }}>{initials(g.name)}</Text>
                            </View>
                            <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: palette.ink, marginTop: 6 }} numberOfLines={1}>{g.name}</Text>
                            {!!g.role && <Text style={{ ...type.micro, fontFamily: fonts.regular, color: palette.muted }} numberOfLines={1}>{g.role}</Text>}
                        </View>
                    );
                })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 14, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.surface, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#715C00' }} />
                    <Text style={{ ...type.micro, fontFamily: fonts.medium, color: palette.muted }} numberOfLines={1}>Next open seat is yours!</Text>
                </View>
                {onJoin ? (
                    <TouchableOpacity onPress={onJoin} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={{ ...type.micro, fontFamily: fonts.bold, color: '#944421' }}>Join fellowship</Text>
                    </TouchableOpacity>
                ) : (
                    <Text style={{ ...type.micro, fontFamily: fonts.bold, color: '#944421' }}>Join fellowship</Text>
                )}
            </View>
        </View>
    );
}
