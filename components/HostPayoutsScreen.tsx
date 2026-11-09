import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Share, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Wallet, Mail, Pencil, Check, Clock, X, Info, TrendingUp, CalendarDays, Calendar, Zap, PieChart, FileText } from 'lucide-react-native';
import KitchenPotIcon from '@/components/KitchenPotIcon';
import { supabase } from '@/lib/supabase';
import { palette, fonts } from '@/constants/theme';
import { PLATFORM_FEE_PERCENT, MIN_PAYOUT } from '@/lib/earnings';

// The host's Earnings & Payouts page. Styled like Kitchen Settings; every figure comes from completed orders and payout requests.
const fieldBorder = 'rgba(194, 83, 39, 0.14)';
const cardBorder = 'rgba(194, 83, 39, 0.25)';
const fieldFill = '#FFF8F5';
const iconMuted = '#8A7269';
const HISTORY_PREVIEW = 3;

type Schedule = 'weekly' | 'biweekly' | 'on_request';
const SCHEDULES: { id: Schedule; title: string; sub: string; badge?: string; icon: any }[] = [
    { id: 'weekly', title: 'Weekly', sub: 'Every Tuesday via Payoneer · No fees', badge: 'Recommended', icon: CalendarDays },
    { id: 'biweekly', title: 'Bi-Weekly', sub: 'Every other Tuesday · No fees', icon: Calendar },
    { id: 'on_request', title: 'On request', sub: 'Request a payout whenever you reach the minimum', icon: Zap },
];

