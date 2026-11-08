import React from 'react';
import { View, Text, Image, TouchableOpacity, Pressable } from 'react-native';
import { Calendar as CalendarIcon } from 'lucide-react-native';
import { format } from 'date-fns';
import { getDishImage } from '@/constants/Images';
import { formatPotCountdownBadge, isPotCountdownActive } from '@/lib/countdown';
import { palette, type, fonts } from '@/constants/theme';
import HeartButton from '@/components/HeartButton';
import HostRow from '@/components/HostRow';
import PeopleIcon from '@/components/PeopleIcon';
import AnimatedHeartOverlay from '@/components/AnimatedHeartOverlay';

type Props = {
    /** a listing row from Supabase, with its `profiles` join */
    item: any;
    saved: boolean;
    onToggleSaved: () => void;
    /** true while the "liked" heart animation should play over the photo */
    animatingLike?: boolean;
    onPress: () => void;
    marginBottom?: number;
};

// STYLE 1 — the original event card: photo with the badges and heart on top, host location, title, description,
// then seats left + price and a "Reserve Seat" button underneath.
export default function EventCardStyle1({ item, saved, onToggleSaved, animatingLike = false, onPress, marginBottom = 36 }: Props) {
    return (
        <View
            style={{
                marginHorizontal: 16,
                marginBottom,
                shadowColor: palette.ink,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.26,
                shadowRadius: 20,
                elevation: 8,
            }}
        >
            <Pressable
              style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
              onPress={() => onPress()}
            >
              <View style={{ backgroundColor: palette.surface, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}>
                <View style={{ position: 'relative', height: 300, backgroundColor: '#F2DFD7' }}>
                  <Image source={getDishImage(item.title || item.name, item.image)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  <AnimatedHeartOverlay visible={animatingLike} />
                  <HeartButton saved={saved} onPress={onToggleSaved} size={36} iconSize={18} style={{ position: 'absolute', top: 12, right: 12 }} />
                  {item.order_deadline && isPotCountdownActive(item.order_deadline) && (
                    <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: palette.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: 'white' }}>{formatPotCountdownBadge(item.order_deadline)}</Text>
                    </View>
                  )}
                  {item.order_deadline && isPotCountdownActive(item.order_deadline) && (
                    <View
                      style={{
                        position: 'absolute',
                        left: 12,
                        bottom: 12,
                        maxWidth: '75%',
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
                <View style={{ padding: 16, paddingBottom: 16 }}>
                  <View style={{ marginBottom: 6 }}>
                    <HostRow showAvatar={false} showName={false} location={item.profiles?.location} />
                  </View>
                  <Text style={{ ...type.card, fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: palette.ink }} numberOfLines={2}>{item.title || item.name}</Text>
                  {!!item.description?.trim() && (
                    <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.bodyText, marginTop: 4 }} numberOfLines={3} ellipsizeMode="tail">{item.description.trim()}</Text>
                  )}
                  {/* Price + reserve footer */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(219,193,184,0.5)' }}>
                    <View style={{ flexShrink: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <PeopleIcon height={10} />
                        <Text style={{ ...type.micro, color: palette.muted, flexShrink: 1 }} numberOfLines={1}>
                          {item.portions_available > 0 ? `${item.portions_available} spot${item.portions_available === 1 ? '' : 's'} left` : 'Fully booked'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                          <Text style={{ ...type.section, fontFamily: fonts.bold, color: palette.accent }}>GH₵</Text>
                          <Text style={{ ...type.section, fontFamily: fonts.bold, color: palette.accent }} numberOfLines={1}>{item.price}</Text>
                        </View>
                        <Text style={{ ...type.micro, fontFamily: fonts.regular, color: palette.muted }}>/seat</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => onPress()}
                      activeOpacity={0.85}
                      accessibilityLabel="Reserve a seat"
                      style={{
                        height: 32,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        gap: 6,
                        borderRadius: 8,
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
                      <Text style={{ ...type.meta, fontFamily: fonts.bold, color: 'white' }} numberOfLines={1}>Reserve Seat</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Pressable>
        </View>
    );
}
