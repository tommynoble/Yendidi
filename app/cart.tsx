import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Minus, Plus, Trash2, ShoppingCart, CheckCircle, Home } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { usePaystack } from 'react-native-paystack-webview';

type PaymentMethod = 'momo_mtn' | 'momo_voda' | 'momo_airtel' | 'card';

const PAYMENT_OPTIONS = [
    {
        id: 'momo_mtn' as PaymentMethod,
        name: 'MTN MoMo',
        icon: '📱',
        color: '#FFCC00',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-400',
        channels: ['mobile_money'] as string[],
    },
    {
        id: 'momo_voda' as PaymentMethod,
        name: 'Vodafone Cash',
        icon: '📱',
        color: '#E60000',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-400',
        channels: ['mobile_money'] as string[],
    },
    {
        id: 'momo_airtel' as PaymentMethod,
        name: 'AirtelTigo Money',
        icon: '📱',
        color: '#FF0000',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-400',
        channels: ['mobile_money'] as string[],
    },
    {
        id: 'card' as PaymentMethod,
        name: 'Card (Visa / Mastercard)',
        icon: '💳',
        color: '#1A1F71',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-400',
        channels: ['card'] as string[],
    },
];



export default function CartScreen() {
    const router = useRouter();
    const { cartItems, updateQuantity, removeFromCart, clearCart, getCartTotal } = useAppStore();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
    const [loading, setLoading] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userPhone, setUserPhone] = useState<string | null>(null);
    const { popup } = usePaystack();

    const total = getCartTotal();

    // Get user info for Paystack
    useEffect(() => {
        const fetchUserInfo = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || `${user.id.slice(0, 8)}@yendidii.app`);
                setUserPhone(user.phone || null);

                // Also try to get profile for better info
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('phone')
                    .eq('id', user.id)
                    .single();
                if (profile?.phone) setUserPhone(profile.phone);
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

        // Launch Paystack checkout
        popup.checkout({
            email,
            amount: amountInPesewas,
            reference,
            currency: 'GHS',
            channels: ['card', 'mobile_money'],
            onSuccess: async (response: any) => {
                // Payment succeeded — now create orders in Supabase
                setLoading(true);
                try {
                    // Group items by cook
                    const cooksMap = new Map<string, typeof cartItems>();
                    cartItems.forEach(item => {
                        const existing = cooksMap.get(item.cookId) || [];
                        existing.push(item);
                        cooksMap.set(item.cookId, existing);
                    });

                    // Create one order per cook
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

                        // Create order items
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
        });
    };

    // Empty Cart
    if (cartItems.length === 0) {
        return (
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                <View className="flex-1 bg-warm-cream">
                <View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
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
            <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <ChevronLeft size={28} color="#2D241E" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-text-main font-sans-bold">Your Cart</Text>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        Alert.alert('Clear Cart', 'Remove all items?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Clear', style: 'destructive', onPress: clearCart },
                        ]);
                    }}
                >
                    <Text className="text-clay-primary font-semibold text-sm font-sans-semibold">Clear All</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 200 }}>

                {/* Cart Items */}
                <View className="px-6 pt-6">
                    <Text className="text-sm font-bold text-text-sub uppercase tracking-wider mb-4 font-sans-bold">
                        {cartItems.length} item{cartItems.length > 1 ? 's' : ''}
                    </Text>

                    {cartItems.map((item) => (
                        <View key={item.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                            <View className="flex-row gap-4">
                                <Image
                                    source={{ uri: item.image || 'https://via.placeholder.com/80' }}
                                    className="w-20 h-20 rounded-xl"
                                />
                                <View className="flex-1 justify-between">
                                    <View>
                                        <View className="flex-row justify-between items-start">
                                            <View className="flex-1 pr-4">
                                                <Text className="font-bold text-text-main text-lg font-sans-bold">{item.name}</Text>
                                                <Text className="text-sm text-text-sub font-sans mb-3">by {item.cookName}</Text>
                                            </View>
                                        </View>

                                        <View className="flex-row justify-between items-center">
                                            {/* Moved Quantity Incrementer Here */}
                                            <View className="flex-row items-center gap-3 bg-gray-50 px-2 py-1.5 rounded-xl border border-gray-100">
                                                <TouchableOpacity
                                                    className="w-8 h-8 rounded-full bg-white opacity-90 shadow-sm items-center justify-center"
                                                    onPress={() => updateQuantity(item.id, item.quantity - 1)}
                                                >
                                                    <Minus size={16} color="#2D241E" />
                                                </TouchableOpacity>
                                                <Text className="font-bold text-text-main w-6 text-center text-base font-sans-bold">{item.quantity}</Text>
                                                <TouchableOpacity
                                                    className="w-8 h-8 rounded-full bg-text-main shadow-sm items-center justify-center"
                                                    onPress={() => updateQuantity(item.id, item.quantity + 1)}
                                                >
                                                    <Plus size={16} color="white" />
                                                </TouchableOpacity>
                                            </View>

                                            <Text className="text-clay-primary font-bold text-xl font-sans-bold">
                                                ₵{(item.price * item.quantity).toFixed(2)}
                                            </Text>
                                        </View>
                                    </View>

                                </View>
                                {/* Delete Overlay */}
                                <TouchableOpacity
                                    className="absolute top-4 right-4 bg-red-50 p-2 rounded-full"
                                    onPress={() => removeFromCart(item.id)}
                                >
                                    <Trash2 size={16} color="#DC2626" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Dining Info */}
                <View className="px-6 mt-6">
                    <View className="bg-white rounded-2xl p-4 flex-row items-center gap-4 border-2 border-kente-green">
                        <View className="w-12 h-12 bg-kente-green/10 rounded-xl items-center justify-center">
                            <Home size={24} color="#007A33" />
                        </View>
                        <View className="flex-1">
                            <Text className="font-bold text-text-main text-base font-sans-bold">Dine with the Cook</Text>
                            <Text className="text-sm text-text-sub font-sans">You'll eat at the cook's home — a true Ghanaian experience!</Text>
                        </View>
                    </View>
                </View>

                {/* Payment Method */}
                <View className="px-6 mt-6">
                    <Text className="text-sm font-bold text-text-sub uppercase tracking-wider mb-4 font-sans-bold">Payment Method</Text>
                    {PAYMENT_OPTIONS.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            className={`bg-white rounded-2xl p-4 mb-3 flex-row items-center gap-4 border-2 ${paymentMethod === option.id ? option.borderColor : 'border-gray-100'}`}
                            onPress={() => setPaymentMethod(option.id)}
                        >
                            <View className={`w-12 h-12 ${option.bgColor} rounded-xl items-center justify-center`}>
                                <Text style={{ fontSize: 24 }}>{option.icon}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-text-main text-base font-sans-bold">{option.name}</Text>
                                {option.id === 'card' && (
                                    <Text className="text-sm text-text-sub font-sans">Powered by Paystack</Text>
                                )}
                                {option.id.startsWith('momo') && (
                                    <Text className="text-sm text-text-sub font-sans">Mobile Wallet • Paystack</Text>
                                )}
                            </View>
                            {paymentMethod === option.id && (
                                <CheckCircle size={24} color={option.color} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                <View className="px-6 mt-6">
                    <Text className="text-sm font-bold text-text-sub uppercase tracking-wider mb-4 font-sans-bold">Order Summary</Text>
                    <View className="bg-white rounded-2xl p-5 shadow-sm">
                        <View className="flex-row justify-between mb-3">
                            <Text className="text-text-sub font-sans">Subtotal</Text>
                            <Text className="font-semibold text-text-main font-sans-semibold">₵{total.toFixed(2)}</Text>
                        </View>
                        <View className="flex-row justify-between mb-3">
                            <Text className="text-text-sub font-sans">Dining</Text>
                            <Text className="font-semibold text-kente-green font-sans-semibold">At cook's home</Text>
                        </View>
                        <View className="h-[1px] bg-gray-100 my-3" />
                        <View className="flex-row justify-between">
                            <Text className="font-bold text-text-main text-lg font-sans-bold">Total</Text>
                            <Text className="font-bold text-clay-primary text-lg font-sans-bold">₵{total.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Bar - Place Order */}
            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-6 pt-4 pb-8">
                <TouchableOpacity
                    className={`w-full h-14 rounded-2xl flex-row items-center justify-center gap-3 ${loading || !paymentMethod ? 'bg-gray-300' : 'bg-clay-primary'} active:scale-95`}
                    onPress={handlePlaceOrder}
                    disabled={loading || !paymentMethod}
                    style={!loading && paymentMethod ? { shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text className="font-bold text-white text-base font-sans-bold">Pay & Place Order</Text>
                            <Text className="text-white/80 font-bold font-sans-bold">•</Text>
                            <Text className="font-bold text-white text-base font-sans-bold">₵{total.toFixed(2)}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
            </View>
        </SafeAreaView>
    );
}
