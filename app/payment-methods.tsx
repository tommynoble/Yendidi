import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CreditCard, Smartphone, ShieldCheck, Receipt } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { palette } from '@/constants/theme';
import HostPayoutsScreen from '@/components/HostPayoutsScreen';

const ACCEPTED_METHODS = [
    { label: 'Card', sub: 'Visa, Mastercard', icon: CreditCard },
    { label: 'MTN MoMo', sub: 'Mobile Money', icon: Smartphone },
    { label: 'Vodafone Cash', sub: 'Mobile Money', icon: Smartphone },
    { label: 'AirtelTigo Money', sub: 'Mobile Money', icon: Smartphone },
];

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

// Hosts get the Earnings & Payouts page; eaters get their accepted payment methods and payment history.
export default function PaymentMethodsScreen() {
    const isCookMode = useAppStore(state => state.isCookMode);
    return isCookMode ? <HostPayoutsScreen /> : <EaterPayments />;
}

function EaterPayments() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);

    useEffect(() => {
        loadPayments();
    }, []);

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

    const statusStyle = (status: string | null) => {
        if (status === 'success') return { bg: '#E8F5E9', text: '#2E7D32', label: 'Paid' };
        if (status === 'failed') return { bg: '#FDEDED', text: '#C62828', label: 'Failed' };
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
                    <Text className="text-lg font-bold text-text-main font-sans-bold">Payment Methods</Text>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                        <>
                            {/* Accepted methods */}
                            <View className="bg-surface p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                                <Text className="text-xs font-bold text-text-main mb-4 uppercase tracking-widest font-sans-bold">Accepted at Checkout</Text>
                                <View className="gap-3">
                                    {ACCEPTED_METHODS.map((m) => (
                                        <View key={m.label} className="flex-row items-center gap-3">
                                            <View className="w-10 h-10 bg-[#FFF1EC] rounded-xl items-center justify-center">
                                                <m.icon size={18} color={palette.accent} />
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

                    <View className="h-10" />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
