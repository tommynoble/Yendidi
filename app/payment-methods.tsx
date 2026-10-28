import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CreditCard, Smartphone, ShieldCheck, Receipt, Wallet, Mail, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';

const ACCEPTED_METHODS = [
    { label: 'Card', sub: 'Visa, Mastercard', icon: CreditCard },
    { label: 'MTN MoMo', sub: 'Mobile Money', icon: Smartphone },
    { label: 'Vodafone Cash', sub: 'Mobile Money', icon: Smartphone },
    { label: 'AirtelTigo Money', sub: 'Mobile Money', icon: Smartphone },
];

// Platform takes this cut before a payout is requested. Payoneer handles the
// actual transfer to the cook — this screen only tracks balance + requests.
const PLATFORM_FEE_PERCENT = 10;
const MIN_PAYOUT = 30;

const getPaymentLabel = (method: string | null) => {
    switch (method) {
        case 'momo': return 'Mobile Money';
        case 'momo_mtn': return 'MTN MoMo';
        case 'momo_voda': return 'Vodafone Cash';
        case 'momo_airtel': return 'AirtelTigo';
        case 'card': return 'Card';
        default: return method || 'Unknown';
    }
};

interface PaymentRecord {
    id: string;
    total: number | null;
    payment_method: string | null;
    payment_status: string | null;
    payment_reference: string | null;
    created_at: string;
}

