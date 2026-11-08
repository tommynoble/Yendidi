import React from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Calendar as CalendarIcon, Utensils } from 'lucide-react-native';
import { format } from 'date-fns';
import { getDishImage } from '@/constants/Images';
import { formatPotCountdownCompactBadge, isPotCountdownActive } from '@/lib/countdown';
import { palette, type, fonts } from '@/constants/theme';
import HeartButton from '@/components/HeartButton';
import ShimmerImage from '@/components/ShimmerImage';
import HostRow from '@/components/HostRow';
import PeopleIcon from '@/components/PeopleIcon';
import AnimatedHeartOverlay from '@/components/AnimatedHeartOverlay';

type Props = {
    /** a listing row from Supabase, with its `profiles` join */
    item: any;
    saved: boolean;
    onToggleSaved: () => void;
    animatingLike?: boolean;
    onPress: () => void;
    /** Defaults to half the screen so the next card peeks in when used in a sideways row. */
    width?: number;
};

// Small listing card for sideways rows: photo with the like heart and a short days-left badge, host location, title,
// description, date, then seats left and price with a reserve button.
export default function EventCardCompact({ item, saved, onToggleSaved, animatingLike = false, onPress, width = Dimensions.get('window').width * 0.5 }: Props) {
    return (
        <View
          key={`popular-wrapper-${item.id}`}
          style={{
            width,
            shadowColor: palette.ink,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.26,
            shadowRadius: 18,
            elevation: 7,
          }}
        >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: palette.surface,
            borderRadius: 24,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(194, 83, 39,0.35)',
          }}
          activeOpacity={0.85}
          onPress={() => onPress()}
        >
          <View style={{ height: 155, backgroundColor: '#F2DFD7', position: 'relative' }}>
            <ShimmerImage source={getDishImage(item.title || item.name, item.image)} style={{ width: '100%', height: '100%' }} />
            <HeartButton saved={saved} onPress={() => onToggleSaved()} size={24} iconSize={12} style={{ position: 'absolute', top: 8, left: 8 }} />
            <AnimatedHeartOverlay visible={animatingLike} />
            {!!item.order_deadline && isPotCountdownActive(item.order_deadline) && !!formatPotCountdownCompactBadge(item.order_deadline) && (
              <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: palette.accent, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: 'white' }}>{formatPotCountdownCompactBadge(item.order_deadline)}</Text>
              </View>
            )}
            {item.order_deadline && isPotCountdownActive(item.order_deadline) && (
              <View
                style={{
                  position: 'absolute',
                  left: 8,
                  bottom: 8,
                  maxWidth: '92%',
                  height: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  borderRadius: 9999,
                  backgroundColor: 'rgba(251,245,242,0.95)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <CalendarIcon size={12} color={palette.accent} strokeWidth={2.25} />
                <Text style={{ ...type.micro, color: palette.accent, flexShrink: 1 }} numberOfLines={1}>
                  {format(new Date(item.order_deadline), "EEE, MMM d '•' h:mm a")}
                </Text>
              </View>
            )}
          </View>
          <View style={{ padding: 12, flex: 1 }}>
            <View style={{ marginBottom: 4 }}>
              <HostRow compact showAvatar={false} showName={false} location={item.profiles?.location?.split(',')[0]?.trim()} />
            </View>
            <Text style={{ ...type.cardTitleSmall, color: palette.ink }} numberOfLines={2} ellipsizeMode="tail">{item.title || item.name}</Text>
            <View style={{ flexGrow: 1, marginTop: 3 }}>
              {!!item.description?.trim() && (
                <Text style={{ ...type.meta, color: palette.bodyText }} numberOfLines={2} ellipsizeMode="tail">{item.description.trim()}</Text>
              )}
            </View>
            {/* Price + reserve footer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(219,193,184,0.5)' }}>
              <View style={{ flexShrink: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <PeopleIcon height={8} />
                  <Text style={{ ...type.micro, color: palette.muted, flexShrink: 1 }} numberOfLines={1}>
                    {item.portions_available > 0 ? `${item.portions_available} spot${item.portions_available === 1 ? '' : 's'} left` : 'Fully booked'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                    <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.accent }}>GH₵</Text>
                    <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.accent }} numberOfLines={1}>{item.price}</Text>
                  </View>
                  <Text style={{ ...type.micro, fontFamily: fonts.regular, color: palette.muted }}>/seat</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => onPress()}
                activeOpacity={0.85}
                accessibilityLabel="Reserve a seat"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  backgroundColor: palette.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <Utensils size={13} color="white" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
        </View>

    );
}
