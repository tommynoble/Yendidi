import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MessageCircle, Phone, MapPin, Clock, Star, Check, ChefHat, Navigation, ShieldCheck, CreditCard, Package, Receipt, X, Utensils, Info, Flame, BadgeCheck, CalendarDays, Ticket, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getDishImage } from '@/constants/Images';
import { palette, type, fonts } from '@/constants/theme';
import { openConversationWithHost } from '@/lib/messaging';
import { earliestEventAt, bookingTiming, displayStatusFor, tableReadyNow, formatEventHero, formatEventTime, formatEventSentence, countdownLabel } from '@/lib/booking';

const STATUS_STEPS = [
    { key: 'New', label: 'Order placed', icon: Ticket },
    { key: 'Accepted', label: 'Order accepted', icon: ShieldCheck },
    { key: 'Cooking', label: 'Cooking', icon: Flame },
    { key: 'Ready', label: 'Your table is ready', icon: Utensils },
    { key: 'Completed', label: 'Enjoyed & completed', icon: Star },
];

const STATUS_ORDER = ['New', 'Accepted', 'Cooking', 'Ready', 'Completed'];

// Same look as the other pages we've built: warm cards with a soft orange outline, peach icon tiles, light field fills.
const CARD_BORDER = 'rgba(194, 83, 39, 0.22)';
const FIELD_FILL = '#FFF8F5';
const FIELD_BORDER = 'rgba(194, 83, 39, 0.14)';
const PEACH = '#FFDBCD';
const JOURNEY_GREEN = '#2F6B54';

function Card({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
    return (
        <View style={{ backgroundColor: palette.surface, borderRadius: 24, borderWidth: 1, borderColor: CARD_BORDER, padding: compact ? 16 : 20, marginHorizontal: 20, marginTop: compact ? 12 : 16, shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}>
            {children}
        </View>
    );
}

// One line of the booking & payment summary: label on the left, value on the right (or underneath for long text).
function SummaryRow({ label, value, chip, small, stacked, last, big }: { label: string; value: string; chip?: boolean; small?: boolean; stacked?: boolean; last?: boolean; big?: boolean }) {
    return (
        <View
            style={[
                { paddingVertical: 10 },
                !last && { borderBottomWidth: 1, borderBottomColor: 'rgba(194, 83, 39, 0.12)' },
                stacked ? undefined : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
            ]}
        >
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: palette.muted, marginBottom: stacked ? 4 : 0 }}>{label}</Text>
            {chip ? (
                <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999, backgroundColor: '#E9F7EE' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#007A33' }}>{value}</Text>
                </View>
            ) : (
                <Text
                    numberOfLines={small ? 1 : undefined}
                    style={{ flexShrink: 1, fontFamily: small ? fonts.medium : fonts.bold, fontSize: big ? 18 : small ? 12 : 14.5, lineHeight: stacked ? 21 : undefined, color: big ? palette.accent : palette.ink, textAlign: stacked ? 'left' : 'right' }}
                >
                    {value}
                </Text>
            )}
        </View>
    );
}

function CardTitle({ icon: Icon, title, right, compact }: { icon: any; title: string; right?: React.ReactNode; compact?: boolean }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 12 : 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: compact ? 30 : 34, height: compact ? 30 : 34, borderRadius: 12, backgroundColor: PEACH, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={compact ? 16 : 18} color={palette.accent} />
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: compact ? 16 : 17, color: palette.ink }}>{title}</Text>
            </View>
            {right}
        </View>
    );
}

