import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ShoppingCart, CheckCircle, Home, Receipt, ShieldCheck, Minus, Plus, Trash2, Smartphone, CreditCard } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { usePaystack } from 'react-native-paystack-webview';
import { getDishImage } from '@/constants/Images';
import ProcessLoader from '@/components/ProcessLoader';

const DINE_IN_IMAGE = require('@/assets/images/dine_in_2.jpg');

// Cart item names carry their chosen dining option as a "Dish (Option)" suffix — split it out for display.
const splitItemName = (name: string): { title: string; option: string | null } => {
    const match = name.match(/^(.*)\s\(([^)]+)\)$/);
    if (!match) return { title: name, option: null };
    return { title: match[1], option: match[2] };
};

type PaymentMethod = 'momo' | 'card';

const PAYMENT_OPTIONS = [
    {
        id: 'momo' as PaymentMethod,
        name: 'Mobile Money',
        subtitle: 'MTN, Vodafone, or AirtelTigo',
        Icon: Smartphone,
        color: '#00A862',
        bgColor: 'bg-green-50',
    },
    {
        id: 'card' as PaymentMethod,
        name: 'Card / Apple Pay',
        subtitle: 'Visa, Mastercard, or Apple Pay — via Paystack',
        Icon: CreditCard,
        color: '#1A1F71',
        bgColor: 'bg-blue-50',
    },
];



