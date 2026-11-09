import React from 'react';
import { View, Text, TouchableOpacity, Pressable, Dimensions } from 'react-native';
import { Calendar as CalendarIcon, MapPin } from 'lucide-react-native';
import { format } from 'date-fns';
import { getDishImage } from '@/constants/Images';
import { SESSION_SERVING_CAP } from '@/lib/schedule';
import { formatPotCountdownShort, isPotCountdownActive } from '@/lib/countdown';
import { palette, type, fonts } from '@/constants/theme';
import HeartButton from '@/components/HeartButton';
import LandscapePhoto from '@/components/LandscapePhoto';
import SeatStack from '@/components/SeatStack';
import AnimatedHeartOverlay from '@/components/AnimatedHeartOverlay';

const { width } = Dimensions.get('window');

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

// STYLE 2 — the readability layout: big landscape photo, title left with the price right, description, date and
// location beside a "Book a Seat" button, then the guest chips, seats-left pill and a "View Details" link.
export default function EventCardStyle2({ item, saved, onToggleSaved, animatingLike = false, onPress, marginBottom = 36 }: Props) {
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
                onPress={() => onPress()}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}
              >
                <View style={{ backgroundColor: palette.surface, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}>
                  {/* a shorter photo (210px at this width, was 300) so the next card peeks in under it */}
                  <LandscapePhoto source={getDishImage(item.title || item.name, item.image)} ratio={(width - 34) / 210}>
                    <HeartButton saved={saved} onPress={() => onToggleSaved()} size={36} iconSize={18} style={{ position: 'absolute', top: 10, right: 10 }} />
                    <AnimatedHeartOverlay visible={animatingLike} />
                {!!item.order_deadline && isPotCountdownActive(item.order_deadline) && (
                    <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: palette.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: 'white' }}>{formatPotCountdownShort(item.order_deadline)}</Text>
                    </View>
                )}
                  </LandscapePhoto>

                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 }}>
                  {/* Title left, price right */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 14 }}>
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 21, lineHeight: 27, color: palette.accent }} numberOfLines={2} ellipsizeMode="tail">{item.title || item.name}</Text>
                    <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                        <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink }}>GH₵</Text>
                        <Text style={{ ...type.hero, fontFamily: fonts.bold, color: palette.ink }}>{item.price}</Text>
                      </View>
                      <Text style={{ ...type.meta, color: palette.bodyText }}>per seat</Text>
                    </View>
                  </View>

                  {!!item.description?.trim() && (
                    <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.bodyText, marginTop: 8 }} numberOfLines={3} ellipsizeMode="tail">{item.description.trim()}</Text>
                  )}

                  {/* When, where and the booking button */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      {!!item.order_deadline && (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                          <View style={{ marginTop: 2 }}><CalendarIcon size={16} color={palette.accent} strokeWidth={2.25} /></View>
                          <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.ink, flexShrink: 1 }}>
                            {format(new Date(item.order_deadline), "EEE, MMM d '•' h:mm a")}
                          </Text>
                        </View>
                      )}
                      {!!item.profiles?.location && (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                          <View style={{ marginTop: 2 }}><MapPin size={16} color={palette.accent} strokeWidth={2.25} /></View>
                          <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.ink, flexShrink: 1 }} numberOfLines={2} ellipsizeMode="tail">{item.profiles.location}</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => onPress()}
                      activeOpacity={0.85}
                      accessibilityLabel="Book a seat"
                      style={{ paddingHorizontal: 22, paddingVertical: 9, borderRadius: 8, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ ...type.body, fontSize: 13, lineHeight: 18, fontFamily: fonts.semibold, color: 'white' }} numberOfLines={1}>Book a Seat</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Who is coming, seats left, details link */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(219,193,184,0.6)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
                      <SeatStack id={item.id} booked={Math.max(0, SESSION_SERVING_CAP - (item.portions_available ?? SESSION_SERVING_CAP))} size={40} />
                      <View style={{ backgroundColor: palette.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ ...type.micro, color: 'white' }} numberOfLines={1}>
                          {item.portions_available > 0 ? `${item.portions_available} spot${item.portions_available === 1 ? '' : 's'} left` : 'Fully booked'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.accent }}>View Details</Text>
                  </View>
                  </View>
                </View>
              </Pressable>
        </View>
    );
}