export default function OrderDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const queryClient = useQueryClient();
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [openingChat, setOpeningChat] = useState(false);
    const [showAllSteps, setShowAllSteps] = useState(false);

    // Fetch real order data from Supabase
    const { data: order, isLoading, error, refetch } = useQuery({
        queryKey: ['order-detail', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        id,
                        quantity,
                        price_at_purchase,
                        listings (
                            id,
                            title,
                            image,
                            prep_time_minutes,
                            location_text,
                            portions_available,
                            order_deadline,
                            profiles (
                                id,
                                full_name,
                                avatar_url,
                                kitchen_image_url,
                                phone,
                                rating,
                                served_count,
                                location,
                                kitchen_name,
                                id_verified,
                                location_description,
                                latitude,
                                longitude
                            )
                        )
                    )
                `)
                .eq('id', id as string)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    const { data: existingReview } = useQuery({
        queryKey: ['order-review', id],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;
            const { data } = await supabase
                .from('reviews')
                .select('*')
                .eq('order_id', id as string)
                .eq('user_id', user.id)
                .maybeSingle();
            return data;
        },
        enabled: !!id,
    });

    const handleSubmitReview = async () => {
        if (reviewRating === 0 || !order) return;
        setSubmittingReview(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');
            const cookId = order.order_items?.[0]?.listings?.profiles?.id;
            const listingId = order.order_items?.[0]?.listings?.id;
            if (!cookId) throw new Error('Could not find the cook for this order');

            const { error } = await supabase.from('reviews').insert({
                order_id: order.id,
                user_id: user.id,
                cook_id: cookId,
                listing_id: listingId,
                rating: reviewRating,
                comment: reviewComment.trim() || null,
            });
            if (error) throw error;

            setReviewModalVisible(false);
            queryClient.invalidateQueries({ queryKey: ['order-review', id] });
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not submit your review');
        } finally {
            setSubmittingReview(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'New': return '#84523C';
            case 'Accepted': return palette.accent;
            case 'Cooking': return '#D97706';
            case 'Ready': return '#007A33';
            case 'Completed': return '#007A33';
            case 'Cancelled': return '#B3261E';
            default: return palette.muted;
        }
    };

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

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
        }) + ' at ' + date.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    };

    const getEstimatedReady = () => {
        if (!order?.created_at) return null;
        const firstItem = order.order_items?.[0];
        const prepMin = firstItem?.listings?.prep_time_minutes || 30;
        const created = new Date(order.created_at);
        const ready = new Date(created.getTime() + prepMin * 60 * 1000);
        return ready.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const formatClock = (dateStr: string) =>
        new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const handleCancelOrder = () => {
        if (!order || order.status === 'Cancelled' || order.status === 'Completed') return;
        Alert.alert(
            'Cancel Order',
            'Are you sure you want to cancel this order? This cannot be undone.',
            [
                { text: 'Keep Order', style: 'cancel' },
                {
                    text: 'Cancel Order', style: 'destructive', onPress: async () => {
                        const { error } = await supabase
                            .from('orders')
                            .update({ status: 'Cancelled' })
                            .eq('id', order.id);
                        if (error) {
                            Alert.alert('Error', 'Could not cancel order. Please try again.');
                        } else {
                            refetch();
                        }
                    }
                },
            ]
        );
    };

    // Loading
    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
                <ActivityIndicator size="large" color={palette.accent} />
                <Text style={{ fontFamily: fonts.regular, color: palette.muted, marginTop: 12 }}>Loading order...</Text>
            </SafeAreaView>
        );
    }

    // Error or not found
    if (error || !order) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }} edges={['top']}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 17, color: palette.muted, textAlign: 'center', marginBottom: 16 }}>
                    Sorry, we couldn't find that order.
                </Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.accent }}>Go back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const cook = order.order_items?.[0]?.listings?.profiles;
    const cookLocation = cook?.location || order.order_items?.[0]?.listings?.location_text || null;
    const cookLandmark = cook?.location_description || null;
    const cookKitchenName = cook?.kitchen_name || null;
    const hostName = cookKitchenName || cook?.full_name || 'Your host';
    const cookLat = cook?.latitude;
    const cookLng = cook?.longitude;
    // When is the gathering? Until it's close, the guest is simply "confirmed": Cooking/Ready only mean the host is preparing.
    const eventAt = earliestEventAt(order.order_items);
    const timing = bookingTiming(eventAt);
    const displayStatus = displayStatusFor(order.status, eventAt);
    const readyNow = tableReadyNow(order.status, eventAt);
    const statusChipLabel =
        order.status === 'New' ? 'Awaiting host'
        : displayStatus === 'Accepted' && timing.scheduled ? 'Confirmed'
        : readyNow ? 'Table ready'
        : order.status;
    const currentStepIndex = STATUS_ORDER.indexOf(displayStatus);
    // The step shown while the timeline is collapsed: where the booking is now (the last step once completed).
    const shownStepIndex = order.status === 'Completed' ? STATUS_STEPS.length - 1 : Math.max(0, currentStepIndex);
    const seatCount = (order.order_items || []).reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0) || 1;
    const isActive = ['New', 'Accepted', 'Cooking', 'Ready'].includes(order.status);
    const journeyDone = order.status === 'Completed' ? STATUS_STEPS.length : Math.max(0, currentStepIndex);

    const handleMessageHost = async () => {
        if (!cook?.id || openingChat) return;
        setOpeningChat(true);
        try {
            const conversationId = await openConversationWithHost(cook.id);
            router.push(`/messages/${conversationId}`);
        } catch (e) {
            Alert.alert("Couldn't open the chat", 'Please check your connection and try again.');
        } finally {
            setOpeningChat(false);
        }
    };
    const isCompleted = order.status === 'Completed';
    const isCancelled = order.status === 'Cancelled';

    const firstItem = order.order_items?.[0];
    const firstItemTitle = firstItem?.listings?.title || 'Meal';
    const extraItemsCount = (order.order_items?.length || 1) - 1;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.surface }} edges={['top']}>
            <View style={{ flex: 1, backgroundColor: palette.canvas }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: 'rgba(221, 193, 182, 0.6)' }}>
                <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Back">
                    <ArrowLeft size={24} color="#2D241E" />
                </TouchableOpacity>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: palette.ink }}>Order details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                {/* Hero: status, title, and when */}
                <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                    <View style={{ height: 210, borderRadius: 24, overflow: 'hidden', position: 'relative', borderWidth: 1.5, borderColor: 'rgba(194, 83, 39, 0.35)' }}>
                        <Image source={getDishImage(firstItemTitle, firstItem?.listings?.image)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        {/* Dark only toward the bottom, so the faces in the photo stay clear and the text sits on a calm, even shade */}
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
                            locations={[0, 0.55, 1]}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '62%', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}
                        >
                            <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: '#fff' }} numberOfLines={2}>
                                {firstItemTitle}{extraItemsCount > 0 ? ` +${extraItemsCount} more` : ''}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                <CalendarDays size={14} color="rgba(255,255,255,0.9)" />
                                <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: 'rgba(255,255,255,0.92)' }}>
                                    {eventAt
                                        ? `${formatEventHero(eventAt)}${isActive && timing.isFuture ? ` · ${countdownLabel(eventAt)}` : ''}`
                                        : `Ordered ${formatDate(order.created_at)}`}
                                </Text>
                            </View>
                        </LinearGradient>
                        {/* The one place status is shown on the photo */}
                        <View style={{ position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, backgroundColor: 'rgba(251, 245, 242, 0.95)' }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getStatusColor(displayStatus) }} />
                            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: getStatusColor(displayStatus) }}>{statusChipLabel}</Text>
                        </View>
                    </View>
                </View>

                {/* Timeline: just where you are now, with the rest one tap away */}
                <Card compact>
                    {isCancelled ? (
                        <CardTitle compact icon={Ticket} title="Order status" />
                    ) : (
                        <CardTitle
                            compact
                            icon={Utensils}
                            title="Dining journey"
                            right={
                                <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999, backgroundColor: PEACH }}>
                                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#9C3F12' }}>{journeyDone} of {STATUS_STEPS.length} complete</Text>
                                </View>
                            }
                        />
                    )}

                    {!isCancelled && (
                        <>
                            <View>
                                {STATUS_STEPS.map((step, index) => {
                                    if (!showAllSteps && index !== shownStepIndex) return null;
                                    const isDone = isCompleted || index < currentStepIndex;
                                    const isCurrent = !isCompleted && index === currentStepIndex;
                                    const isLast = !showAllSteps || index === STATUS_STEPS.length - 1;
                                    const StepIcon = step.icon;
                                    const dishTitle = firstItemTitle;

                                    // Only times we actually know: when it was placed, when the order last changed, and the gathering time.
                                    let time: string | null = null;
                                    if (index === 0) time = formatClock(order.created_at);
                                    else if (isCurrent || (isCompleted && index === STATUS_STEPS.length - 1)) time = formatClock(order.updated_at || order.created_at);
                                    else if (step.key === 'Ready' && !isDone && eventAt) time = formatEventTime(eventAt);
                                    else if (step.key === 'Ready' && !isDone && getEstimatedReady()) time = `Est. ${getEstimatedReady()}`;

                                    // For a booked gathering the later steps are about "the day", not "right now".
                                    const label = timing.scheduled && step.key === 'Accepted' ? 'Booking confirmed'
                                        : timing.scheduled && step.key === 'Ready' && !isDone && !isCurrent ? 'Gathering day'
                                        : step.label;

                                    const description = (() => {
                                        switch (step.key) {
                                            case 'New': return `Your booking with ${hostName} has been placed.`;
                                            case 'Accepted':
                                                if (!(isDone || isCurrent)) return `Waiting for ${hostName} to confirm.`;
                                                return eventAt ? `${hostName} confirmed your spot for ${formatEventSentence(eventAt)}.` : `${hostName} confirmed your booking.`;
                                            case 'Cooking': return isDone || isCurrent ? `${hostName} is preparing ${dishTitle}.` : 'Your host will start preparing on the day.';
                                            case 'Ready':
                                                if (isDone || isCurrent) return 'Your table is ready. Head over when you can.';
                                                return eventAt ? `Head over on ${formatEventSentence(eventAt)}.` : "We'll let you know when your table is ready.";
                                            default: return isDone || isCurrent ? `Thanks for dining with ${hostName}.` : 'Enjoy your meal, then leave a review.';
                                        }
                                    })();

                                    return (
                                        <View key={step.key} style={{ flexDirection: 'row', gap: 12 }}>
                                            {/* circle + the line down to the next step */}
                                            <View style={{ width: 30, alignItems: 'center' }}>
                                                <View
                                                    style={{
                                                        width: 30,
                                                        height: 30,
                                                        borderRadius: 15,
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: isDone ? palette.accent : isCurrent ? '#9C3F12' : '#F6E9E3',
                                                        borderWidth: isCurrent || isDone ? 0 : 1,
                                                        borderColor: 'rgba(194, 83, 39, 0.15)',
                                                        ...(isCurrent ? { shadowColor: '#9C3F12', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 } : {}),
                                                    }}
                                                >
                                                    {isDone ? <Check size={15} color="#FFFFFF" strokeWidth={3} /> : <StepIcon size={15} color={isCurrent ? '#FFFFFF' : '#D9C3B9'} />}
                                                </View>
                                                {!isLast && <View style={{ flex: 1, minHeight: 10, width: 2, marginTop: 3, marginBottom: 3, borderRadius: 1, backgroundColor: isDone ? 'rgba(194, 83, 39, 0.6)' : '#E8D3C9' }} />}
                                            </View>

                                            <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16, minHeight: 30, justifyContent: 'center' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 14.5, color: isCurrent ? '#9C3F12' : isDone ? palette.ink : '#A88F85' }}>
                                                        {label}
                                                    </Text>
                                                    {isCurrent && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#9C3F12' }} />}
                                                    <View style={{ flex: 1 }} />
                                                    {!!time && (
                                                        <Text style={{ fontFamily: isCurrent ? fonts.bold : fonts.medium, fontSize: 12, color: isCurrent ? '#9C3F12' : isDone ? palette.muted : '#B8A39A' }}>{time}</Text>
                                                    )}
                                                </View>
                                                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: isCurrent || isDone ? '#56423B' : '#B8A39A', marginTop: 2 }}>
                                                    {description}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            <TouchableOpacity
                                onPress={() => setShowAllSteps((v) => !v)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={showAllSteps ? 'Hide steps' : 'Show all steps'}
                                style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 }}
                            >
                                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: palette.accent }}>{showAllSteps ? 'Hide steps' : 'Show all steps'}</Text>
                                {showAllSteps ? <ChevronUp size={16} color={palette.accent} /> : <ChevronDown size={16} color={palette.accent} />}
                            </TouchableOpacity>
                        </>
                    )}

                    {isCancelled && (
                        <View style={{ backgroundColor: '#FDEDED', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(179, 38, 30, 0.2)' }}>
                            <Text style={{ fontSize: 24 }}>❌</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#B3261E' }}>Order cancelled</Text>
                                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: '#B3261E', marginTop: 2 }}>This order was cancelled.</Text>
                            </View>
                        </View>
                    )}
                </Card>

                {/* Your host and where to go, together */}
                {cook && (
                    <Card compact>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {cook.kitchen_image_url || cook.avatar_url ? (
                                <Image source={{ uri: cook.kitchen_image_url || cook.avatar_url }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(194, 83, 39, 0.45)' }} />
                            ) : (
                                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: PEACH, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(194, 83, 39, 0.45)' }}>
                                    <ChefHat size={24} color={palette.accent} />
                                </View>
                            )}

                            <View style={{ flex: 1 }}>
                                <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, letterSpacing: 1, color: palette.muted, textTransform: 'uppercase' }}>Your host</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                                    <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 16.5, color: palette.ink }}>
                                        {cookKitchenName || cook.full_name || 'Home Host'}
                                    </Text>
                                    {cook.id_verified && <BadgeCheck size={16} color={JOURNEY_GREEN} accessibilityLabel="Verified host" />}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                    <Star size={13} color="#C25327" fill="#C25327" />
                                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.accent }}>{cook.rating ? Number(cook.rating).toFixed(1) : 'New'}</Text>
                                    {Number(cook.served_count) >= 1 && (
                                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: '#56423B' }}>• {cook.served_count}+ served</Text>
                                    )}
                                </View>
                            </View>

                            {/* Round actions: call (outlined) and message (filled) */}
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {cook.phone && (
                                    <TouchableOpacity
                                        onPress={() => Linking.openURL(`tel:${cook.phone}`)}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                        accessibilityLabel="Call host"
                                        style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Phone size={18} color={palette.accent} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={handleMessageHost}
                                    disabled={openingChat}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Message ${cookKitchenName || cook.full_name || 'host'}`}
                                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', opacity: openingChat ? 0.6 : 1 }}
                                >
                                    {openingChat ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MessageCircle size={18} color="#FFFFFF" />}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Where to go */}
                        {(cookLocation || cookLandmark) && (
                            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(194, 83, 39, 0.14)' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <MapPin size={14} color={palette.accent} />
                                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.accent }}>Where to go</Text>
                                </View>
                                {cookLocation && (
                                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: palette.ink }}>{cookLocation}</Text>
                                )}
                                {cookLandmark && (
                                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.muted, fontStyle: 'italic', marginTop: 3 }}>📍 {cookLandmark}</Text>
                                )}
                                {isActive && order.status !== 'New' && (
                                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: '#56423B', marginTop: 8 }}>
                                        <Text style={{ fontFamily: fonts.bold, color: palette.ink }}>Arrival: </Text>
                                        {timing.scheduled && !timing.comeNow
                                            ? `Arrive a few minutes early on the day and say hello to ${hostName}. Can't find the door? Message them.`
                                            : `Head to the address and say hello to ${hostName}. Can't find the door? Message them.`}
                                    </Text>
                                )}
                            </View>
                        )}

                        {cookLat && cookLng && (
                            <TouchableOpacity
                                style={{ marginTop: 12, height: 46, borderRadius: 16, backgroundColor: FIELD_FILL, borderWidth: 1, borderColor: 'rgba(194, 83, 39, 0.3)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                onPress={() => Linking.openURL(`https://maps.apple.com/?daddr=${cookLat},${cookLng}`)}
                                activeOpacity={0.85}
                            >
                                <Navigation size={16} color={palette.accent} />
                                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.accent }}>Directions</Text>
                            </TouchableOpacity>
                        )}
                    </Card>
                )}

                {/* Receipt: seats, total and payment in one place */}
                <Card compact>
                    <CardTitle
                        compact
                        icon={Receipt}
                        title="Receipt"
                        right={<Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: palette.muted }}>Ordered {formatDate(order.created_at)}</Text>}
                    />

                    {(order.order_items?.length || 0) > 1 ? (
                        order.order_items.map((item: any, index: number) => (
                            <SummaryRow
                                key={item.id || index}
                                label={`${item.listings?.title || 'Meal'} × ${item.quantity}`}
                                value={`₵${(item.price_at_purchase * item.quantity).toFixed(2)}`}
                            />
                        ))
                    ) : (
                        <SummaryRow label="Seats" value={`${seatCount} ${seatCount === 1 ? 'seat' : 'seats'}`} />
                    )}
                    {Number(order.discount_amount) > 0 && (
                        <SummaryRow label={order.promo_code ? `Promo ${order.promo_code}` : 'Discount'} value={`-₵${Number(order.discount_amount).toFixed(2)}`} />
                    )}
                    <SummaryRow label="Total" value={`₵${order.total?.toFixed(2)}`} big />
                    <SummaryRow label="Method" value={getPaymentLabel(order.payment_method)} />
                    <SummaryRow
                        label="Payment"
                        value={order.payment_status === 'success' ? 'Paid ✓' : order.payment_status || 'Pending'}
                        chip={order.payment_status === 'success'}
                    />
                    <SummaryRow label="Reference" value={String(order.payment_reference || '-')} small last={!order.notes && !order.delivery_address} />

                    {(order.notes || order.delivery_address) && (
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: palette.muted, paddingTop: 10 }}>
                            {order.delivery_address ? `Address: ${order.delivery_address}${order.notes ? '\n' : ''}` : ''}
                            {order.notes ? `Note: ${order.notes}` : ''}
                        </Text>
                    )}
                </Card>

                {/* House courtesy — while the booking is confirmed and upcoming */}
                {isActive && order.status !== 'New' && (
                    <View style={{ marginHorizontal: 20, marginTop: 16, borderRadius: 24, padding: 20, flexDirection: 'row', gap: 12, backgroundColor: 'rgba(194, 83, 39, 0.06)', borderWidth: 1, borderColor: 'rgba(194, 83, 39, 0.18)' }}>
                        <Info size={18} color={palette.accent} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.ink }}>House courtesy</Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: '#56423B', marginTop: 4 }}>
                                You're a guest in your host's home. Arrive on time, mention any allergies early, and help keep the evening relaxed for everyone.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Leave a Review — only once the order is Completed */}
                {isCompleted && cook && (
                    <Card>
                        {existingReview ? (
                            <View>
                                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: palette.ink, marginBottom: 8 }}>Your review</Text>
                                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <Star key={n} size={18} color="#FFCD00" fill={n <= existingReview.rating ? '#FFCD00' : 'transparent'} />
                                    ))}
                                </View>
                                {existingReview.comment && (
                                    <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: '#56423B' }}>{existingReview.comment}</Text>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                onPress={() => setReviewModalVisible(true)}
                                activeOpacity={0.8}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: palette.ink }}>Rate your experience</Text>
                                    <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: palette.muted, marginTop: 2 }}>Let {cookKitchenName || cook.full_name || 'the host'} know how it went</Text>
                                </View>
                                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: PEACH, alignItems: 'center', justifyContent: 'center' }}>
                                    <Star size={22} color={palette.accent} />
                                </View>
                            </TouchableOpacity>
                        )}
                    </Card>
                )}

                {/* Cancel Order — only for active orders */}
                {isActive && order.status === 'New' && (
                    <TouchableOpacity
                        onPress={handleCancelOrder}
                        activeOpacity={0.8}
                        style={{ marginHorizontal: 20, marginTop: 20, height: 50, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(179, 38, 30, 0.35)', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: '#B3261E' }}>Cancel order</Text>
                    </TouchableOpacity>
                )}

                <View style={{ height: 32 }} />
            </ScrollView>
            </View>

            <Modal visible={reviewModalVisible} transparent animationType="slide" onRequestClose={() => setReviewModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(35, 25, 21, 0.45)', justifyContent: 'flex-end' }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        activeOpacity={1}
                        onPress={() => setReviewModalVisible(false)}
                    />
                    <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTopWidth: 1, borderColor: CARD_BORDER }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: palette.ink }}>Rate your experience</Text>
                            <TouchableOpacity onPress={() => setReviewModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <X size={22} color={palette.muted} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                            {[1, 2, 3, 4, 5].map((n) => (
                                <TouchableOpacity key={n} onPress={() => setReviewRating(n)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                                    <Star size={36} color="#FFCD00" fill={n <= reviewRating ? '#FFCD00' : 'transparent'} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            placeholder="Add a comment (optional)"
                            placeholderTextColor={palette.muted}
                            value={reviewComment}
                            onChangeText={setReviewComment}
                            multiline
                            textAlignVertical="top"
                            style={{ minHeight: 90, backgroundColor: FIELD_FILL, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontFamily: fonts.regular, fontSize: 15, color: palette.ink, borderWidth: 1, borderColor: 'rgba(194, 83, 39, 0.25)', marginBottom: 16 }}
                        />

                        <TouchableOpacity
                            onPress={handleSubmitReview}
                            disabled={reviewRating === 0 || submittingReview}
                            style={{ height: 54, borderRadius: 16, backgroundColor: palette.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: reviewRating === 0 || submittingReview ? 0.5 : 1, shadowColor: palette.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                        >
                            {submittingReview
                                ? <ActivityIndicator size="small" color="white" />
                                : <><Check size={18} color="white" /><Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' }}>Submit review</Text></>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
