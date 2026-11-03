import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { UtensilsCrossed, Heart } from 'lucide-react-native';
import { palette } from '@/constants/theme';
import { useAppStore } from '@/lib/store';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostDishForm from '@/components/PostDishForm';

// This tab is "Post" in Kitchen Mode (the post-a-dish form) and "Watching" for guests (their saved dishes).
export default function CookScreen() {
  const router = useRouter();
  const { isCookMode } = useAppStore();
  const insets = useSafeAreaInsets();

  // -- EATER SAVED/FAVORITES STATE --
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedListings, setSavedListings] = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  // Reload favorites every time this tab comes into focus, so a dish hearted on Home shows up right away
  // (tab screens stay mounted, so a mount-only load never saw new saves).
  useFocusEffect(useCallback(() => {
    let active = true;
    const loadFavorites = async () => {
      try {
        const raw = await AsyncStorage.getItem('yendidii_favorites');
        const ids: string[] = raw ? JSON.parse(raw) : [];
        if (!active) return;
        setSavedIds(ids);
        if (ids.length === 0) { setSavedListings([]); setSavedLoading(false); return; }
        const { data } = await supabase
          .from('listings')
          .select('id, title, price, image, profiles(full_name)')
          .in('id', ids);
        if (!active) return;
        setSavedListings(data || []);
      } catch (_) {}
      if (active) setSavedLoading(false);
    };
    loadFavorites();
    return () => { active = false; };
  }, []));

  // Kitchen Mode: the post-a-dish form.
  if (isCookMode) return <PostDishForm />;

  // ----------------------
  // RENDER: EATER MODE (Saved & Favorites)
  // ----------------------

  return (
    <SafeAreaView className="flex-1 bg-warm-cream" edges={['bottom']}>
      <View className="flex-1 bg-warm-cream">
      <View className="px-6 pb-4 border-b border-gray-100" style={{ backgroundColor: palette.surface, paddingTop: insets.top + 48, shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 10, zIndex: 10 }}>
        <Text className="text-2xl font-bold text-text-main font-sans-bold">Watching</Text>
        <Text className="text-sm text-text-sub font-sans">Meals and hosts you're keeping an eye on</Text>
      </View>

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>

        {/* Section 1: Favorites */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-text-main font-sans-bold">Watching</Text>
          <Text className="text-sm text-text-sub font-sans">{savedIds.length} watching</Text>
        </View>

        {savedLoading ? (
          <ActivityIndicator size="small" color="#D65A31" style={{ marginVertical: 20 }} />
        ) : savedListings.length === 0 ? (
          <View className="bg-surface rounded-2xl p-8 items-center mb-6 shadow-sm">
            <Heart size={40} color="#E5E7EB" />
            <Text className="text-text-sub font-sans text-center mt-3">Not watching any meals yet{'\n'}Tap ♥ on any dish to add it to your watchlist</Text>
          </View>
        ) : (
          savedListings.map((meal: any) => (
            <TouchableOpacity
              key={meal.id}
              className="bg-surface p-3 rounded-2xl mb-4 flex-row gap-4 shadow-sm"
              onPress={() => router.push(`/listing/${meal.id}`)}
            >
              {meal.image ? (
                <Image source={{ uri: (meal.image.includes(',') ? meal.image.split(',')[0].trim() : meal.image) }} className="w-20 h-20 rounded-xl bg-gray-200" />
              ) : (
                <View className="w-20 h-20 rounded-xl bg-orange-50 items-center justify-center">
                  <UtensilsCrossed size={28} color="#D65A31" />
                </View>
              )}
              <View className="flex-1 justify-center">
                <Text className="font-bold text-text-main text-lg mb-0.5" numberOfLines={1}>{meal.title}</Text>
                <Text className="text-text-sub text-xs mb-2">by {meal.profiles?.full_name || 'Host'}</Text>
                <Text className="text-clay-primary font-bold">₵{meal.price}</Text>
              </View>
              <View className="justify-center pr-2">
                <Heart size={24} color="#D65A31" fill="#D65A31" />
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* No more Watching Tip */}
        <View className="mt-8 mb-20 items-center">
          <Text className="text-gray-400 text-sm">Tap the heart icon on any meal to add it to your watchlist.</Text>
        </View>

      </ScrollView>
      </View>

    </SafeAreaView>
  );
}

