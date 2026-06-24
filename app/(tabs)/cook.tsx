import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, KeyboardAvoidingView, Platform, Modal, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { UtensilsCrossed, Clock, Users, Camera, ChevronRight, Heart, ShoppingBag, ArrowRight, Store, Truck, Calendar, Info, Star, Plus, Check, Search, X, ArrowLeft, MapPin, Navigation, Lock, Wheat, Soup, Flame, Apple, Fish, Cake, Leaf, Sprout, Minus, Utensils, Save } from 'lucide-react-native';

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

const PAST_ORDERS = [
  { id: '101', name: 'Waakye with Wele', date: 'Yesterday', price: 35 },
  { id: '102', name: 'Fried Yam & Titus', date: 'Last Week', price: 25 },
];

const PREP_TIMES = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];



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
  const [portions, setPortions] = useState('10');
  const [prepTime, setPrepTime] = useState(30);
  const [isAvailable, setIsAvailable] = useState(true);
  const [supportsSessions, setSupportsSessions] = useState(true); // Default to true now
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
          setPortions(data.portions_available?.toString() || '10');
          setPrepTime(data.prep_time_minutes || 30);
          setIsAvailable(data.available !== false);
          setSupportsSessions(data.supports_sessions || false);
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

  // -- SESSION STATE --
  const [sessionPrice, setSessionPrice] = useState('');
  const [totalSlots, setTotalSlots] = useState('20');
  const [minSlots, setMinSlots] = useState('5');
  const [maxPerUser, setMaxPerUser] = useState('5');
  const [sessionNote, setSessionNote] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);

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
      const finalPrice = price || sessionPrice;
      if (!mealName || !finalPrice) {
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

    const numPrice = parseFloat(finalPrice);
    const numPortions = parseInt(portions, 10);
    if (isNaN(numPrice) || numPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }
    if (isNaN(numPortions) || numPortions <= 0) {
      Alert.alert('Invalid Portions', 'Please enter a valid number of portions.');
      return;
    }
    if (supportsSessions) {
      const numTotal = parseInt(totalSlots, 10);
      const numMin = parseInt(minSlots, 10);
      if (isNaN(numTotal) || numTotal <= 0 || isNaN(numMin) || numMin <= 0) {
        Alert.alert('Invalid Session Details', 'Please enter valid plate and minimum numbers.');
        return;
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const imageUrls = await uploadImages(user.id);

      // 1. Create or Update Listing
      const listingData: any = {
        cook_id: user.id,
        title: mealName,
        description: description,
        price: numPrice,
        portions_available: numPortions,
        prep_time_minutes: prepTime,
        available: isAvailable,
        supports_sessions: supportsSessions,
        category: selectedCategories.length > 0 ? selectedCategories.join(', ') : 'Custom',
        location_text: locationText || null,
        latitude: locationLat,
        longitude: locationLng,
        image: imageUrls || null
      };

      let listingError, listing;

      if (edit_id) {
        const { data, error } = await supabase
          .from('listings')
          .update(listingData)
          .eq('id', edit_id)
          .select()
          .single();
        listingError = error;
        listing = data;
      } else {
        const { data, error } = await supabase
          .from('listings')
          .insert(listingData)
          .select()
          .single();
        listingError = error;
        listing = data;
      }

      if (listingError) throw listingError;

      // 2. Optional: Create Meal Session
      if (supportsSessions && listing) {
        const { error: sessionError } = await supabase
          .from('meal_sessions')
          .insert({
            listing_id: listing.id,
            cook_id: user.id,
            title: mealName,
            description: description,
            session_note: sessionNote || description,
            session_date: sessionDate,
            start_time: '13:00',
            request_deadline: new Date(new Date(sessionDate).getTime() - 4 * 60 * 60 * 1000).toISOString(),
            total_slots: parseInt(totalSlots),
            min_requests_required: parseInt(minSlots),
            max_per_user: parseInt(maxPerUser),
            price_per_plate: parseFloat(sessionPrice || price)
          });

        if (sessionError) {
          // Roll back: delete the listing we just created to keep DB consistent
          if (!edit_id) {
            await supabase.from('listings').delete().eq('id', listing.id);
          }
          throw sessionError;
        }
      }

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
      setSupportsSessions(false);

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

  // ----------------------
  // RENDER: COOK MODE (Post a Meal)
  // ----------------------
  if (isCookMode) {
    if (isCookProfileLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                <View className="flex-1 bg-warm-cream items-center justify-center">
                    <ActivityIndicator size="large" color="#D65A31" />
                </View>
            </SafeAreaView>
        );
    }

    // LOCKED: Not an approved cook
    if (!isApprovedCook) {
      return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
          <View className="flex-1 bg-warm-cream items-center justify-center px-8">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-6">
              <Lock size={36} color="#9CA3AF" />
            </View>
            <Text className="text-2xl font-bold text-text-main text-center mb-3 font-sans-bold">
              Kitchen Locked
            </Text>
            <Text className="text-text-sub text-center text-base font-sans mb-8 leading-relaxed">
              You need to apply and get approved as a cook before you can post meals. Complete the application to unlock your kitchen.
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
                <Text className="text-white font-bold text-lg font-sans-bold">Apply to Cook</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      );
    }

    if (edit_id) {
      return (
        <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
          <View className="flex-1 bg-white">
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
                    className="bg-white rounded-2xl px-4 py-3 text-text-main font-sans text-base border border-[#F2DFD7]"
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
                  {/* Portions Stepper */}
                  <View className="flex-1 bg-white border border-[#F2DFD7] rounded-3xl p-4 justify-between">
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#8A7269', marginBottom: 8 }}>Portions</Text>
                    <View className="flex-row items-center justify-between">
                      <TouchableOpacity
                        onPress={() => {
                          const val = parseInt(portions, 10);
                          if (!isNaN(val) && val > 1) {
                            setPortions((val - 1).toString());
                          }
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: '#F2DFD7',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Minus size={14} color="#8A7269" />
                      </TouchableOpacity>
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#231915' }}>{portions || '1'}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          const val = parseInt(portions, 10);
                          setPortions((isNaN(val) ? 1 : val + 1).toString());
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: '#F2DFD7',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Plus size={14} color="#8A7269" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Price */}
                  <View className="flex-1 bg-white border border-[#F2DFD7] rounded-3xl p-4 justify-between">
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#8A7269', marginBottom: 8 }}>Price (GHS)</Text>
                    <View className="flex-row items-center">
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#BF592B', marginRight: 8 }}>₵</Text>
                      <TextInput
                        keyboardType="numeric"
                        style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#231915', flex: 1, padding: 0 }}
                        value={price}
                        onChangeText={(t) => {
                          setPrice(t);
                          setSessionPrice(t);
                        }}
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
                        className={`flex-1 py-2.5 rounded-xl border items-center ${prepTime === time ? 'bg-[#BF592B] border-[#BF592B]' : 'bg-white border-[#F2DFD7]'}`}
                      >
                        <Text className={`text-xs font-bold ${prepTime === time ? 'text-white' : 'text-text-sub'}`}>{time}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Available for Sessions Toggle Card */}
                <View className="bg-[#FFF1EC] rounded-2xl p-4 flex-row items-center justify-between mb-4 border border-[#F2DFD7]">
                  <View className="flex-row items-center gap-3 flex-1 mr-4">
                    <View className="w-10 h-10 bg-white rounded-xl items-center justify-center border border-[#F2DFD7]">
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

                {/* Join the Pot Toggle Card */}
                <View className="bg-[#FFF0F5] rounded-2xl p-4 flex-row items-center justify-between mb-6 border border-[#FFD2E5]">
                  <View className="flex-row items-center gap-3 flex-1 mr-4">
                    <View className="w-10 h-10 bg-white rounded-xl items-center justify-center border border-[#FFD2E5]">
                      <UtensilsCrossed size={20} color="#BF592B" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#231915' }}>Join the Pot</Text>
                        <View className="bg-green-600 px-2 py-0.5 rounded">
                          <Text className="text-white text-[8px] font-bold">POPULAR</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#8A7269', marginTop: 1 }}>
                        Opt-in for larger community batches to boost kitchen efficiency.
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={supportsSessions}
                    onValueChange={setSupportsSessions}
                    trackColor={{ false: '#F2DFD7', true: '#E9D6CF' }}
                    thumbColor={supportsSessions ? '#BF592B' : '#83746E'}
                    ios_backgroundColor="#F2DFD7"
                  />
                </View>

                {/* Join the Pot Expanded Form (conditional if supportsSessions is true) */}
                {supportsSessions && (
                  <View className="bg-[#FFF0F5] rounded-3xl p-5 mb-6 border border-[#FFD2E5]">
                    <View className="flex-row gap-4 mb-4">
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase px-1">Total Plates</Text>
                        <TextInput
                          className="bg-white rounded-xl px-4 py-3 text-text-main font-bold border border-[#FFD2E5]"
                          placeholder="20"
                          keyboardType="numeric"
                          value={totalSlots}
                          onChangeText={setTotalSlots}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase px-1">Min. Needed</Text>
                        <TextInput
                          className="bg-white rounded-xl px-4 py-3 text-text-main font-bold border border-[#FFD2E5]"
                          placeholder="5"
                          keyboardType="numeric"
                          value={minSlots}
                          onChangeText={setMinSlots}
                        />
                      </View>
                    </View>
                    
                    <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase px-1">Price per Plate (₵)</Text>
                    <TextInput
                      className="bg-white rounded-xl px-4 py-3 text-text-main font-bold mb-4 border border-[#FFD2E5]"
                      placeholder={price || "35.00"}
                      keyboardType="numeric"
                      value={sessionPrice}
                      onChangeText={(t) => {
                        setSessionPrice(t);
                        setPrice(t);
                      }}
                    />
                    
                    <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase px-1">Session Note</Text>
                    <TextInput
                      className="bg-white rounded-xl px-4 py-3 text-text-main font-bold mb-4 border border-[#FFD2E5]"
                      placeholder="Enter special note for this pot..."
                      value={sessionNote}
                      onChangeText={setSessionNote}
                    />
                  </View>
                )}

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
              <SafeAreaView className="flex-1 bg-white" edges={['top']}>
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
                          className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex-row items-center justify-between shadow-sm active:bg-clay-primary/5"
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
          <View className="px-6 pb-4 bg-white border-b border-gray-100 flex-row justify-between items-center" style={{ paddingTop: insets.top + 48, shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10, zIndex: 10 }}>
            <View>
              <Text className="text-2xl font-bold text-text-main font-sans-bold">{edit_id ? 'Edit Your Dish' : 'Post a New Dish'}</Text>
              <Text className="text-text-sub text-sm font-sans">{edit_id ? 'Update the details for your listing' : 'Share your culinary creation with the community'}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="px-4 py-2 bg-gray-100 rounded-full flex-row items-center gap-2 active:bg-gray-200"
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

            {/* Section 1: Dish Info */}
            <View className="bg-white rounded-3xl p-5 mb-6 shadow-sm">
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
                  className="bg-gray-50 rounded-2xl h-60 items-center justify-center mb-6 border-2 border-dashed border-gray-200 overflow-hidden"
                >
                  <Camera size={32} color="#9CA3AF" />
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
                        className="w-48 h-full bg-gray-50 rounded-2xl items-center justify-center border-2 border-dashed border-gray-200"
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
                placeholderTextColor="#9CA3AF"
                className="bg-gray-50 rounded-xl px-4 py-3 text-text-main font-sans text-base mb-4 italic"
                value={mealName}
                onChangeText={setMealName}
              />

              {/* Description */}
              <TextInput
                placeholder="Tell users why your version is special..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                className="bg-gray-50 rounded-xl px-4 py-3 text-text-main font-sans text-base min-h-[80px]"
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />

              {/* Location */}
              <View className="mt-4">
                <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase tracking-widest px-1">Pickup / Cook Location</Text>
                <View className="flex-row gap-2 mb-2">
                  <TextInput
                    placeholder="e.g. East Legon, Accra"
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-text-main font-sans text-base border border-gray-100"
                    value={locationText}
                    onChangeText={setLocationText}
                  />
                  <TouchableOpacity
                    onPress={useCurrentLocation}
                    disabled={locationFetching}
                    className="bg-clay-primary/10 rounded-xl px-3 items-center justify-center border border-clay-primary/20"
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
            </View>

            {/* Section 2: Meal Details */}
            <View className="bg-white rounded-3xl p-5 mb-6 shadow-sm">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 bg-clay-primary/10 rounded-full items-center justify-center">
                  <Info size={16} color="#D65A31" />
                </View>
                <Text className="text-base font-bold text-text-main font-sans-bold">Meal Details</Text>
              </View>

              <View className="flex-row gap-4 mb-5">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase tracking-widest px-1">Portions</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3 flex-row items-center gap-2">
                    <Users size={16} color="#D65A31" />
                    <TextInput
                      placeholder="10"
                      keyboardType="numeric"
                      className="flex-1 text-text-main font-bold"
                      value={portions}
                      onChangeText={setPortions}
                    />
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-text-sub mb-2 uppercase tracking-widest px-1">Price (₵)</Text>
                  <View className="bg-gray-50 rounded-xl px-4 py-3 flex-row items-center gap-2">
                    <Text className="text-clay-primary font-bold">₵</Text>
                    <TextInput
                      placeholder="45.00"
                      keyboardType="numeric"
                      className="flex-1 text-text-main font-bold"
                      value={price}
                      onChangeText={(t) => {
                        setPrice(t);
                        setSessionPrice(t); // Sync
                      }}
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
                    className={`px-4 py-2 rounded-xl border ${prepTime === time.value ? 'bg-clay-primary border-clay-primary' : 'bg-white border-gray-100'}`}
                  >
                    <Text className={`text-xs font-bold ${prepTime === time.value ? 'text-white' : 'text-text-sub'}`}>{time.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Section 3: Status */}
            <View className="bg-white rounded-3xl p-5 mb-6 shadow-sm">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 bg-clay-primary/10 rounded-full items-center justify-center">
                  <Check size={16} color="#D65A31" />
                </View>
                <Text className="text-base font-bold text-text-main font-sans-bold">Status</Text>
              </View>

              <View className="flex-row justify-between items-center px-1">
                <View className="flex-row items-center gap-3">
                  <View className="bg-kente-yellow/10 p-2 rounded-lg">
                    <Check size={16} color="#D65A31" />
                  </View>
                  <Text className="text-sm font-bold text-text-main font-sans-bold">Available for Sessions</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsAvailable(!isAvailable)}
                  className={`w-12 h-6 rounded-full px-1 justify-center ${isAvailable ? 'bg-clay-primary' : 'bg-gray-200'}`}
                >
                  <View className={`w-4 h-4 rounded-full bg-white transform ${isAvailable ? 'translate-x-6' : 'translate-x-0'}`} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Section 4: Join the Pot (Session) */}
            <View className={`rounded-3xl p-5 mb-20 shadow-md ${supportsSessions ? 'bg-clay-primary' : 'bg-white border-2 border-dashed border-clay-primary/20'}`}>
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center gap-2">
                  <View className={`w-8 h-8 rounded-full items-center justify-center ${supportsSessions ? 'bg-white/20' : 'bg-clay-primary/10'}`}>
                    <Star size={16} color={supportsSessions ? 'white' : '#D65A31'} fill={supportsSessions ? 'white' : 'none'} />
                  </View>
                  <Text className={`text-base font-bold font-sans-bold ${supportsSessions ? 'text-white' : 'text-text-main'}`}>Join the Pot</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSupportsSessions(!supportsSessions)}
                  className={`w-12 h-6 rounded-full px-1 justify-center ${supportsSessions ? 'bg-white/30' : 'bg-clay-primary/10'}`}
                >
                  <View className={`w-4 h-4 rounded-full bg-white transform ${supportsSessions ? 'translate-x-6' : 'translate-x-0'}`} />
                </TouchableOpacity>
              </View>

              {!supportsSessions ? (
                <Text className="text-[11px] text-text-sub font-sans leading-relaxed px-1">
                  Launch a community "Meal Drop" where multiple people reserve plates for a specific time. Great for batch cooking!
                </Text>
              ) : (
                <View className="mt-2">
                  <View className="flex-row gap-4 mb-4">
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold text-white/70 mb-2 uppercase px-1">Total Plates</Text>
                      <TextInput
                        className="bg-white/10 rounded-xl px-4 py-3 text-white font-bold"
                        placeholder="20"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        keyboardType="numeric"
                        value={totalSlots}
                        onChangeText={setTotalSlots}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold text-white/70 mb-2 uppercase px-1">Min. Needed</Text>
                      <TextInput
                        className="bg-white/10 rounded-xl px-4 py-3 text-white font-bold"
                        placeholder="5"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        keyboardType="numeric"
                        value={minSlots}
                        onChangeText={setMinSlots}
                      />
                    </View>
                  </View>

                  <Text className="text-[10px] font-bold text-white/70 mb-2 uppercase px-1">Price per Plate (₵)</Text>
                  <TextInput
                    className="bg-white/10 rounded-xl px-4 py-3 text-white font-bold mb-4"
                    placeholder={price || "35.00"}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numeric"
                    value={sessionPrice}
                    onChangeText={(t) => {
                      setSessionPrice(t);
                      setPrice(t); // Sync
                    }}
                  />

                  <Text className="text-[10px] font-bold text-white/70 mb-2 uppercase px-1">Session Note (e.g. Grandma style with extra shito)</Text>
                  <TextInput
                    className="bg-white/10 rounded-xl px-4 py-3 text-white font-bold mb-4"
                    placeholder="Enter special note for this pot..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={sessionNote}
                    onChangeText={setSessionNote}
                  />

                  <View className="flex-row items-center gap-2 bg-white/10 rounded-xl p-3 border border-white/10">
                    <Calendar size={16} color="white" />
                    <Text className="text-white text-xs font-bold font-sans-bold">Scheduled for Today (1:00 PM)</Text>
                  </View>
                </View>
              )}
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
                      {edit_id ? 'Update Dish' : (supportsSessions ? 'Launch Meal Drop' : 'Publish Listing')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* CATEGORY MODAL */}
          <Modal visible={isCategoryVisible} animationType="slide" transparent={false}>
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
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
                        className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex-row items-center justify-between shadow-sm active:bg-clay-primary/5"
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
      <View className="px-6 pb-4 bg-white border-b border-gray-100" style={{ paddingTop: insets.top + 48, shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10, zIndex: 10 }}>
        <Text className="text-2xl font-bold text-text-main font-sans-bold">Saved</Text>
        <Text className="text-sm text-text-sub font-sans">Your favorite meals and cooks</Text>
      </View>

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>

        {/* Section 1: Favorites */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-text-main font-sans-bold">Liked Meals</Text>
          <Text className="text-sm text-text-sub font-sans">{savedIds.length} saved</Text>
        </View>

        {savedLoading ? (
          <ActivityIndicator size="small" color="#D65A31" style={{ marginVertical: 20 }} />
        ) : savedListings.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center mb-6 shadow-sm">
            <Heart size={40} color="#E5E7EB" />
            <Text className="text-text-sub font-sans text-center mt-3">No saved meals yet{'\n'}Tap ♥ on any dish to save it here</Text>
          </View>
        ) : (
          savedListings.map((meal: any) => (
            <TouchableOpacity
              key={meal.id}
              className="bg-white p-3 rounded-2xl mb-4 flex-row gap-4 shadow-sm"
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
                <Text className="text-text-sub text-xs mb-2">by {meal.profiles?.full_name || 'Chef'}</Text>
                <Text className="text-clay-primary font-bold">₵{meal.price}</Text>
              </View>
              <View className="justify-center pr-2">
                <Heart size={24} color="#D65A31" fill="#D65A31" />
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* No more Saved Tip */}
        <View className="mt-8 mb-20 items-center">
          <Text className="text-gray-400 text-sm">Tap the heart icon on any meal to save it here.</Text>
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