export default function PaymentMethodsScreen() {
    const router = useRouter();
    const { isCookMode } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);

    // -- Cook earnings state --
    const [payoneerEmail, setPayoneerEmail] = useState<string | null>(null);
    const [payoneerInput, setPayoneerInput] = useState('');
    const [savingPayoneer, setSavingPayoneer] = useState(false);
    const [availableBalance, setAvailableBalance] = useState(0);
    const [lifetimeEarned, setLifetimeEarned] = useState(0);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [requestingPayout, setRequestingPayout] = useState(false);

    useEffect(() => {
        if (isCookMode) {
            loadCookEarnings();
        } else {
            loadPayments();
        }
    }, [isCookMode]);

    const loadPayments = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('orders')
                .select('id, total, payment_method, payment_status, payment_reference, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPayments(data || []);
        } catch (e) {
            // Non-fatal — the accepted-methods info above still renders.
        } finally {
            setLoading(false);
        }
    };

    const loadCookEarnings = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: profile }, { data: completedOrders }, { data: payoutRows }] = await Promise.all([
                supabase.from('profiles').select('payoneer_email').eq('id', user.id).single(),
                supabase.from('orders').select('id, total, payout_id').eq('cook_id', user.id).eq('status', 'Completed'),
                supabase.from('payouts').select('*').eq('cook_id', user.id).order('requested_at', { ascending: false }),
            ]);

            setPayoneerEmail(profile?.payoneer_email || null);

            const orders = completedOrders || [];
            const netOf = (total: number) => total * (1 - PLATFORM_FEE_PERCENT / 100);
            const unpaid = orders.filter((o: any) => !o.payout_id);

            setAvailableBalance(unpaid.reduce((sum: number, o: any) => sum + netOf(o.total || 0), 0));
            setLifetimeEarned(orders.reduce((sum: number, o: any) => sum + netOf(o.total || 0), 0));
            setPayouts(payoutRows || []);
        } catch (e) {
            // Non-fatal — screen still renders with zeroed balances.
        } finally {
            setLoading(false);
        }
    }, []);

    const handleConnectPayoneer = async () => {
        if (!payoneerInput.trim()) return;
        setSavingPayoneer(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');
            const { error } = await supabase.from('profiles').update({ payoneer_email: payoneerInput.trim() }).eq('id', user.id);
            if (error) throw error;
            setPayoneerEmail(payoneerInput.trim());
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not save your Payoneer email');
        } finally {
            setSavingPayoneer(false);
        }
    };

    const handleRequestPayout = async () => {
        if (availableBalance < MIN_PAYOUT) return;
        setRequestingPayout(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');

            const { data: unpaidOrders, error: ordersError } = await supabase
                .from('orders')
                .select('id, total')
                .eq('cook_id', user.id)
                .eq('status', 'Completed')
                .is('payout_id', null);
            if (ordersError) throw ordersError;
            if (!unpaidOrders || unpaidOrders.length === 0) return;

            const amount = unpaidOrders.reduce((sum, o: any) => sum + (o.total || 0), 0) * (1 - PLATFORM_FEE_PERCENT / 100);

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

            Alert.alert('Payout Requested', `₵${amount.toFixed(2)} will be sent to ${payoneerEmail} via Payoneer. This usually takes a few business days.`);
            loadCookEarnings();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not request payout');
        } finally {
            setRequestingPayout(false);
        }
    };

    const statusStyle = (status: string | null) => {
        if (status === 'success') return { bg: '#E8F5E9', text: '#2E7D32', label: 'Paid' };
        if (status === 'failed') return { bg: '#FDEDED', text: '#C62828', label: 'Failed' };
        return { bg: '#FFF4E5', text: '#B8720B', label: 'Pending' };
    };

    const payoutStatusStyle = (status: string) => {
        if (status === 'paid') return { bg: '#E8F5E9', text: '#2E7D32', label: 'Paid' };
        if (status === 'failed') return { bg: '#FDEDED', text: '#C62828', label: 'Failed' };
        if (status === 'processing') return { bg: '#E0F2FE', text: '#0369A1', label: 'Processing' };
        return { bg: '#FFF4E5', text: '#B8720B', label: 'Pending' };
    };

    return (
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
            <View className="flex-1 bg-warm-cream">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center gap-3 bg-surface border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
                        <ArrowLeft size={24} color="#2D241E" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-text-main font-sans-bold">{isCookMode ? 'Earnings & Payouts' : 'Payment Methods'}</Text>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                    {isCookMode ? (
                        loading ? (
                            <ActivityIndicator size="small" color="#D65A31" style={{ marginTop: 20 }} />
                        ) : (
                            <>
                                {/* Balance Card */}
                                <View className="bg-clay-primary p-6 rounded-3xl mb-6 shadow-sm">
                                    <Text className="text-white/70 text-xs font-sans-bold uppercase tracking-widest mb-2">Available Balance</Text>
                                    <Text className="text-white text-4xl font-sans-bold mb-1">₵{availableBalance.toFixed(2)}</Text>
                                    <Text className="text-white/70 text-xs font-sans">Lifetime earned: ₵{lifetimeEarned.toFixed(2)} (after {PLATFORM_FEE_PERCENT}% platform fee)</Text>
                                </View>

                                {!payoneerEmail ? (
                                    <View className="bg-surface p-5 rounded-3xl border border-gray-100 mb-6">
                                        <Text className="text-xs font-bold text-text-main mb-1 uppercase tracking-widest font-sans-bold">Connect Payoneer</Text>
                                        <Text className="text-text-sub font-sans text-xs mb-3">We send your payouts to this Payoneer email.</Text>
                                        <View className="flex-row items-center gap-2 bg-gray-50 rounded-xl px-3 border border-gray-100 mb-3">
                                            <Mail size={14} color="#8A7269" />
                                            <TextInput
                                                placeholder="you@example.com"
                                                placeholderTextColor="#9CA3AF"
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                                className="flex-1 py-3 text-text-main font-sans text-sm"
                                                value={payoneerInput}
                                                onChangeText={setPayoneerInput}
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={handleConnectPayoneer}
                                            disabled={!payoneerInput.trim() || savingPayoneer}
                                            className={`rounded-xl py-3 items-center justify-center ${payoneerInput.trim() ? 'bg-clay-primary' : 'bg-gray-200'}`}
                                        >
                                            {savingPayoneer
                                                ? <ActivityIndicator size="small" color="white" />
                                                : <Text className="text-white font-bold font-sans-bold text-sm">Connect</Text>}
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View className="bg-surface p-4 rounded-2xl border border-gray-100 mb-6 flex-row items-center gap-3">
                                        <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center">
                                            <Check size={18} color="#007A33" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-text-sub font-sans text-xs">Payoneer connected</Text>
                                            <Text className="text-text-main font-sans-bold text-sm">{payoneerEmail}</Text>
                                        </View>
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={handleRequestPayout}
                                    disabled={!payoneerEmail || availableBalance < MIN_PAYOUT || requestingPayout}
                                    className={`rounded-2xl py-4 flex-row items-center justify-center gap-2 mb-2 ${payoneerEmail && availableBalance >= MIN_PAYOUT ? 'bg-clay-primary' : 'bg-gray-200'}`}
                                >
                                    {requestingPayout
                                        ? <ActivityIndicator size="small" color="white" />
                                        : <><Wallet size={18} color="white" /><Text className="text-white font-bold font-sans-bold">Request Payout</Text></>}
                                </TouchableOpacity>
                                <Text className="text-text-sub font-sans text-xs text-center mb-8">
                                    {!payoneerEmail
                                        ? 'Connect Payoneer to request a payout'
                                        : availableBalance < MIN_PAYOUT
                                            ? `Minimum payout is ₵${MIN_PAYOUT.toFixed(2)}`
                                            : 'Sent via Payoneer within a few business days'}
                                </Text>

                                <Text className="text-sm font-bold text-text-main font-sans-bold mb-3 px-1">Payout History</Text>
                                {payouts.length === 0 ? (
                                    <View className="bg-surface p-6 rounded-3xl border border-gray-100 items-center">
                                        <Text className="text-text-sub font-sans text-sm">No payouts yet.</Text>
                                    </View>
                                ) : (
                                    <View className="gap-3">
                                        {payouts.map((p) => {
                                            const s = payoutStatusStyle(p.status);
                                            return (
                                                <View key={p.id} className="bg-surface p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                                                    <View className="flex-1">
                                                        <Text className="text-text-main font-sans-bold text-base">₵{p.amount.toFixed(2)}</Text>
                                                        <Text className="text-text-sub font-sans text-xs mt-0.5">
                                                            {new Date(p.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </Text>
                                                    </View>
                                                    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: s.bg }}>
                                                        <Text className="text-xs font-bold font-sans-bold" style={{ color: s.text }}>{s.label}</Text>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </>
                        )
                    ) : (
                        <>
                            {/* Accepted methods */}
                            <View className="bg-surface p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                                <Text className="text-xs font-bold text-text-main mb-4 uppercase tracking-widest font-sans-bold">Accepted at Checkout</Text>
                                <View className="gap-3">
                                    {ACCEPTED_METHODS.map((m) => (
                                        <View key={m.label} className="flex-row items-center gap-3">
                                            <View className="w-10 h-10 bg-[#FFF1EC] rounded-xl items-center justify-center">
                                                <m.icon size={18} color="#BF592B" />
                                            </View>
                                            <View>
                                                <Text className="text-text-main font-sans-bold text-sm">{m.label}</Text>
                                                <Text className="text-text-sub font-sans text-xs">{m.sub}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                <View className="flex-row items-start gap-2 mt-5 pt-5 border-t border-gray-100">
                                    <ShieldCheck size={16} color="#8A7269" style={{ marginTop: 1 }} />
                                    <Text className="text-text-sub font-sans text-xs flex-1 leading-4">
                                        Payments are processed securely by Paystack. YenDidii never stores your card or mobile money details.
                                    </Text>
                                </View>
                            </View>

                            {/* Payment history */}
                            <View className="flex-row items-center gap-2 mb-3 px-1">
                                <Receipt size={16} color="#2D241E" />
                                <Text className="text-sm font-bold text-text-main font-sans-bold">Payment History</Text>
                            </View>

                            {loading ? (
                                <ActivityIndicator size="small" color="#D65A31" style={{ marginTop: 20 }} />
                            ) : payments.length === 0 ? (
                                <View className="bg-surface p-6 rounded-3xl border border-gray-100 items-center">
                                    <Text className="text-text-sub font-sans text-sm">No payments yet.</Text>
                                </View>
                            ) : (
                                <View className="gap-3">
                                    {payments.map((p) => {
                                        const s = statusStyle(p.payment_status);
                                        return (
                                            <TouchableOpacity
                                                key={p.id}
                                                onPress={() => router.push(`/order/${p.id}`)}
                                                className="bg-surface p-4 rounded-2xl border border-gray-100 shadow-sm flex-row items-center justify-between"
                                                activeOpacity={0.7}
                                            >
                                                <View className="flex-1">
                                                    <Text className="text-text-main font-sans-bold text-base">₵{(p.total || 0).toFixed(2)}</Text>
                                                    <Text className="text-text-sub font-sans text-xs mt-0.5">
                                                        {getPaymentLabel(p.payment_method)} · {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </Text>
                                                </View>
                                                <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: s.bg }}>
                                                    <Text className="text-xs font-bold font-sans-bold" style={{ color: s.text }}>{s.label}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </>
                    )}

                    <View className="h-10" />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
