import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { palette, type, fonts } from '@/constants/theme';
import { hostNetOf, PLATFORM_FEE_PERCENT } from '@/lib/earnings';
import SectionHeader from '@/components/SectionHeader';

const PERIODS = ['7D', '30D', 'This Month', 'All Time'] as const;
type Period = (typeof PERIODS)[number];

const ACCENT_EDGE = 'rgba(194, 83, 39,0.35)';

const periodStart = (period: Period): Date | null => {
  const now = new Date();
  if (period === '7D') return subDays(now, 7);
  if (period === '30D') return subDays(now, 30);
  if (period === 'This Month') return startOfMonth(now);
  return null;
};

// Expanded Business Overview: earnings for a chosen period, a few key numbers and the latest bookings. Real data only.
export default function BusinessOverviewPanel({ userId }: { userId: string }) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('30D');

  const { data, isLoading } = useQuery({
    queryKey: ['business-overview', userId],
    queryFn: async () => {
      const ordersQuery = (columns: string) => supabase
        .from('orders')
        .select(columns)
        .eq('cook_id', userId)
        .order('created_at', { ascending: false });
      const orderColumns = 'id, total, status, payment_status, payout_id, created_at, profiles:user_id (full_name), order_items (quantity, listings (title))';
      // discount_amount needs the server-priced-checkout database update; fall back to the old columns until it has been run.
      let ordersRes: any = await ordersQuery(`${orderColumns}, discount_amount`);
      if (ordersRes.error) ordersRes = await ordersQuery(orderColumns);
      const [listingsRes] = await Promise.all([
        supabase
          .from('listings')
          .select('id, price, available')
          .eq('cook_id', userId)
          .or('archived.eq.false,archived.is.null'),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      return { orders: (ordersRes.data || []) as any[], listings: (listingsRes.data || []) as any[] };
    },
    staleTime: 60 * 1000,
  });

  const stats = useMemo(() => {
    const orders = (data?.orders || []).filter(o => o.payment_status === 'success' && o.status !== 'Cancelled');
    const since = periodStart(period);
    const inPeriod = since ? orders.filter(o => new Date(o.created_at) >= since) : orders;
    const completed = inPeriod.filter(o => o.status === 'Completed');
    const seatsOf = (o: any) => (o.order_items || []).reduce((n: number, i: any) => n + (i.quantity || 1), 0);

    const liveEvents = (data?.listings || []).filter(l => l.available !== false);
    const avgPrice = liveEvents.length ? liveEvents.reduce((sum, l) => sum + Number(l.price || 0), 0) / liveEvents.length : 0;

    return {
      net: completed.reduce((sum, o) => sum + hostNetOf(Number(o.total || 0), Number(o.discount_amount || 0)), 0),
      // Everything completed and not yet paid out, whatever the period: it's what Withdraw can actually send.
      available: orders.filter(o => o.status === 'Completed' && !o.payout_id).reduce((sum, o) => sum + hostNetOf(Number(o.total || 0), Number(o.discount_amount || 0)), 0),
      guests: completed.reduce((n, o) => n + seatsOf(o), 0),
      orderCount: inPeriod.length,
      liveEvents: liveEvents.length,
      avgPrice,
      recent: inPeriod.slice(0, 5).map(o => {
        const profile = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
        const first = (o.order_items || [])[0];
        const listing = Array.isArray(first?.listings) ? first.listings[0] : first?.listings;
        return {
          id: o.id as string,
          guest: (profile?.full_name as string) || 'Guest',
          event: (listing?.title as string) || 'Event',
          seats: seatsOf(o),
          net: hostNetOf(Number(o.total || 0), Number(o.discount_amount || 0)),
          done: o.status === 'Completed',
          date: format(new Date(o.created_at), 'MMM d, yyyy'),
        };
      }),
    };
  }, [data, period]);

  const money = (n: number) => `GH₵ ${n.toFixed(2)}`;

  const metrics = [
    { value: String(stats.guests), label: 'Guests hosted' },
    { value: String(stats.liveEvents), label: 'Live events' },
    { value: stats.liveEvents ? money(stats.avgPrice) : '—', label: 'Avg. event price' },
    { value: String(stats.orderCount), label: 'Bookings' },
  ];

  return (
    <View>
      {/* Period selector */}
      <View style={{ flexDirection: 'row', backgroundColor: palette.surface, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: ACCENT_EDGE, marginBottom: 14 }}>
        {PERIODS.map(p => {
          const active = p === period;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10, backgroundColor: active ? palette.accent : 'transparent' }}
            >
              <Text style={{ ...type.meta, fontFamily: active ? fonts.bold : fonts.semibold, color: active ? 'white' : palette.inkSoft }}>{p}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator color={palette.accent} style={{ marginVertical: 30 }} />
      ) : (
        <>
          {/* Earnings */}
          <View style={{ backgroundColor: '#FFF1EC', borderRadius: 22, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.45)', shadowColor: palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 2 }}>
            <Text style={{ ...type.micro, color: palette.accent, letterSpacing: 1 }}>NET EARNINGS · {period.toUpperCase()}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 32, lineHeight: 40, color: palette.ink, marginTop: 4 }}>{money(stats.net)}</Text>
            <Text style={{ ...type.meta, color: palette.inkSoft }}>After the {PLATFORM_FEE_PERCENT}% platform fee, completed orders only</Text>

            <View style={{ height: 1, backgroundColor: 'rgba(194, 83, 39,0.25)', marginVertical: 14 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ ...type.meta, color: palette.inkSoft }}>Available for payout</Text>
                <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink, marginTop: 2 }}>{money(stats.available)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/payment-methods')}
                activeOpacity={0.85}
                accessibilityRole="button"
                style={{ backgroundColor: palette.accent, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 }}
              >
                <Text style={{ ...type.body, fontFamily: fonts.bold, color: 'white' }}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Key numbers */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginBottom: 6 }}>
            {metrics.map(m => (
              <View key={m.label} style={{ width: '48.5%', backgroundColor: palette.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: ACCENT_EDGE }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: palette.ink }} numberOfLines={1} adjustsFontSizeToFit>{m.value}</Text>
                <Text style={{ ...type.meta, color: palette.inkSoft, marginTop: 2 }}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Latest bookings */}
          <SectionHeader title="Recent Bookings" subtitle={`Your share after the ${PLATFORM_FEE_PERCENT}% platform fee`} inset={false} extraBottom={4} />
          {stats.recent.length === 0 ? (
            <View style={{ backgroundColor: palette.surface, borderRadius: 16, padding: 22, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(194, 83, 39,0.5)' }}>
              <Text style={{ ...type.body, color: palette.muted, textAlign: 'center' }}>No paid bookings in this period yet.</Text>
            </View>
          ) : (
            stats.recent.map(r => (
              <View key={r.id} style={{ backgroundColor: palette.surface, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: ACCENT_EDGE }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink }}>{r.guest}</Text>
                  <Text numberOfLines={1} style={{ ...type.meta, color: palette.inkSoft, marginTop: 2 }}>{r.event} · {r.seats} {r.seats === 1 ? 'seat' : 'seats'}</Text>
                  <Text style={{ ...type.micro, color: palette.muted, marginTop: 3 }}>{r.date}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.accent }}>{money(r.net)}</Text>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9999, backgroundColor: r.done ? '#F0FFF8' : '#FFF4E0', borderWidth: 1, borderColor: r.done ? '#B2DFCC' : '#F2D9A8' }}>
                    <Text style={{ ...type.micro, color: r.done ? '#006A3C' : '#9A5B00' }}>{r.done ? 'Completed' : 'Upcoming'}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}