const money = (n: number) => `₵${n.toFixed(2)}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const payoutLook = (status: string) => {
    if (status === 'paid') return { bg: '#6FF2A8', text: '#00522B', label: 'Completed', tile: '#D9F7E6', icon: Check, tint: '#006A3C' };
    if (status === 'failed') return { bg: '#FDEDED', text: '#C62828', label: 'Failed', tile: '#FDEDED', icon: X, tint: '#C62828' };
    if (status === 'processing') return { bg: '#E0F2FE', text: '#0369A1', label: 'Processing', tile: '#E0F2FE', icon: Clock, tint: '#0369A1' };
    return { bg: '#FFE9CC', text: '#9A5B00', label: 'Pending', tile: '#FFE9CC', icon: Clock, tint: '#B8720B' };
};

export default function HostPayoutsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [kitchenName, setKitchenName] = useState('');
    const [payoneerEmail, setPayoneerEmail] = useState<string | null>(null);
    const [payoneerInput, setPayoneerInput] = useState('');
    const [editingPayoneer, setEditingPayoneer] = useState(false);
    const [savingPayoneer, setSavingPayoneer] = useState(false);
    const [completed, setCompleted] = useState<{ total: number; created_at: string }[]>([]);
    const [period, setPeriod] = useState<'month' | 'all'>('month');
    const [availableBalance, setAvailableBalance] = useState(0);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [requestingPayout, setRequestingPayout] = useState(false);
    const [schedule, setSchedule] = useState<Schedule>('on_request');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // discount_amount needs the server-priced-checkout database update; fall back to the old columns until it has been run.
            const completedQuery = (columns: string) => supabase.from('orders').select(columns).eq('cook_id', user.id).eq('status', 'Completed');
            const [{ data: profile }, withDiscount, { data: payoutRows }] = await Promise.all([
                supabase.from('profiles').select('payoneer_email, kitchen_name, full_name').eq('id', user.id).single(),
                completedQuery('id, total, discount_amount, payout_id, created_at'),
                supabase.from('payouts').select('*').eq('cook_id', user.id).order('requested_at', { ascending: false }),
            ]);
            const completedOrders: any[] | null = withDiscount.error ? (await completedQuery('id, total, payout_id, created_at')).data as any[] | null : withDiscount.data as any[] | null;

            setPayoneerEmail(profile?.payoneer_email || null);
            setKitchenName(profile?.kitchen_name || profile?.full_name || '');

            const orders = completedOrders || [];
            const keep = 1 - PLATFORM_FEE_PERCENT / 100;
            // Promo discounts are platform-funded, so a host's sales count at the full price (total + discount).
            const fullPrice = (o: any) => (o.total || 0) + (o.discount_amount || 0);
            setCompleted(orders.map((o: any) => ({ total: fullPrice(o), created_at: o.created_at })));
            setAvailableBalance(orders.filter((o: any) => !o.payout_id).reduce((sum: number, o: any) => sum + fullPrice(o) * keep, 0));
            setPayouts(payoutRows || []);

            // Needs the payout-schedule database update; until it has been run the default (on request) stays selected.
            const { data: scheduleRow } = await supabase.from('profiles').select('payout_schedule').eq('id', user.id).single();
            if (scheduleRow?.payout_schedule) setSchedule(scheduleRow.payout_schedule as Schedule);
        } catch (e) {
            // Non-fatal: the page still renders with zeroed figures.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleSavePayoneer = async () => {
        if (!payoneerInput.trim()) return;
        setSavingPayoneer(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');
            const { error } = await supabase.from('profiles').update({ payoneer_email: payoneerInput.trim() }).eq('id', user.id);
            if (error) throw error;
            setPayoneerEmail(payoneerInput.trim());
            setEditingPayoneer(false);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not save your Payoneer email');
        } finally {
            setSavingPayoneer(false);
        }
    };

    const chooseSchedule = async (next: Schedule) => {
        if (next === schedule) return;
        const previous = schedule;
        setSchedule(next);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');
            const { error } = await supabase.from('profiles').update({ payout_schedule: next }).eq('id', user.id);
            if (error) throw error;
        } catch (e: any) {
            setSchedule(previous);
            Alert.alert('Could not save', e.message || 'Your payout schedule could not be saved.');
        }
    };

    const handleRequestPayout = async () => {
        if (availableBalance < MIN_PAYOUT) return;
        setRequestingPayout(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');

            const unpaidQuery = (columns: string) => supabase.from('orders').select(columns).eq('cook_id', user.id).eq('status', 'Completed').is('payout_id', null);
            let unpaidRes: any = await unpaidQuery('id, total, discount_amount');
            if (unpaidRes.error) unpaidRes = await unpaidQuery('id, total');
            if (unpaidRes.error) throw unpaidRes.error;
            const unpaidOrders: any[] = unpaidRes.data || [];
            if (unpaidOrders.length === 0) return;

            const amount = unpaidOrders.reduce((sum, o: any) => sum + (o.total || 0) + (o.discount_amount || 0), 0) * (1 - PLATFORM_FEE_PERCENT / 100);

            const { data: payout, error: payoutError } = await supabase
                .from('payouts')
                .insert({ cook_id: user.id, amount, platform_fee_percent: PLATFORM_FEE_PERCENT, status: 'pending' })
                .select()
                .single();
            if (payoutError) throw payoutError;

            const { error: linkError } = await supabase
                .from('orders')
                .update({ payout_id: payout.id })
                .in('id', unpaidOrders.map((o: any) => o.id));
            if (linkError) throw linkError;

            Alert.alert('Payout Requested', `${money(amount)} will be sent to ${payoneerEmail} via Payoneer. This usually takes a few business days.`);
            load();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not request payout');
        } finally {
            setRequestingPayout(false);
        }
    };

    const now = new Date();
    const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const inPeriod = completed.filter(o => {
        if (period === 'all') return true;
        const d = new Date(o.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const grossSales = inPeriod.reduce((sum, o) => sum + o.total, 0);
    const fee = grossSales * (PLATFORM_FEE_PERCENT / 100);
    const takeHome = grossSales - fee;
    const lifetimeTakeHome = completed.reduce((sum, o) => sum + o.total, 0) * (1 - PLATFORM_FEE_PERCENT / 100);
    const periodName = period === 'month' ? monthLabel : 'All time';

    // The system share sheet takes plain text, so the statement is shared as a text summary (save it to Notes or Files, or send it by email).
    const shareStatement = async () => {
        const lines = [
            `YenDidii earnings statement: ${kitchenName || 'Your kitchen'}`,
            `Period: ${periodName}`,
            '',
            `Gross sales: ${money(grossSales)}`,
            `Platform service fee (${PLATFORM_FEE_PERCENT}%): -${money(fee)}`,
            `Your take-home: ${money(takeHome)}`,
            '',
            payouts.length ? 'Payout requests:' : 'No payout requests yet.',
            ...payouts.map(p => `${shortDate(p.requested_at)}: ${money(p.amount)} (${payoutLook(p.status).label})`),
        ];
        try {
            await Share.share({ message: lines.join('\n') });
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not share the statement');
        }
    };
    const canRequest = !!payoneerEmail && availableBalance >= MIN_PAYOUT && !requestingPayout;
    const status = !payoneerEmail
        ? { label: 'Connect Payoneer', bg: '#FFE9CC', text: '#9A5B00' }
        : availableBalance >= MIN_PAYOUT
            ? { label: 'Ready to request', bg: '#6FF2A8', text: '#00522B' }
            : { label: `Min ${money(MIN_PAYOUT)}`, bg: '#FFE9CC', text: '#9A5B00' };
    const visibleHistory = showAllHistory ? payouts : payouts.slice(0, HISTORY_PREVIEW);

    const card = { borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: cardBorder, shadowColor: palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 };
    const headingText = { fontFamily: fonts.bold, fontSize: 18, color: palette.ink };
    const sectionHead = (title: string, right?: React.ReactNode) => (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={headingText}>{title}</Text>
            {right}
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
            <View style={{ flex: 1, backgroundColor: palette.canvas }}>
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between bg-surface border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
                        <ArrowLeft size={24} color="#2D241E" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-text-main font-sans-bold">Earnings & Payouts</Text>
                    <View className="w-10" />
                </View>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {loading ? (
                            <ActivityIndicator size="small" color={palette.accent} style={{ marginTop: 32 }} />
                        ) : (
                            <>
                                {/* Kitchen identity */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFDBCD', alignItems: 'center', justifyContent: 'center' }}>
                                        <KitchenPotIcon size={22} color="#9C3F12" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1, color: palette.muted, textTransform: 'uppercase' }}>Kitchen host</Text>
                                        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 18, color: palette.ink }}>{kitchenName || 'Your kitchen'}</Text>
                                    </View>
                                </View>

                                {/* Available balance */}
                                <View style={{ ...card, marginBottom: 22 }}>
                                    <View style={{ borderRadius: 16, overflow: 'hidden', padding: 16 }}>
                                        <View pointerEvents="none" style={{ position: 'absolute', top: -52, right: -44, width: 168, height: 168, borderRadius: 84, backgroundColor: palette.accent, opacity: 0.09 }} />
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: palette.muted, textTransform: 'uppercase' }}>Available balance</Text>
                                            <View style={{ backgroundColor: status.bg, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 }}>
                                                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: status.text }}>{status.label}</Text>
                                            </View>
                                        </View>
                                        <Text style={{ fontFamily: fonts.bold, fontSize: 34, color: '#9C3F12', marginTop: 4 }}>{money(availableBalance)}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: fieldFill, borderRadius: 12, borderWidth: 1, borderColor: fieldBorder, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 }}>
                                            <TrendingUp size={20} color={palette.accent} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.muted }}>Lifetime earned</Text>
                                                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.ink }}>{money(lifetimeTakeHome)}</Text>
                                            </View>
                                            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.muted }}>after {PLATFORM_FEE_PERCENT}% fee</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Payout schedule */}
                                <View style={{ marginBottom: 22 }}>
                                    {sectionHead('Payout Schedule', <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>How you get paid</Text>)}
                                    <View style={{ gap: 10 }}>
                                        {SCHEDULES.map(opt => {
                                            const selected = schedule === opt.id;
                                            const Icon = opt.icon;
                                            return (
                                                <TouchableOpacity
                                                    key={opt.id}
                                                    onPress={() => chooseSchedule(opt.id)}
                                                    activeOpacity={0.85}
                                                    accessibilityRole="radio"
                                                    accessibilityState={{ selected }}
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: selected ? '#FFE3D8' : fieldFill, borderWidth: selected ? 1.5 : 1, borderColor: selected ? palette.accent : cardBorder, shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: selected ? 0.12 : 0.05, shadowRadius: 5, elevation: selected ? 2 : 0 }}
                                                >
                                                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? '#9C3F12' : '#C9B0A5', alignItems: 'center', justifyContent: 'center' }}>
                                                        {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#9C3F12' }} />}
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.ink }}>{opt.title}</Text>
                                                            {!!opt.badge && (
                                                                <View style={{ backgroundColor: '#FDBA9F', borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 }}>
                                                                    <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: '#794833' }}>{opt.badge}</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.bodyText, marginTop: 2 }}>{opt.sub}</Text>
                                                    </View>
                                                    <Icon size={22} color="#9C3F12" />
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Payout account */}
                                <View style={{ marginBottom: 22 }}>
                                    {sectionHead('Payout Account', <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>{payoneerEmail ? '1 Connected' : 'None yet'}</Text>)}
                                    {payoneerEmail && !editingPayoneer ? (
                                        <View style={{ ...card, padding: 14 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFDBCD', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Wallet size={22} color="#9C3F12" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: palette.ink }}>Payoneer</Text>
                                                        <View style={{ backgroundColor: '#006A3C', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                                                            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#FFFFFF' }}>Connected</Text>
                                                        </View>
                                                    </View>
                                                    <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.muted, marginTop: 2 }}>{payoneerEmail}</Text>
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: fieldFill, borderRadius: 10, borderWidth: 1, borderColor: fieldBorder, paddingHorizontal: 12, paddingVertical: 9, marginTop: 12 }}>
                                                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: palette.bodyText }}>Sent within a few business days</Text>
                                                <TouchableOpacity onPress={() => { setPayoneerInput(payoneerEmail); setEditingPayoneer(true); }} accessibilityRole="button" accessibilityLabel="Change Payoneer email" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Pencil size={13} color="#9C3F12" />
                                                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#9C3F12' }}>Change</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={{ ...card, padding: 14 }}>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.ink }}>{payoneerEmail ? 'Change Payoneer email' : 'Connect Payoneer'}</Text>
                                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted, marginTop: 2, marginBottom: 10 }}>We send your payouts to this Payoneer email.</Text>
                                            <View style={{ minHeight: 42, borderRadius: 12, backgroundColor: fieldFill, borderWidth: 1, borderColor: fieldBorder, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <Mail size={20} color={iconMuted} />
                                                <TextInput
                                                    placeholder="you@example.com"
                                                    placeholderTextColor="#9CA3AF"
                                                    autoCapitalize="none"
                                                    keyboardType="email-address"
                                                    style={{ flex: 1, height: 40, fontFamily: fonts.regular, fontSize: 14, color: palette.ink }}
                                                    value={payoneerInput}
                                                    onChangeText={setPayoneerInput}
                                                />
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                                                {editingPayoneer && (
                                                    <TouchableOpacity onPress={() => setEditingPayoneer(false)} activeOpacity={0.8} style={{ flex: 1, height: 42, borderRadius: 8, backgroundColor: '#FEEAE2', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: '#794833' }}>Cancel</Text>
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity
                                                    onPress={handleSavePayoneer}
                                                    disabled={!payoneerInput.trim() || savingPayoneer}
                                                    activeOpacity={0.85}
                                                    style={{ flex: 1, height: 42, borderRadius: 8, backgroundColor: payoneerInput.trim() ? palette.accent : '#E3CFC7', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    {savingPayoneer
                                                        ? <ActivityIndicator size="small" color="white" />
                                                        : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' }}>{editingPayoneer ? 'Save' : 'Connect'}</Text>}
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                {/* Earnings & fees */}
                                <View style={{ ...card, padding: 16, marginBottom: 22 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <Text style={headingText}>Earnings & Fees ({periodName})</Text>
                                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted, marginTop: 2 }}>Summary of your net share</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setPeriod(v => (v === 'month' ? 'all' : 'month'))}
                                            accessibilityRole="button"
                                            accessibilityLabel={period === 'month' ? 'Show all-time earnings' : 'Show this month'}
                                            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDE3D8', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <PieChart size={18} color="#9C3F12" />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={{ height: 10, borderRadius: 5, backgroundColor: '#DDC1B6', overflow: 'hidden', flexDirection: 'row', marginTop: 14 }}>
                                        <View style={{ flex: 100 - PLATFORM_FEE_PERCENT, backgroundColor: '#9C3F12' }} />
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#9C3F12' }} />
                                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.bodyText }}>{100 - PLATFORM_FEE_PERCENT}% Net take-home</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDC1B6' }} />
                                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.bodyText }}>{PLATFORM_FEE_PERCENT}% Platform operations</Text>
                                        </View>
                                    </View>

                                    <View style={{ gap: 10, marginTop: 16 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: palette.bodyText }}>Gross Sales</Text>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.ink }}>{money(grossSales)}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: palette.bodyText }}>Platform service fee ({PLATFORM_FEE_PERCENT}%)</Text>
                                                <Info size={13} color={iconMuted} />
                                            </View>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#C62828' }}>-{money(fee)}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: fieldFill, borderRadius: 10, borderWidth: 1, borderColor: fieldBorder, paddingHorizontal: 12, paddingVertical: 10 }}>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.ink }}>Your Take-Home</Text>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#9C3F12' }}>{money(takeHome)}</Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity onPress={shareStatement} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Share statement" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FDE9E1', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginTop: 14 }}>
                                        <FileText size={20} color="#794833" />
                                        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#794833', textAlign: 'center' }}>Share {period === 'month' ? `${now.toLocaleDateString('en-GB', { month: 'long' })} ` : ''}Earnings Statement</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Payout history */}
                                <View style={{ marginBottom: 22 }}>
                                    {sectionHead('Payout History', payouts.length > HISTORY_PREVIEW ? (
                                        <TouchableOpacity onPress={() => setShowAllHistory(v => !v)}>
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#9C3F12' }}>{showAllHistory ? 'Show less' : 'View all'}</Text>
                                        </TouchableOpacity>
                                    ) : undefined)}
                                    {payouts.length === 0 ? (
                                        <View style={{ ...card, padding: 20, alignItems: 'center' }}>
                                            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: palette.muted }}>No payouts yet.</Text>
                                        </View>
                                    ) : (
                                        <View style={{ ...card, paddingHorizontal: 12 }}>
                                            {visibleHistory.map((p, i) => {
                                                const look = payoutLook(p.status);
                                                const Icon = look.icon;
                                                return (
                                                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(194, 83, 39, 0.14)' }}>
                                                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: look.tile, alignItems: 'center', justifyContent: 'center' }}>
                                                            <Icon size={20} color={look.tint} />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: palette.ink }}>{money(p.amount)}</Text>
                                                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted, marginTop: 1 }}>{shortDate(p.requested_at)} · Payoneer</Text>
                                                        </View>
                                                        <View style={{ backgroundColor: look.bg, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 }}>
                                                            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: look.text }}>{look.label}</Text>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>

                                {/* Request payout */}
                                <TouchableOpacity
                                    onPress={handleRequestPayout}
                                    disabled={!canRequest}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel="Request payout"
                                    style={{ height: 52, borderRadius: 8, backgroundColor: canRequest ? palette.accent : '#E3CFC7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: palette.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: canRequest ? 0.28 : 0, shadowRadius: 8, elevation: canRequest ? 4 : 0 }}
                                >
                                    {requestingPayout ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <>
                                            <Wallet size={20} color="#FFFFFF" />
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' }}>Request Payout</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted, textAlign: 'center', marginTop: 8 }}>
                                    {!payoneerEmail
                                        ? 'Connect Payoneer to request a payout'
                                        : availableBalance < MIN_PAYOUT
                                            ? `Minimum payout is ${money(MIN_PAYOUT)}`
                                            : 'Sent via Payoneer within a few business days'}
                                </Text>
                            </>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </SafeAreaView>
    );
}
