import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Calendar, Clock, Trash2, Plus, UtensilsCrossed } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { DAYS, TIME_PRESETS, MIN_GAP_DAYS, MAX_SESSIONS, SESSION_SERVING_CAP, nextDateForWeekday, isTooCloseToExistingSessions } from '@/lib/schedule';

export default function CookScheduleScreen() {
    const router = useRouter();
    const [showAdd, setShowAdd] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const { data: sessions = [], isLoading, refetch } = useQuery({
        queryKey: ['cook-sessions-schedule'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];
            const { data, error } = await supabase
                .from('cook_sessions')
                .select('*, listings(id, title)')
                .eq('cook_id', user.id)
                .gte('session_date', new Date().toISOString().split('T')[0])
                .order('session_date', { ascending: true });

            if (error) {
                console.error('Error fetching sessions:', error);
                return [];
            }
            return data || [];
        },
    });

    const canAddMore = sessions.length < MAX_SESSIONS;

    const handleAddSession = async () => {
        if (selectedDay === null || !selectedTime) {
            Alert.alert('Incomplete', 'Pick a day and time for your session.');
            return;
        }
        const candidateDate = nextDateForWeekday(selectedDay);
        if (isTooCloseToExistingSessions(candidateDate, sessions)) {
            Alert.alert('Too Close', `Cooking sessions need at least ${MIN_GAP_DAYS} full days between them.`);
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not logged in');

            const { error } = await supabase.from('cook_sessions').insert({
                cook_id: user.id,
                session_date: candidateDate.toISOString().split('T')[0],
                start_time: `${selectedTime}:00`,
            });
            if (error) throw error;

            setShowAdd(false);
            setSelectedDay(null);
            setSelectedTime(null);
            refetch();
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSession = (session: any) => {
        const dish = session.listings?.[0];
        Alert.alert(
            'Remove Host Day',
            dish
                ? `"${dish.title}" is attached to this host day — it'll stay live but lose its scheduled time. Continue?`
                : 'Remove this host day?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove', style: 'destructive', onPress: async () => {
                        const { error } = await supabase.from('cook_sessions').delete().eq('id', session.id);
                        if (error) Alert.alert('Error', error.message);
                        else refetch();
                    }
                },
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
            <View className="flex-1 bg-warm-cream">
                <View className="flex-row items-center justify-between px-4 py-4 bg-surface border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} className="p-2" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <ChevronLeft size={24} color="#BF592B" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-text-main font-sans-bold">Weekly Schedule</Text>
                    <View className="w-8" />
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
                    <Text className="text-text-sub font-sans mb-6">
                        You cook {MAX_SESSIONS} days a week — one dish per host day, fixed at {SESSION_SERVING_CAP} portions, with at least {MIN_GAP_DAYS} days between host days.
                    </Text>

                    {isLoading ? (
                        <ActivityIndicator color="#D65A31" />
                    ) : sessions.length === 0 ? (
                        <View className="items-center py-8">
                            <Calendar size={40} color="#D4D4D4" />
                            <Text className="text-text-sub font-sans mt-3 text-center">No host days scheduled yet.</Text>
                        </View>
                    ) : (
                        sessions.map((session: any) => {
                            const dish = session.listings?.[0];
                            return (
                                <View key={session.id} className="bg-surface rounded-3xl p-5 mb-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 }}>
                                    <View className="flex-row items-center justify-between mb-3">
                                        <View className="flex-row items-center gap-2">
                                            <Calendar size={16} color="#BF592B" />
                                            <Text className="font-bold text-text-main font-sans-bold text-base">
                                                {format(parseISO(session.session_date), 'EEEE, MMM d')}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => handleDeleteSession(session)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Trash2 size={16} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-row items-center gap-2 mb-3">
                                        <Clock size={14} color="#56423B" />
                                        <Text className="text-sm text-text-sub font-sans">
                                            {format(new Date(`2000-01-01T${session.start_time}`), 'h:mm a')}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center gap-2">
                                        <UtensilsCrossed size={14} color="#8A7269" />
                                        <Text className="text-xs text-text-sub font-sans">
                                            {dish ? `${dish.title} — ${SESSION_SERVING_CAP} portions` : 'Open — no dish assigned yet'}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}

                    {canAddMore && !showAdd && (
                        <TouchableOpacity
                            onPress={() => setShowAdd(true)}
                            className="bg-surface rounded-3xl p-5 border-2 border-dashed border-clay-primary/30 items-center flex-row justify-center gap-2"
                        >
                            <Plus size={18} color="#BF592B" />
                            <Text className="text-clay-primary font-bold font-sans-bold">Add Host Day</Text>
                        </TouchableOpacity>
                    )}

                    {showAdd && (
                        <View className="bg-surface rounded-3xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 }}>
                            <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase tracking-widest px-1">Day</Text>
                            <View className="flex-row flex-wrap gap-2 mb-4">
                                {DAYS.map((day) => (
                                    <TouchableOpacity
                                        key={day.value}
                                        onPress={() => setSelectedDay(day.value)}
                                        className={`px-4 py-2 rounded-xl border ${selectedDay === day.value ? 'bg-clay-primary border-clay-primary' : 'bg-gray-50 border-gray-100'}`}
                                    >
                                        <Text className={`text-xs font-bold ${selectedDay === day.value ? 'text-white' : 'text-text-sub'}`}>{day.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase tracking-widest px-1">Time</Text>
                            <View className="flex-row flex-wrap gap-2 mb-5">
                                {TIME_PRESETS.map((time) => (
                                    <TouchableOpacity
                                        key={time.value}
                                        onPress={() => setSelectedTime(time.value)}
                                        className={`px-4 py-2 rounded-xl border ${selectedTime === time.value ? 'bg-clay-primary border-clay-primary' : 'bg-gray-50 border-gray-100'}`}
                                    >
                                        <Text className={`text-xs font-bold ${selectedTime === time.value ? 'text-white' : 'text-text-sub'}`}>{time.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={() => { setShowAdd(false); setSelectedDay(null); setSelectedTime(null); }}
                                    className="flex-1 py-3 rounded-xl border border-gray-100 items-center"
                                >
                                    <Text className="text-text-sub font-bold font-sans-bold">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleAddSession}
                                    disabled={saving}
                                    className={`flex-1 py-3 rounded-xl items-center ${saving ? 'bg-gray-300' : 'bg-clay-primary'}`}
                                >
                                    {saving ? <ActivityIndicator color="white" size="small" /> : (
                                        <Text className="text-white font-bold font-sans-bold">Save Host Day</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
