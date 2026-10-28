import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, KeyboardAvoidingView, Platform, Modal, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { UtensilsCrossed, Clock, Users, Camera, ChevronRight, Heart, ShoppingBag, ArrowRight, Calendar, Plus, Check, Search, X, ArrowLeft, MapPin, Navigation, Lock, Wheat, Soup, Flame, Apple, Fish, Cake, Leaf, Sprout, Utensils, Save } from 'lucide-react-native';

const CATEGORY_ICONS: { [key: string]: React.ComponentType<any> } = {
  'Rice Dishes': Wheat,
  'Soups & Stews': Soup,
  'Grills & Kebabs': Flame,
  'Traditional Snacks': Apple,
  'Seafood': Fish,
  'Pastries': Cake,
  'Vegan': Leaf,
  'Vegetarian': Sprout
};
import { useAppStore } from '@/lib/store';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProcessLoader from '@/components/ProcessLoader';
import { format, parseISO } from 'date-fns';
import { DAYS, TIME_PRESETS, MIN_GAP_DAYS, MAX_SESSIONS, SESSION_SERVING_CAP, nextDateForWeekday, isTooCloseToExistingSessions } from '@/lib/schedule';

const PREP_TIMES = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

// Lets a cook pick which scheduled session a pot belongs to, or set one up
// right here — no separate screen — since most cooks won't have one yet
// the first time they post a dish. Styled as its own orange card (like the
// old "Join the Pot" design) so it reads as a distinct, required step —
// session and listing are separate concepts, but a listing can't publish
// without one.
function SessionPicker({ sessions, selectedId, onSelect, editId, onSessionCreated }: {
  sessions: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  editId?: string;
  onSessionCreated: (id: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(sessions.length === 0);
  const [day, setDay] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const canAddMore = sessions.length < MAX_SESSIONS;

  const handleCreate = async () => {
    if (day === null || !time) {
      Alert.alert('Incomplete', 'Pick a day and time for your host day.');
      return;
    }
    const candidateDate = nextDateForWeekday(day);
    if (isTooCloseToExistingSessions(candidateDate, sessions)) {
      Alert.alert('Too Close', `Cooking sessions need at least ${MIN_GAP_DAYS} full days between them.`);
      return;
    }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      const { data, error } = await supabase
        .from('cook_sessions')
        .insert({
          cook_id: user.id,
          session_date: candidateDate.toISOString().split('T')[0],
          start_time: `${time}:00`,
        })
        .select()
        .single();
      if (error) throw error;
      setShowAdd(false);
      setDay(null);
      setTime(null);
      onSessionCreated(data.id);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View className="bg-clay-primary rounded-3xl p-5">
      <View className="flex-row items-center gap-2 mb-1">
        <View className="w-8 h-8 rounded-full items-center justify-center bg-surface/20">
          <Calendar size={16} color="white" />
        </View>
        <Text className="text-base font-bold font-sans-bold text-white">Host Day</Text>
      </View>
      <Text className="text-xs text-white/80 font-sans leading-relaxed mb-4">
        Each host day is one dish, fixed at {SESSION_SERVING_CAP} portions — the host day is when you're cooking, the dish is what you're serving. Every dish needs one attached before it can go live.
      </Text>

      {showAdd ? (
        <View>
          {sessions.length === 0 && (
            <Text className="text-xs text-white/70 font-sans mb-3">No host days set up yet — add one right here.</Text>
          )}
          <View className="flex-row flex-wrap gap-2 mb-3">
            {DAYS.map((d) => (
              <TouchableOpacity
                key={d.value}
                onPress={() => setDay(d.value)}
                className={`px-3 py-1.5 rounded-lg border ${day === d.value ? 'bg-surface border-white' : 'bg-surface/10 border-white/20'}`}
              >
                <Text className={`text-xs font-bold ${day === d.value ? 'text-clay-primary' : 'text-white/80'}`}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {TIME_PRESETS.map((t) => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setTime(t.value)}
                className={`px-3 py-1.5 rounded-lg border ${time === t.value ? 'bg-surface border-white' : 'bg-surface/10 border-white/20'}`}
              >
                <Text className={`text-xs font-bold ${time === t.value ? 'text-clay-primary' : 'text-white/80'}`}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleCreate}
              disabled={creating}
              className={`flex-1 py-2.5 rounded-xl items-center ${creating ? 'bg-surface/40' : 'bg-surface'}`}
            >
              {creating ? <ActivityIndicator color="#BF592B" size="small" /> : (
                <Text className="text-clay-primary text-xs font-bold font-sans-bold">Create Session</Text>
              )}
            </TouchableOpacity>
            {sessions.length > 0 && (
              <TouchableOpacity
                onPress={() => { setShowAdd(false); setDay(null); setTime(null); }}
                className="px-4 py-2.5 rounded-xl border border-white/30 items-center"
              >
                <Text className="text-white text-xs font-bold font-sans-bold">Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {sessions.map((s: any) => {
            const hasOtherDish = (s.listings || []).some((l: any) => l.id !== editId);
            const isSelected = selectedId === s.id;
            const isDisabled = hasOtherDish && !isSelected;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => !isDisabled && onSelect(s.id)}
                disabled={isDisabled}
                className={`px-4 py-2 rounded-xl border ${isSelected ? 'bg-surface border-white' : isDisabled ? 'bg-surface/5 border-white/10' : 'bg-surface/10 border-white/20'}`}
              >
                <Text className={`text-xs font-bold ${isSelected ? 'text-clay-primary' : isDisabled ? 'text-white/40' : 'text-white/80'}`}>
                  {format(parseISO(s.session_date), 'EEE, MMM d')} · {format(new Date(`2000-01-01T${s.start_time}`), 'h:mm a')} · {hasOtherDish ? 'Assigned' : 'Open'}
                </Text>
              </TouchableOpacity>
            );
          })}
          {canAddMore && (
            <TouchableOpacity onPress={() => setShowAdd(true)} className="px-3 py-2 rounded-xl border border-dashed border-white/40 flex-row items-center gap-1">
              <Plus size={12} color="white" />
              <Text className="text-xs font-bold text-white">New</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}



export default function CookScreen() {
  const router = useRouter();
  const { isCookMode } = useAppStore();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { edit_id } = useLocalSearchParams();

  // -- COOK MODE STATE --
  const [mealName, setMealName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [prepTime, setPrepTime] = useState(30);
  const [isAvailable, setIsAvailable] = useState(true);
  const [pickupAvailable, setPickupAvailable] = useState(true);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [imagesBase64, setImagesBase64] = useState<string[]>([]);

  // Load existing data if edit_id is provided
  useEffect(() => {
    if (edit_id) {
      const fetchListing = async () => {
        const { data, error } = await supabase.from('listings').select('*').eq('id', edit_id).single();
        if (data && !error) {
          setMealName(data.title || '');
          setDescription(data.description || '');
          setPrice(data.price?.toString() || '');
          setPrepTime(data.prep_time_minutes || 30);
          setIsAvailable(data.available !== false);
          setPickupAvailable(data.pickup_available !== false);
          setDeliveryAvailable(data.delivery_available === true);
          setSelectedSessionId(data.session_id || null);
          const cats = data.category ? data.category.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          setSelectedCategories(cats);
          setImage(data.image || null);
          const imgList = data.image ? data.image.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          setImages(imgList);
          setImagesBase64(new Array(imgList.length).fill(''));
          setLocationLat(data.latitude || null);
          setLocationLng(data.longitude || null);
          setLocationText(data.location_text || '');
        }
      };
      fetchListing();
    }
  }, [edit_id]);

  // -- CATEGORY STATE --
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isCategoryVisible, setIsCategoryVisible] = useState(false);

  const [loading, setLoading] = useState(false);

  // -- LOCATION STATE --
  const [locationText, setLocationText] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationFetching, setLocationFetching] = useState(false);

  // -- EATER SAVED/FAVORITES STATE (must be here — Rules of Hooks) --
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedListings, setSavedListings] = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  // Load favorites on mount
  useEffect(() => {
    let active = true;
    const loadFavorites = async () => {
      setSavedLoading(true);
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
  }, []);

  const useCurrentLocation = async () => {
    setLocationFetching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Allow location access to use this feature.');
        setLocationFetching(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationLat(loc.coords.latitude);
      setLocationLng(loc.coords.longitude);
      // Reverse geocode to get a human-readable address
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geo) {
        const parts = [geo.district || geo.subregion, geo.city || geo.region].filter(Boolean);
        setLocationText(parts.join(', '));
      }
    } catch (e) {
      Alert.alert('Error', 'Could not get location. Please type it manually.');
    }
    setLocationFetching(false);
  };

  const CATEGORIES = [
    'Rice Dishes', 'Soups & Stews', 'Grills & Kebabs', 'Traditional Snacks', 'Seafood', 'Pastries', 'Vegan', 'Vegetarian'
  ];

  const pickImage = async () => {
    if (images.length >= 4) {
      Alert.alert('Limit Reached', 'You can select up to 4 images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
      setImagesBase64([...imagesBase64, result.assets[0].base64 || '']);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImagesBase64(imagesBase64.filter((_, i) => i !== index));
  };

  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const uploadImages = async (userId: string) => {
    const uploadedUrls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img.startsWith('http://') || img.startsWith('https://')) {
        uploadedUrls.push(img);
      } else {
        const b64 = imagesBase64[i];
        if (b64) {
          const filePath = `${userId}/${Date.now()}_${i}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('listing-images')
            .upload(filePath, decode(b64), {
              contentType: 'image/jpeg'
            });
          if (uploadError) {
            console.error('Image upload error:', uploadError);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('listing-images')
              .getPublicUrl(filePath);
            uploadedUrls.push(publicUrl);
          }
        }
      }
    }
    return uploadedUrls.join(',');
  };

    const handlePublish = async () => {
      if (!mealName || !price) {
        Alert.alert('Incomplete Form', 'Please give your dish a name and set a price.');
        return;
      }

      if (!locationLat || !locationLng) {
        Alert.alert(
          'Location Required 📍',
          'Please set your location so customers can find you on the map. Tap "Use My Location" or type your address.',
        );
        return;
      }

    const numPrice = parseFloat(price);
    const numPortions = SESSION_SERVING_CAP;
    if (isNaN(numPrice) || numPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }
    if (!selectedSessionId) {
      Alert.alert('Host Day Required', 'Every dish needs a host day attached before it can go live. Pick or create one below.');
      return;
    }
    const selectedSession = upcomingSessions.find((s: any) => s.id === selectedSessionId);
    if (selectedSession) {
      const otherDishes = (selectedSession.listings || []).filter((l: any) => l.id !== edit_id);
      if (otherDishes.length > 0) {
        Alert.alert('Host Day Already Has a Dish', 'Each host day is one dish only. Pick a different host day or edit the dish already assigned to this one.');
        return;
      }
    }
    const orderDeadlineISO = selectedSession
      ? new Date(`${selectedSession.session_date}T${selectedSession.start_time}`).toISOString()
      : null;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const imageUrls = await uploadImages(user.id);

      // Create or Update Listing
      const listingData: any = {
        cook_id: user.id,
        title: mealName,
        description: description,
        price: numPrice,
        portions_available: numPortions,
        prep_time_minutes: prepTime,
        available: isAvailable,
        pickup_available: pickupAvailable,
        delivery_available: deliveryAvailable,
        session_id: selectedSessionId,
        order_deadline: orderDeadlineISO,
        category: selectedCategories.length > 0 ? selectedCategories.join(', ') : 'Custom',
        location_text: locationText || null,
        latitude: locationLat,
        longitude: locationLng,
        image: imageUrls || null
      };

      let listingError;

      if (edit_id) {
        const { error } = await supabase
          .from('listings')
          .update(listingData)
          .eq('id', edit_id)
          .select()
          .single();
        listingError = error;
      } else {
        const { error } = await supabase
          .from('listings')
          .insert(listingData)
          .select()
          .single();
        listingError = error;
      }

      if (listingError) throw listingError;

      Alert.alert('Success! 🎉', edit_id ? 'Your dish has been updated.' : 'Your dish is now live on the marketplace.');

      // Reset form
      setMealName('');
      setDescription('');
      setPrice('');
      setImage(null);
      setImageBase64(null);
      setImages([]);
      setImagesBase64([]);
      setSelectedCategories([]);
      setSelectedSessionId(null);

      queryClient.invalidateQueries({ queryKey: ['my-menu', user.id] });
      queryClient.invalidateQueries({ queryKey: ['explore-feed'] });
      queryClient.invalidateQueries({ queryKey: ['listing', edit_id] });
      queryClient.invalidateQueries({ queryKey: ['cook-meals', user.id] });
      
      if (edit_id) {
        router.back();
      } else {
        router.push('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Check if user is an approved cook
  const { data: cookProfile, isLoading: isCookProfileLoading } = useQuery({
    queryKey: ['cook-approval-check'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('role, cook_application_status')
        .eq('id', user.id)
        .single();
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const isApprovedCook = cookProfile?.role === 'COOK' && cookProfile?.cook_application_status === 'approved';

  // Upcoming cooking sessions this listing can attach to (drives the countdown + deadline)
  const { data: upcomingSessions = [] } = useQuery({
    queryKey: ['cook-upcoming-sessions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('cook_sessions')
        .select('*, listings(id, portions_available)')
        .eq('cook_id', user.id)
        .gte('session_date', new Date().toISOString().split('T')[0])
        .order('session_date', { ascending: true });
      if (error) {
        console.error('Error fetching upcoming sessions:', error);
        return [];
      }
      return data || [];
    },
    enabled: isApprovedCook,
  });

  // Default a new dish onto the cook's soonest open (dish-free) upcoming
  // session instead of leaving it on "No session".
  useEffect(() => {
    if (!edit_id && selectedSessionId === null) {
      const openSession = upcomingSessions.find((s: any) => !(s.listings || []).length);
      if (openSession) setSelectedSessionId(openSession.id);
    }
  }, [edit_id, upcomingSessions]);

  const handleSessionCreated = (newSessionId: string) => {
    setSelectedSessionId(newSessionId);
    queryClient.invalidateQueries({ queryKey: ['cook-upcoming-sessions'] });
  };

  // ----------------------
  // RENDER: COOK MODE (Post a Meal)
  // ----------------------
  if (isCookMode) {
    if (isCookProfileLoading) {
        return (
            <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
                <View className="flex-1 bg-warm-cream items-center justify-center">
                    <ActivityIndicator size="large" color="#D65A31" />
                </View>
            </SafeAreaView>
        );
    }

    // LOCKED: Not an approved cook
    if (!isApprovedCook) {
      return (
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
          <View className="flex-1 bg-warm-cream items-center justify-center px-8">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-6">
              <Lock size={36} color="#9CA3AF" />
            </View>
            <Text className="text-2xl font-bold text-text-main text-center mb-3 font-sans-bold">
              Kitchen Locked
            </Text>
            <Text className="text-text-sub text-center text-base font-sans mb-8 leading-relaxed">
              You need to apply and get approved as a host before you can post meals. Complete the application to unlock your kitchen.
            </Text>
            {cookProfile?.cook_application_status === 'pending' ? (
              <View className="bg-orange-50 rounded-2xl px-6 py-4 border border-orange-100 w-full items-center">
                <Text className="text-clay-primary font-bold text-base font-sans-bold">⏳ Application Under Review</Text>
                <Text className="text-text-sub text-sm font-sans mt-1 text-center">We'll notify you once approved</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => router.push('/onboarding/apply-to-cook')}
                className="bg-clay-primary rounded-2xl px-8 py-4 flex-row items-center gap-3 w-full justify-center"
                style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
              >
                <UtensilsCrossed size={20} color="white" />
                <Text className="text-white font-bold text-lg font-sans-bold">Apply to Host</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      );
    }

    if (edit_id) {
      return (
        <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
          <View className="flex-1 bg-surface">
            {/* Header */}
            <View className="px-4 pb-4 bg-[#FFF8F6] border-b border-[#F2DFD7] flex-row justify-between items-center" style={{ paddingTop: insets.top + 16 }}>
              <TouchableOpacity onPress={() => router.back()} className="p-2">
                <X size={24} color="#84523C" />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-[#84523C] text-center flex-1 mr-8" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                Edit Your Dish
              </Text>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
              <ScrollView 
                className="flex-1 p-6 bg-[#FCFBFA]" 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60 }}
              >
                {/* Photo Section */}
                {images.length === 0 ? (
                  <TouchableOpacity
                    onPress={pickImage}
                    activeOpacity={0.9}
                    className="bg-gray-100 rounded-3xl h-60 items-center justify-center mb-6 overflow-hidden relative border-2 border-dashed border-gray-200"
                  >
                    <Camera size={32} color="#9CA3AF" />
                    <Text className="text-text-sub mt-2 font-sans font-medium text-center px-4">
                      Tap to choose photos of your dish (up to 4)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View className="mb-6 h-60">
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 12, paddingRight: 20 }}
                    >
                      {images.map((img, idx) => (
                        <View key={idx} className="w-48 h-full rounded-3xl overflow-hidden relative bg-gray-100">
                          <Image source={{ uri: img }} className="w-full h-full" resizeMode="cover" />
                          <TouchableOpacity
                            onPress={() => removeImage(idx)}
                            className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full items-center justify-center"
                          >
                            <X size={16} color="white" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {images.length < 4 && (
                        <TouchableOpacity
                          onPress={pickImage}
                          activeOpacity={0.8}
                          className="w-48 h-full bg-gray-50 rounded-3xl items-center justify-center border-2 border-dashed border-gray-200"
                        >
                          <Plus size={24} color="#BF592B" />
                          <Text className="text-text-sub mt-2 font-sans font-medium text-center px-2 text-xs">
                            Add Photo ({images.length}/4)
                          </Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* Food Category (Select up to 2) */}
                <View className="mb-6">
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#231915', marginBottom: 10 }}>
                    Food Category (Select up to 2)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                  >
                    {CATEGORIES.map((cat) => {
                      const IconComponent = CATEGORY_ICONS[cat];
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedCategories(selectedCategories.filter(c => c !== cat));
                            } else {
                              if (selectedCategories.length < 2) {
                                setSelectedCategories([...selectedCategories, cat]);
                              } else {
                                Alert.alert('Category Limit', 'You can select up to 2 categories.');
                              }
                            }
                          }}
                          style={{
                            backgroundColor: isSelected ? '#BF592B' : '#FFF1EC',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 9999,
                            borderWidth: 1,
                            borderColor: isSelected ? '#BF592B' : '#DDC1B6',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6
                          }}
                          activeOpacity={0.8}
                        >
                          {IconComponent && (
                            <IconComponent size={14} color={isSelected ? 'white' : '#BF592B'} />
                          )}
                          <Text style={{
                            fontFamily: isSelected ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium',
                            fontSize: 13,
                            color: isSelected ? 'white' : '#56423B',
                          }}>{cat}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Dish Name */}
                <View className="mb-5">
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#8A7269', marginBottom: 8 }}>Dish Name</Text>
                  <TextInput
                    placeholder="Tomtom Suya"
                    placeholderTextColor="#9CA3AF"
                    className="bg-surface rounded-2xl px-4 py-3 text-text-main font-sans text-base border border-[#F2DFD7]"
                    value={mealName}
                    onChangeText={setMealName}
                  />
                </View>

                {/* Food Category Selector in form */}
                <View className="mb-5">
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#8A7269', marginBottom: 8 }}>Food Category</Text>
                  <View className="flex-row flex-wrap gap-2 items-center">
                    {/* Selected Categories */}
                    {selectedCategories.map((cat) => {
                      const IconComponent = CATEGORY_ICONS[cat];
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setSelectedCategories(selectedCategories.filter(c => c !== cat))}
                          style={{
                            backgroundColor: '#BF592B',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 9999,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6
                          }}
                          activeOpacity={0.8}
                        >
                          {IconComponent && <IconComponent size={14} color="white" />}
                          <Text style={{
                            fontFamily: 'PlusJakartaSans_600SemiBold',
                            fontSize: 13,
                            color: 'white',
                          }}>{cat}</Text>
                        </TouchableOpacity>
                      );
                    })}

                    {/* Unselected categories (suggestions) to match layout of mockup */}
                    {CATEGORIES.filter(cat => !selectedCategories.includes(cat)).slice(0, 2).map((cat) => {
                      const IconComponent = CATEGORY_ICONS[cat];
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => {
                            if (selectedCategories.length < 2) {
                              setSelectedCategories([...selectedCategories, cat]);
                            } else {
                              Alert.alert('Category Limit', 'You can select up to 2 categories.');
                            }
                          }}
                          style={{
                            backgroundColor: '#FFF1EC',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 9999,
                            borderWidth: 1,
                            borderColor: '#F2DFD7',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6
                          }}
                          activeOpacity={0.8}
                        >
                          {IconComponent && <IconComponent size={14} color="#BF592B" />}
                          <Text style={{
                            fontFamily: 'PlusJakartaSans_500Medium',
                            fontSize: 13,
                            color: '#56423B',
                          }}>{cat}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    
                    {/* Add button */}
                    <TouchableOpacity
                      onPress={() => setIsCategoryVisible(true)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: '#BF592B',
                        borderStyle: 'dashed',
                        backgroundColor: '#FFF1EC',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      activeOpacity={0.8}
                    >
                      <Plus size={16} color="#BF592B" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Description */}
                <View className="mb-5">
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#8A7269', marginBottom: 8 }}>Description</Text>
                  <View className="bg-[#FFF8F6] border border-[#F2DFD7] rounded-2xl p-2">
                    <TextInput
                      placeholder="Spiced beef skewers..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={4}
                      className="text-text-main font-sans text-base min-h-[100px] p-2"
                      textAlignVertical="top"
                      value={description}
                      onChangeText={setDescription}
                    />
                  </View>
                </View>

                {/* Portions & Price Row */}
                <View className="flex-row gap-4 mb-5">
                  {/* Portions — fixed, one dish per cook day */}
                  <View className="flex-1 bg-surface border border-[#F2DFD7] rounded-3xl p-4 justify-between">
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#8A7269', marginBottom: 8 }}>Portions (fixed)</Text>
                    <View className="flex-row items-center justify-center">
                      <Users size={16} color="#D65A31" />
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#231915', marginLeft: 8 }}>{SESSION_SERVING_CAP}</Text>
                    </View>
                  </View>

                  {/* Price */}
                  <View className="flex-1 bg-surface border border-[#F2DFD7] rounded-3xl p-4 justify-between">
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#8A7269', marginBottom: 8 }}>Price (GHS)</Text>
                    <View className="flex-row items-center">
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#BF592B', marginRight: 8 }}>₵</Text>
                      <TextInput
                        keyboardType="numeric"
                        style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#231915', flex: 1, padding: 0 }}
                        value={price}
                        onChangeText={setPrice}
                      />
                    </View>
                  </View>
                </View>

                {/* Ready in (minutes) */}
                <View className="mb-6">
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#8A7269', marginBottom: 8 }}>Ready in (minutes)</Text>
                  <View className="flex-row gap-3">
                    {[15, 30, 45, 60].map((time) => (
                      <TouchableOpacity
                        key={time}
                        onPress={() => setPrepTime(time)}
                        className={`flex-1 py-2.5 rounded-xl border items-center ${prepTime === time ? 'bg-[#BF592B] border-[#BF592B]' : 'bg-surface border-[#F2DFD7]'}`}
                      >
                        <Text className={`text-xs font-bold ${prepTime === time ? 'text-white' : 'text-text-sub'}`}>{time}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Available for Sessions Toggle Card */}
                <View className="bg-[#FFF1EC] rounded-2xl p-4 flex-row items-center justify-between mb-4 border border-[#F2DFD7]">
                  <View className="flex-row items-center gap-3 flex-1 mr-4">
                    <View className="w-10 h-10 bg-surface rounded-xl items-center justify-center border border-[#F2DFD7]">
                      <Calendar size={20} color="#BF592B" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#231915' }}>Available for Sessions</Text>
                      <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#8A7269', marginTop: 1 }}>Visible to customers in active windows</Text>
                    </View>
                  </View>
                  <Switch
                    value={isAvailable}
                    onValueChange={setIsAvailable}
                    trackColor={{ false: '#F2DFD7', true: '#E9D6CF' }}
                    thumbColor={isAvailable ? '#BF592B' : '#83746E'}
                    ios_backgroundColor="#F2DFD7"
                  />
                </View>

                {/* Which cooking session this dish belongs to */}
                <View className="mb-6">
                  <SessionPicker
                    sessions={upcomingSessions}
                    selectedId={selectedSessionId}
                    onSelect={setSelectedSessionId}
                    onSessionCreated={handleSessionCreated}
                    editId={edit_id as string}
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handlePublish}
                  disabled={loading}
                  className={`bg-[#BF592B] py-4 rounded-2xl flex-row items-center justify-center gap-3 ${loading ? 'opacity-70' : ''}`}
                  style={{ shadowColor: '#BF592B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Save size={20} color="white" />
                      <Text className="text-white font-bold text-lg font-sans-bold">Update Dish</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>

            {/* CATEGORY SELECTOR MODAL FOR EDIT FLOW */}
            <Modal visible={isCategoryVisible} animationType="slide" transparent={false}>
              <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
                <View className="px-4 pt-8 pb-4 border-b border-gray-100 flex-row items-center gap-3">
                  <TouchableOpacity 
                    onPress={() => setIsCategoryVisible(false)} 
                    className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center active:bg-gray-200"
                  >
                    <ArrowLeft size={22} color="#1A1A1A" />
                  </TouchableOpacity>
                  <Text className="text-xl font-bold font-sans-bold text-text-main text-center flex-1">Food Category</Text>
                  <View className="w-10 h-10" />
                </View>
                <ScrollView className="flex-1 p-6">
                  <View className="gap-3">
                    {CATEGORIES.map((cat: string) => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedCategories(selectedCategories.filter(c => c !== cat));
                            } else {
                              if (selectedCategories.length < 2) {
                                setSelectedCategories([...selectedCategories, cat]);
                              } else {
                                Alert.alert('Category Limit', 'You can select up to 2 categories.');
                              }
                            }
                            setIsCategoryVisible(false);
                          }}
                          className="w-full bg-surface rounded-2xl border border-gray-100 p-4 flex-row items-center justify-between shadow-sm active:bg-clay-primary/5"
                        >
                          <Text className={`font-bold text-lg font-sans-bold ${isSelected ? 'text-[#BF592B]' : 'text-text-main'}`}>{cat}</Text>
                          <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                            {isSelected ? <Check size={20} color="#BF592B" /> : <ChevronRight size={20} color="#9CA3AF" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </SafeAreaView>
            </Modal>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView className="flex-1 bg-warm-cream" edges={['bottom']}>
        <View className="flex-1 bg-warm-cream">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="px-6 pb-4 bg-warm-cream border-b border-[#DDC1B6]/30 flex-row justify-between items-center" style={{ paddingTop: insets.top + 48, zIndex: 10 }}>
            <View>
              <Text className="text-2xl font-bold text-text-main font-sans-bold">{edit_id ? 'Edit Your Dish' : 'Post a New Dish'}</Text>
              <Text className="text-text-sub text-sm font-sans">{edit_id ? 'Update the details for your listing' : 'Share your culinary creation with the community'}</Text>
              <TouchableOpacity onPress={() => router.push('/cook-schedule')} className="flex-row items-center gap-1 mt-1.5">
                <Calendar size={12} color="#BF592B" />
                <Text className="text-clay-primary text-xs font-bold font-sans-bold">Manage Weekly Schedule</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => router.back()}
              className="px-4 py-2 bg-surface rounded-full flex-row items-center gap-2 active:bg-gray-100 border border-[#DDC1B6]/50"
            >
              <ArrowLeft size={20} color="#1A1A1A" />
              <Text className="text-sm font-bold text-text-main font-sans-bold">Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            className="flex-1 p-6" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60 }}
          >

            {/* Dish Info — everything about this pot lives in one place */}
            <View
              className="bg-surface rounded-3xl p-5 mb-20 border border-[#DDC1B6]"
              style={{ shadowColor: '#9C3F12', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 20, elevation: 2 }}
            >
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 bg-clay-primary/10 rounded-full items-center justify-center">
                  <UtensilsCrossed size={16} color="#D65A31" />
                </View>
                <Text className="text-base font-bold text-text-main font-sans-bold">Dish Info</Text>
              </View>

              {/* Photo Upload */}
              {images.length === 0 ? (
                <TouchableOpacity
                  onPress={pickImage}
                  className="bg-[#FEEAE2] rounded-2xl h-60 items-center justify-center mb-6 border-2 border-dashed border-[#DDC1B6] overflow-hidden"
                >
                  <Camera size={32} color="#BF592B" />
                  <Text className="text-text-sub mt-2 font-sans font-medium text-center px-4">Tap to take or choose photos of your dish (up to 4)</Text>
                </TouchableOpacity>
              ) : (
                <View className="mb-6 h-60">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingRight: 20 }}
                  >
                    {images.map((img, idx) => (
                      <View key={idx} className="w-48 h-full rounded-2xl overflow-hidden relative bg-gray-100">
                        <Image source={{ uri: img }} className="w-full h-full" />
                        <TouchableOpacity
                          onPress={() => removeImage(idx)}
                          className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full items-center justify-center"
                        >
                          <X size={16} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {images.length < 4 && (
                      <TouchableOpacity
                        onPress={pickImage}
                        activeOpacity={0.8}
                        className="w-48 h-full bg-[#FEEAE2] rounded-2xl items-center justify-center border-2 border-dashed border-[#DDC1B6]"
                      >
                        <Plus size={24} color="#BF592B" />
                        <Text className="text-text-sub mt-2 font-sans font-medium text-center px-2 text-xs">
                          Add Photo ({images.length}/4)
                        </Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Category Selection */}
              <View className="mb-4">
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#231915', marginBottom: 8 }}>
                  Food Category (Select up to 2)
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                >
                  {CATEGORIES.map((cat) => {
                    const IconComponent = CATEGORY_ICONS[cat];
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedCategories(selectedCategories.filter(c => c !== cat));
                          } else {
                            if (selectedCategories.length < 2) {
                              setSelectedCategories([...selectedCategories, cat]);
                            } else {
                              Alert.alert('Category Limit', 'You can select up to 2 categories for your dish.');
                            }
                          }
                        }}
                        style={{
                          backgroundColor: isSelected ? '#BF592B' : '#FFF1EC',
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 9999,
                          borderWidth: 1,
                          borderColor: isSelected ? '#BF592B' : '#DDC1B6',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6
                        }}
                        activeOpacity={0.8}
                      >
                        {IconComponent && (
                          <IconComponent size={14} color={isSelected ? 'white' : '#BF592B'} />
                        )}
                        <Text style={{
                          fontFamily: isSelected ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium',
                          fontSize: 13,
                          color: isSelected ? 'white' : '#56423B',
                        }}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Custom Listing Title */}
              <TextInput
                placeholder="Custom Listing Title (e.g. Grandma's Style)"
                placeholderTextColor="#8A7269"
                className="bg-[#FFF1EC] border border-[#DDC1B6] rounded-xl px-4 py-3 text-text-main font-sans text-base mb-4 italic"
                value={mealName}
                onChangeText={setMealName}
              />

              {/* Description */}
              <TextInput
                placeholder="Tell users why your version is special..."
                placeholderTextColor="#8A7269"
                multiline
                numberOfLines={3}
                className="bg-[#FFF1EC] border border-[#DDC1B6] rounded-xl px-4 py-3 text-text-main font-sans text-base min-h-[80px]"
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />

              {/* Location */}
              <View className="mt-4">
                <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase tracking-widest px-1">Pickup / Host Location</Text>
                <View className="flex-row gap-2 mb-2">
                  <TextInput
                    placeholder="e.g. East Legon, Accra"
                    placeholderTextColor="#8A7269"
                    className="flex-1 bg-[#FFF1EC] rounded-xl px-4 py-3 text-text-main font-sans text-base border border-[#DDC1B6]"
                    value={locationText}
                    onChangeText={setLocationText}
                  />
                  <TouchableOpacity
                    onPress={useCurrentLocation}
                    disabled={locationFetching}
                    className="bg-[#F8E4DD] rounded-xl px-3 items-center justify-center border border-[#DDC1B6]"
                  >
                    {locationFetching
                      ? <ActivityIndicator size="small" color="#D65A31" />
                      : <Navigation size={20} color="#D65A31" />
                    }
                  </TouchableOpacity>
                </View>
                {locationLat ? (
                  <View className="flex-row items-center gap-1.5">
                    <MapPin size={12} color="#22c55e" />
                    <Text className="text-xs text-green-600 font-sans">GPS location captured ✓</Text>
                  </View>
                ) : null}
              </View>

              <View className="h-[1px] bg-[#DDC1B6]/40 my-5" />
              <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase tracking-widest px-1">Meal Details</Text>
              <Text className="text-xs text-text-sub font-sans leading-relaxed mb-4 px-1">
                Each host day is one dish, fixed at {SESSION_SERVING_CAP} portions — that's your whole serving pool for that day.
              </Text>

              <View className="flex-row gap-4 mb-5">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase tracking-widest px-1">Portions (fixed)</Text>
                  <View className="bg-[#FFF1EC] border border-[#DDC1B6] rounded-xl px-4 py-3 flex-row items-center gap-2">
                    <Users size={16} color="#D65A31" />
                    <Text className="flex-1 text-text-main font-bold">{SESSION_SERVING_CAP}</Text>
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase tracking-widest px-1">Price (₵)</Text>
                  <View className="bg-[#FFF1EC] border border-[#DDC1B6] rounded-xl px-4 py-3 flex-row items-center gap-2">
                    <Text className="text-clay-primary font-bold">₵</Text>
                    <TextInput
                      placeholder="45.00"
                      keyboardType="numeric"
                      className="flex-1 text-text-main font-bold"
                      value={price}
                      onChangeText={setPrice}
                    />
                  </View>
                </View>
              </View>

              <Text className="text-[10px] font-bold text-text-sub mb-3 uppercase tracking-widest px-1">Ready in (Cooking Time)</Text>
              <View className="flex-row justify-between">
                {PREP_TIMES.map((time) => (
                  <TouchableOpacity
                    key={time.value}
                    onPress={() => setPrepTime(time.value)}
                    className={`px-4 py-2 rounded-xl border ${prepTime === time.value ? 'bg-clay-primary border-clay-primary' : 'bg-surface border-[#DDC1B6]'}`}
                  >
                    <Text className={`text-xs font-bold ${prepTime === time.value ? 'text-white' : 'text-text-sub'}`}>{time.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="h-[1px] bg-[#DDC1B6]/40 my-5" />
              <View className="flex-row justify-between items-center px-1 mb-5">
                <View className="flex-row items-center gap-3">
                  <View className="bg-[#F8E4DD] p-2 rounded-lg">
                    <Check size={16} color="#D65A31" />
                  </View>
                  <Text className="text-sm font-bold text-text-main font-sans-bold">Available for Sessions</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsAvailable(!isAvailable)}
                  className={`w-12 h-6 rounded-full px-1 justify-center ${isAvailable ? 'bg-clay-primary' : 'bg-gray-200'}`}
                >
                  <View className={`w-4 h-4 rounded-full bg-surface transform ${isAvailable ? 'translate-x-6' : 'translate-x-0'}`} />
                </TouchableOpacity>
              </View>

              <View className="h-[1px] bg-[#DDC1B6]/40 my-5" />
              <SessionPicker
                sessions={upcomingSessions}
                selectedId={selectedSessionId}
                onSelect={setSelectedSessionId}
                onSessionCreated={handleSessionCreated}
                editId={edit_id as string}
              />
            </View>

            {/* Spacer */}
            <View className="h-10" />

            {/* Action Button inside ScrollView for Keyboard Awareness */}
            <View className="mb-10">
              <TouchableOpacity
                onPress={handlePublish}
                disabled={loading}
                className={`bg-clay-primary py-4 rounded-2xl flex-row items-center justify-center gap-3 ${loading ? 'opacity-70' : ''}`}
                style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Plus size={20} color="white" />
                    <Text className="text-white font-bold text-lg font-sans-bold">
                      {edit_id ? 'Update Dish' : 'Publish Listing'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* CATEGORY MODAL */}
          <Modal visible={isCategoryVisible} animationType="slide" transparent={false}>
            <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
              <View className="px-4 pt-8 pb-4 border-b border-gray-100 flex-row items-center gap-3">
                <TouchableOpacity 
                  onPress={() => setIsCategoryVisible(false)} 
                  className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center active:bg-gray-200"
                >
                  <ArrowLeft size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text className="text-xl font-bold font-sans-bold text-text-main text-center flex-1">Food Category</Text>
                <View className="w-10 h-10" />
              </View>
              <ScrollView className="flex-1 p-6">
                <View className="gap-3">
                  {CATEGORIES.map((cat: string) => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedCategories(selectedCategories.filter(c => c !== cat));
                          } else {
                            if (selectedCategories.length < 2) {
                              setSelectedCategories([...selectedCategories, cat]);
                            } else {
                              Alert.alert('Category Limit', 'You can select up to 2 categories.');
                            }
                          }
                          setIsCategoryVisible(false);
                        }}
                        className="w-full bg-surface rounded-2xl border border-gray-100 p-4 flex-row items-center justify-between shadow-sm active:bg-clay-primary/5"
                      >
                        <Text className={`font-bold text-lg font-sans-bold ${isSelected ? 'text-[#BF592B]' : 'text-text-main'}`}>{cat}</Text>
                        <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                          {isSelected ? <Check size={20} color="#BF592B" /> : <ChevronRight size={20} color="#9CA3AF" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </SafeAreaView>
          </Modal>

        </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    );
  }

  // ----------------------
  // RENDER: EATER MODE (Saved & Favorites)
  // ----------------------

  return (
    <SafeAreaView className="flex-1 bg-warm-cream" edges={['bottom']}>
      <View className="flex-1 bg-warm-cream">
      <View className="px-6 pb-4 bg-surface border-b border-gray-100" style={{ paddingTop: insets.top + 48, shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 10, zIndex: 10 }}>
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

      <ProcessLoader 
        visible={loading} 
        message={edit_id ? "Saving Changes..." : "Creating Dish..."}
      />
    </SafeAreaView>
  );
}

