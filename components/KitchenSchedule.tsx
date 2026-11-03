import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Pressable, Switch, Alert, ActivityIndicator, Animated } from 'react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { Clock, CalendarX, CheckCircle2, UtensilsCrossed } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { palette, type, fonts } from '@/constants/theme';
import { useCurrentUserId } from '@/lib/useCurrentUserId';
import { SESSION_SERVING_CAP } from '@/lib/schedule';

const SERVING_POOL = SESSION_SERVING_CAP;
const DAYS_SHOWN = 14;
const SOLD_OUT_GREEN = '#006A3C';

type PlannedDay = {
  sessionId: string;
  startTime: string;
  listing?: { id: string; title: string; price: number; image: string | null; portions_available: number | null; available: boolean | null };
};

const dateKey = (d: Date) => format(d, 'yyyy-MM-dd');

export default function KitchenSchedule() {
  const router = useRouter();
  const me = useCurrentUserId();
  const queryClient = useQueryClient();

  // Today plus the next 13 days, so a host day booked for next week still shows up.
  const week = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const date = addDays(today, i);
      return { key: dateKey(date), day: format(date, 'EEE'), date: format(date, 'd'), long: i === 0 ? 'Today' : format(date, 'EEE, MMM d') };
    });
  }, []);

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ['kitchen-schedule', me],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cook_sessions')
        .select('id, session_date, start_time, listings(id, title, price, image, portions_available, available)')
        .eq('cook_id', me)
        .gte('session_date', week[0].key)
        .lte('session_date', week[week.length - 1].key)
        .order('session_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!me,
  });

  // Events posted before host days existed (or without one) have no session. They still count: they sit on the day of their
  // own date when they have one, and in an "unscheduled" list when they don't, so nothing posted is invisible here.
  const { data: looseListings = [], refetch: refetchLoose } = useQuery({
    queryKey: ['kitchen-schedule', 'loose', me],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, price, image, portions_available, available, order_deadline')
        .eq('cook_id', me)
        .is('session_id', null)
        .or('archived.eq.false,archived.is.null');
      if (error) throw error;
      return data || [];
    },
    enabled: !!me,
  });

  // The tab stays mounted, so refresh whenever it comes back into view (e.g. right after posting a dish).
  useFocusEffect(useCallback(() => { if (me) { refetch(); refetchLoose(); } }, [me, refetch, refetchLoose]));

  const plan = useMemo(() => {
    const byDate: Record<string, PlannedDay> = {};
    (sessions as any[]).forEach((s) => {
      const listing = Array.isArray(s.listings) ? s.listings[0] : s.listings;
      byDate[s.session_date] = { sessionId: s.id, startTime: s.start_time, listing: listing || undefined };
    });
    (looseListings as any[]).forEach((l) => {
      if (!l.order_deadline) return;
      const when = new Date(l.order_deadline);
      if (isNaN(when.getTime())) return;
      const key = dateKey(when);
      if (byDate[key]) return; // a real host day already holds this date
      byDate[key] = { sessionId: '', startTime: format(when, 'HH:mm:ss'), listing: l };
    });
    return byDate;
  }, [sessions, looseListings]);

  const undated = (looseListings as any[]).filter((l) => !l.order_deadline && l.available !== false);

  const [picked, setPicked] = useState<string | null>(null);
  const firstPlannedKey = week.find(w => plan[w.key])?.key;
  const selectedKey = picked ?? firstPlannedKey ?? week[0].key;
  const selected = week.find(w => w.key === selectedKey) || week[0];


  const day = plan[selectedKey];
  const listing = day?.listing;
  const accepting = !!listing && listing.available !== false;
  const sold = listing ? Math.min(SERVING_POOL, Math.max(0, SERVING_POOL - (listing.portions_available ?? SERVING_POOL))) : 0;
  const remaining = SERVING_POOL - sold;
  const percent = Math.round((sold / SERVING_POOL) * 100);
  const soldOut = !!listing && remaining === 0;
  const firstImage = listing?.image ? listing.image.split(',')[0].trim() : '';
  const startLabel = day ? format(new Date(`2000-01-01T${day.startTime}`), 'h:mm a') : '';

  const goToPost = () => router.push(`/(tabs)/cook?new=${Date.now()}`);
  const goToEdit = () => listing && router.push(`/(tabs)/cook?edit_id=${listing.id}`);

  // Gentle toast, used when a change can't reach the server and has been put back.
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const showToast = (message: string) => {
    setToast(message);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  // Flip one event's `available` flag inside the cached schedule data, so the screen updates this frame
  // and switching between days never needs a network call.
  const patchAvailable = (id: string, value: boolean) => {
    queryClient.setQueryData(['kitchen-schedule', me], (old: any) => {
      if (!old) return old;
      return old.map((s: any) => {
        if (Array.isArray(s.listings)) return { ...s, listings: s.listings.map((l: any) => (l.id === id ? { ...l, available: value } : l)) };
        return s.listings && s.listings.id === id ? { ...s, listings: { ...s.listings, available: value } } : s;
      });
    });
    queryClient.setQueryData(['kitchen-schedule', 'loose', me], (old: any) =>
      old ? old.map((l: any) => (l.id === id ? { ...l, available: value } : l)) : old
    );
  };

  const lastTap = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  // The switch pauses or resumes an event. The screen flips at once (optimistic); the save runs behind it, one request at a time
  // and in tap order, and a failed save puts the switch back with a toast. With no event yet it takes you to Create an Event.
  const setAccepting = (value: boolean) => {
    if (!listing) {
      if (value) goToPost();
      return;
    }
    // Guests have paid for this date, so it can't be switched off from here (there is no refund flow yet).
    if (!value && sold > 0) {
      Alert.alert('Guests have booked', `${sold} ${sold === 1 ? 'portion is' : 'portions are'} already booked for this event, so it can't be paused. Message your guests from the inbox if plans change.`);
      return;
    }
    // Ignore rapid double taps.
    const now = Date.now();
    if (now - lastTap.current < 400) return;
    lastTap.current = now;

    const id = listing.id;
    patchAvailable(id, value);
    saveQueue.current = saveQueue.current.then(async () => {
      const { error } = await supabase.from('listings').update({ available: value }).eq('id', id);
      if (error) {
        patchAvailable(id, !value);
        showToast('Connection failed. Try again.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['my-menu'] });
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      {/* Shared header, same as Bookings and Messages */}
      <ScreenHeader
        title="Weekly Schedule"
        subtitle="Plan your host days and what you're serving"
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Day selector: today and the next 13 days */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 14, gap: 10 }}>
          {week.map((item) => {
            const isSelected = item.key === selectedKey;
            const hasDish = !!plan[item.key]?.listing;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.8}
                onPress={() => setPicked(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={{ width: 62, height: 78, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? palette.accent : palette.surface }}
              >
                <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: isSelected ? 'white' : palette.muted }}>{item.day}</Text>
                <Text style={{ ...type.section, color: isSelected ? 'white' : palette.ink, marginTop: 2 }}>{item.date}</Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 5, backgroundColor: hasDish ? (isSelected ? 'white' : palette.accent) : 'transparent' }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator color={palette.accent} style={{ marginTop: 40 }} />
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            {/* Host status for the selected day */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: palette.surface, borderRadius: 16, padding: 16 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ ...type.card, color: palette.ink }}>Host Status · {selected.long}</Text>
                <Text style={{ ...type.meta, color: palette.muted, marginTop: 2 }}>
                  {!day ? 'Kitchen closed on this day' : !listing ? 'Host day set, no event yet' : !accepting ? 'Paused, hidden from guests' : soldOut ? 'Fully booked, not taking new reservations' : sold > 0 ? `Accepting pre-orders · ${sold} booked` : 'Accepting pre-orders'}
                </Text>
              </View>
              <Switch
                value={accepting}
                onValueChange={setAccepting}
                trackColor={{ false: palette.skeleton, true: palette.accent }}
                thumbColor="#FFFFFF"
                accessibilityLabel={`Host status for ${selected.long}`}
              />
            </View>

            {listing ? (
              <View style={{ backgroundColor: palette.surface, borderRadius: 20, padding: 18, opacity: accepting ? 1 : 0.6 }}>
                {!accepting && (
                  <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: palette.accent, marginBottom: 10 }}>
                    Paused. Hidden from guests. Toggle on to host.
                  </Text>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ ...type.micro, color: palette.accent, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    Featured event · {selected.long}
                  </Text>
                  {accepting && soldOut && (
                    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9999, backgroundColor: '#F0FFF8', borderWidth: 1, borderColor: '#B2DFCC' }}>
                      <Text style={{ ...type.micro, color: SOLD_OUT_GREEN }}>Fully Booked</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 14 }}>
                  {firstImage ? (
                    <Image source={{ uri: firstImage }} style={{ width: 68, height: 68, borderRadius: 14, backgroundColor: palette.inkWash }} />
                  ) : (
                    <View style={{ width: 68, height: 68, borderRadius: 14, backgroundColor: palette.inkWash, alignItems: 'center', justifyContent: 'center' }}>
                      <UtensilsCrossed size={26} color={palette.accent} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink }}>{listing.title}</Text>
                    <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.accent, marginTop: 4 }}>GH₵ {Number(listing.price).toFixed(2)}</Text>
                  </View>
                </View>

                {/* Portion tracker */}
                <View style={{ backgroundColor: palette.canvas, borderRadius: 14, padding: 14, marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: palette.ink }}>Serving Pool (Fixed)</Text>
                    <Text style={{ ...type.meta, fontFamily: fonts.bold, color: palette.accent }}>{sold} / {SERVING_POOL} Sold</Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: palette.skeleton, borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${percent}%`, borderRadius: 4, backgroundColor: soldOut ? SOLD_OUT_GREEN : palette.accent }} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    {soldOut && <CheckCircle2 size={14} color={SOLD_OUT_GREEN} />}
                    <Text style={{ ...type.meta, color: soldOut ? SOLD_OUT_GREEN : palette.muted }}>
                      {soldOut ? 'Sold out completely' : `${remaining} portions remaining for pre-order`}
                    </Text>
                  </View>
                </View>

                {/* Host day start */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.inkWash }}>
                  <Clock size={15} color={palette.muted} />
                  <Text style={{ ...type.body, color: palette.muted, flex: 1 }}>
                    Host day starts at <Text style={{ fontFamily: fonts.semibold, color: palette.ink }}>{startLabel}</Text>
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={goToEdit}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  style={{ marginTop: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.accent, alignItems: 'center' }}
                >
                  <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.accent }}>Edit Event</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ backgroundColor: palette.surface, borderRadius: 20, padding: 28, alignItems: 'center' }}>
                <CalendarX size={36} color={palette.accent} />
                <Text style={{ ...type.card, color: palette.ink, marginTop: 10, textAlign: 'center' }}>
                  {day ? `No event yet for ${selected.long}` : `No Event Scheduled for ${selected.long}`}
                </Text>
                <Text style={{ ...type.body, color: palette.muted, textAlign: 'center', marginTop: 6 }}>
                  Create an event and pick this day as its host day to start taking pre-orders.
                </Text>
                <TouchableOpacity
                  onPress={goToPost}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  style={{ marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: palette.accent, alignItems: 'center' }}
                >
                  <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.accent }}>Create an Event</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Posted without a host day: tap to give it one */}
            {undated.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ ...type.micro, color: palette.accent, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                  Posted without a host day
                </Text>
                {undated.map((l: any) => (
                  <TouchableOpacity
                    key={l.id}
                    onPress={() => router.push(`/(tabs)/cook?edit_id=${l.id}`)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    style={{ backgroundColor: palette.surface, borderRadius: 16, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink }}>{l.title}</Text>
                      <Text style={{ ...type.meta, color: palette.muted, marginTop: 2 }}>GH₵ {Number(l.price).toFixed(2)} · Tap to pick a host day</Text>
                    </View>
                    <CalendarX size={18} color={palette.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {toast && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 24, right: 24, bottom: 110, opacity: toastOpacity, alignItems: 'center' }}
        >
          <View style={{ backgroundColor: palette.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.45)', shadowColor: palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}>
            <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.ink }}>{toast}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