export default function CartScreen() {
    const router = useRouter();
    const { cartItems, updateQuantity, removeFromCart, clearCart, getCartTotal, getCartCount } = useAppStore();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
    const [loading, setLoading] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const { popup } = usePaystack();
    const insets = useSafeAreaInsets();

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)');
        }
    };

    const total = getCartTotal();

    // Get user info for Paystack
    useEffect(() => {
        const fetchUserInfo = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || `${user.id.slice(0, 8)}@yendidii.app`);
            }
        };
        fetchUserInfo();
    }, []);

    const handlePlaceOrder = async () => {
        if (!paymentMethod) {
            Alert.alert('Payment Required', 'Please select a payment method to continue.');
            return;
        }
        if (cartItems.length === 0) {
            Alert.alert('Cart Empty', 'Add some meals to your cart first!');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }

        const selectedOption = PAYMENT_OPTIONS.find(p => p.id === paymentMethod);
        const amountInPesewas = Math.round(total * 100); // Convert GHS to pesewas
        const reference = `YD_${Date.now()}_${user.id.slice(0, 6)}`;
        const email = userEmail || `${user.id.slice(0, 8)}@yendidii.app`;

        popup.checkout({
            email,
            amount: amountInPesewas,
            reference,
            metadata: { payment_method: paymentMethod },
            onSuccess: async (response: any) => {
                setLoading(true);
                try {
                    const cooksMap = new Map<string, typeof cartItems>();
                    cartItems.forEach(item => {
                        const existing = cooksMap.get(item.cookId) || [];
                        existing.push(item);
                        cooksMap.set(item.cookId, existing);
                    });

                    for (const [cookId, items] of cooksMap) {
                        const orderTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

                        const { data: order, error: orderError } = await supabase
                            .from('orders')
                            .insert({
                                user_id: user.id,
                                cook_id: cookId,
                                status: 'New',
                                total: orderTotal,
                                delivery_method: 'Dine-in',
                                payment_reference: response.reference || reference,
                                payment_method: paymentMethod,
                                payment_status: 'success',
                            })
                            .select()
                            .single();

                        if (orderError) throw orderError;

                        const orderItems = items.map(item => ({
                            order_id: order.id,
                            listing_id: item.id,
                            quantity: item.quantity,
                            price_at_purchase: item.price,
                        }));

                        const { error: itemsError } = await supabase
                            .from('order_items')
                            .insert(orderItems);

                        if (itemsError) throw itemsError;

                        // Decrement portions_available for each listing
                        for (const item of items) {
                            const { data: listing } = await supabase
                                .from('listings')
                                .select('portions_available')
                                .eq('id', item.id)
                                .single();

                            if (listing) {
                                const newPortions = Math.max(0, (listing.portions_available || 0) - item.quantity);
                                await supabase
                                    .from('listings')
                                    .update({
                                        portions_available: newPortions,
                                        available: newPortions > 0, // auto hide if sold out
                                    })
                                    .eq('id', item.id);
                            }
                        }
                    }

                    clearCart();
                    Alert.alert(
                        "Payment Successful! 🎉",
                        `Your order has been sent to the cook${cooksMap.size > 1 ? 's' : ''}.\nPayment: ${selectedOption?.name}\nRef: ${(response.reference || reference).slice(0, 15)}...`,
                        [{ text: "Track Order", onPress: () => router.replace('/(tabs)/orders') }]
                    );
                } catch (err: any) {
                    Alert.alert("Order Error", err.message || "Payment was successful but we couldn't create your order. Please contact support with reference: " + reference);
                } finally {
                    setLoading(false);
                }
            },
            onCancel: () => {
                Alert.alert("Payment Cancelled", "No charges were made. Your cart is still saved.");
            },
            onError: (error: any) => {
                Alert.alert("Payment Failed", error?.message || "Something went wrong with the payment. Please try again.");
            },
        } as any);
    };

    // Empty Cart
    if (cartItems.length === 0) {
        return (
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                <View className="flex-1 bg-warm-cream">
                <View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100">
                    <TouchableOpacity onPress={() => handleBack()} className="mr-4">
                        <ChevronLeft size={28} color="#2D241E" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-text-main font-sans-bold">Your Cart</Text>
                </View>
                <View className="flex-1 items-center justify-center px-8">
                    <ShoppingCart size={64} color="#D4D4D4" />
                    <Text className="text-xl font-bold text-text-main mt-6 mb-2 font-sans-bold">Your cart is empty</Text>
                    <Text className="text-text-sub text-center font-sans mb-8">Explore meals from local cooks and add them to your cart!</Text>
                    <TouchableOpacity
                        className="bg-clay-primary px-8 py-4 rounded-2xl active:scale-95"
                        onPress={() => router.replace('/(tabs)')}
                    >
                        <Text className="text-white font-bold font-sans-bold">Browse Meals</Text>
                    </TouchableOpacity>
                </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <View className="flex-1 bg-warm-cream">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-100">
                <TouchableOpacity onPress={() => handleBack()} className="p-2" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <ChevronLeft size={24} color="#BF592B" />
                </TouchableOpacity>
                <Text className="text-headline-md font-headline-md text-text-main font-sans-bold">Secure Your Feast</Text>
                <View className="w-8" />
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 240 }}>

                {/* Order Summary */}
                <View className="px-6 pt-6">
                    <View className="bg-white rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
                        <View className="flex-row items-center justify-between mb-5">
                            <View className="flex-row items-center gap-2">
                                <Receipt size={18} color="#BF592B" />
                                <Text className="text-title-lg font-bold text-clay-primary font-sans-bold">Order Summary</Text>
                            </View>
                            <View className="w-6 h-6 rounded-full bg-clay-primary items-center justify-center">
                                <Text className="text-white text-xs font-sans-bold">{getCartCount()}</Text>
                            </View>
                        </View>

                        <View>
                            {cartItems.map((item, index) => {
                                const { title, option } = splitItemName(item.name);
                                return (
                                    <View key={item.id} className={`flex-row gap-3 py-4 ${index > 0 ? 'border-t border-gray-100' : ''}`}>
                                        <Image source={getDishImage(title, item.image)} className="w-14 h-14 rounded-xl" />
                                        <View className="flex-1">
                                            <View className="flex-row items-start justify-between">
                                                <Text className="flex-1 pr-3 text-body-md text-text-main font-sans-semibold" numberOfLines={2}>
                                                    {title}
                                                </Text>
                                                <Text className="text-body-md font-semibold text-text-main font-sans-semibold">
                                                    ₵{(item.price * item.quantity).toFixed(2)}
                                                </Text>
                                            </View>
                                            {option && (
                                                <Text className="text-xs text-kente-green font-sans-semibold mt-1">{option}</Text>
                                            )}
                                            <View className="flex-row items-center justify-between mt-3">
                                                <View className="flex-row items-center gap-3 bg-gray-50 px-2 py-1.5 rounded-full border border-gray-100">
                                                    <TouchableOpacity
                                                        className="w-7 h-7 rounded-full bg-white items-center justify-center"
                                                        onPress={() => updateQuantity(item.id, item.quantity - 1)}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    >
                                                        <Minus size={14} color="#2D241E" />
                                                    </TouchableOpacity>
                                                    <Text className="font-bold text-text-main w-5 text-center text-sm font-sans-bold">{item.quantity}</Text>
                                                    <TouchableOpacity
                                                        className="w-7 h-7 rounded-full bg-text-main items-center justify-center"
                                                        onPress={() => updateQuantity(item.id, item.quantity + 1)}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    >
                                                        <Plus size={14} color="white" />
                                                    </TouchableOpacity>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => removeFromCart(item.id)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Trash2 size={16} color="#DC2626" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        <View className="h-[1px] bg-gray-100 my-4" />
                        <View className="flex-row justify-between items-center">
                            <Text className="text-label-lg font-label-lg text-text-sub uppercase tracking-wider font-sans-bold">Total Amount</Text>
                            <Text className="text-headline-md font-headline-md text-clay-primary font-sans-bold">₵{total.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Payment Method */}
                <View className="px-6 mt-6">
                    <Text className="text-title-lg font-title-lg text-text-main mb-4 font-sans-bold">Payment Method</Text>
                    {PAYMENT_OPTIONS.map((option) => {
                        const selected = paymentMethod === option.id;
                        const note = option.id === 'momo'
                            ? "You'll enter your Mobile Money number on the next screen, handled securely by Paystack."
                            : "You'll complete payment with your card or Apple Pay on the next screen, handled securely by Paystack.";
                        return (
                            <View
                                key={option.id}
                                className={`bg-white rounded-3xl mb-3 border-2 ${selected ? 'border-clay-primary' : 'border-gray-100'}`}
                            >
                                <TouchableOpacity
                                    className="p-4 flex-row items-center gap-4"
                                    onPress={() => setPaymentMethod(selected ? null : option.id)}
                                    activeOpacity={0.85}
                                >
                                    <View className={`w-12 h-12 ${option.bgColor} rounded-full items-center justify-center`}>
                                        <option.Icon size={20} color={option.color} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="font-bold text-text-main text-base font-sans-bold">{option.name}</Text>
                                        <Text className="text-sm text-text-sub font-sans">{option.subtitle}</Text>
                                    </View>
                                    <View
                                        className="w-6 h-6 rounded-full items-center justify-center"
                                        style={{ borderWidth: 2, borderColor: selected ? '#BF592B' : '#D4D4D4' }}
                                    >
                                        {selected && <View className="w-3 h-3 rounded-full" style={{ backgroundColor: '#BF592B' }} />}
                                    </View>
                                </TouchableOpacity>

                                {selected && (
                                    <View className="px-4 pb-4 pt-3 border-t border-gray-100 flex-row items-center gap-2">
                                        <ShieldCheck size={14} color="#56423B" />
                                        <Text className="text-xs text-text-sub font-sans flex-1">{note}</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Dine with the Cook */}
                <View className="px-6 mt-2">
                    <View style={{ height: 140, borderRadius: 24, overflow: 'hidden', position: 'relative' }}>
                        <Image source={DINE_IN_IMAGE} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '75%', justifyContent: 'flex-end', padding: 16 }}
                        >
                            <View className="flex-row items-center gap-2 mb-1">
                                <Home size={16} color="#fff" />
                                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Dine with the Cook
                                </Text>
                            </View>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#fff' }}>
                                Savor the moment.
                            </Text>
                            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                                You'll eat at the cook's home — a true Ghanaian experience.
                            </Text>
                        </LinearGradient>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Bar - Place Order */}
            <View
                className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 pt-4"
                style={{ paddingBottom: insets.bottom + 16 }}
            >
                <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-text-sub font-sans">Final Total</Text>
                    <Text className="text-lg font-bold text-clay-primary font-sans-bold">₵{total.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                    className={`w-full h-14 rounded-full flex-row items-center justify-center gap-2 ${loading || !paymentMethod ? 'bg-gray-300' : 'bg-clay-primary'} active:scale-95`}
                    onPress={handlePlaceOrder}
                    disabled={loading || !paymentMethod}
                    style={!loading && paymentMethod ? { shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text className="font-bold text-white text-base font-sans-bold">Complete Order</Text>
                            <CheckCircle size={18} color="white" />
                        </>
                    )}
                </TouchableOpacity>
                <View className="flex-row items-center justify-center gap-1.5 mt-3">
                    <ShieldCheck size={12} color="#56423B" />
                    <Text className="text-xs text-text-sub font-sans">Secure checkout, encrypted end-to-end</Text>
                </View>
            </View>
            </View>

            <ProcessLoader 
                visible={loading} 
                message="Processing Payment..."
            />
        </SafeAreaView>
    );
}
