import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UtensilsCrossed, Camera, Plus, X, History, ChevronDown, ChevronUp, ArrowLeft, MapPin, Navigation, Lock, Clock, Users, Wheat, Soup, Flame, Apple, Fish, Cake, Leaf, Sprout } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import { addDays, format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import ProcessLoader from '@/components/ProcessLoader';
import { palette, type, fonts } from '@/constants/theme';
import { DAYS, TIME_PRESETS, MIN_GAP_DAYS, MAX_SESSIONS, SESSION_SERVING_CAP, nextDateForWeekday, isTooCloseToExistingSessions } from '@/lib/schedule';

const CATEGORY_ICONS: { [key: string]: React.ComponentType<any> } = {
  'Rice Dishes': Wheat,
  'Soups & Stews': Soup,
  'Grills & Kebabs': Flame,
  'Traditional Snacks': Apple,
  'Seafood': Fish,
  'Pastries': Cake,
  'Vegan': Leaf,
  'Vegetarian': Sprout,
};

const CATEGORIES = [
  'Rice Dishes', 'Soups & Stews', 'Grills & Kebabs', 'Traditional Snacks', 'Seafood', 'Pastries', 'Vegan', 'Vegetarian',
];

// Quick-pick tags for the event page. Hosts only pick from these, so guests always see the same wording.
const ATMOSPHERE_TAGS = ['Oware', 'Ludo', 'Card Games', 'Music', 'Highlife Music', 'Karaoke', 'BYOB', 'Outdoor Seating'];
const DIETARY_TAGS = ['Halal', 'Nut-Free', 'Veggie Option', 'Mild Pepper'];

const PREP_TIMES = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

const label = { ...type.micro, color: palette.accent, letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 6 };
// No lineHeight on purpose: on iOS (new architecture) a fixed lineHeight clips the top and bottom of text inside a TextInput.
// A minHeight gives the text room instead.
// The soft peach used on the category chips, a step lighter than the page, with a faint accent outline: readable but still warm.
const input = { fontFamily: fonts.regular, fontSize: 14, color: palette.ink, backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.25)', paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 };

// Host day: pick one of the cook's upcoming sessions, or set one up right here.
// An event can't go live without one, and each host day holds a single event.
function HostDayPicker({ sessions, selectedId, onSelect, editId, onSessionCreated }: {
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
        .insert({ cook_id: user.id, session_date: candidateDate.toISOString().split('T')[0], start_time: `${time}:00` })
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

  const chip = (selected: boolean, disabled = false) => ({
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: selected ? palette.accent : palette.canvas,
    opacity: disabled ? 0.45 : 1,
  });

  return (
    <View>
      {!showAdd && (
        <View style={{ gap: 8 }}>
          {sessions.map((s: any) => {
            const hasOtherDish = (s.listings || []).some((l: any) => l.id !== editId);
            const isSelected = selectedId === s.id;
            const isDisabled = hasOtherDish && !isSelected;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => !isDisabled && onSelect(s.id)}
                disabled={isDisabled}
                accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                style={{ ...chip(isSelected, isDisabled), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ ...type.body, fontFamily: fonts.semibold, color: isSelected ? 'white' : palette.ink }}>
                  {format(parseISO(s.session_date), 'EEE, MMM d')} · {format(new Date(`2000-01-01T${s.start_time}`), 'h:mm a')}
                </Text>
                <Text style={{ ...type.meta, color: isSelected ? 'white' : palette.muted }}>{hasOtherDish && !isSelected ? 'Has an event' : 'Open'}</Text>
              </TouchableOpacity>
            );
          })}
          {canAddMore && (
            <TouchableOpacity
              onPress={() => setShowAdd(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.accent }}
            >
              <Plus size={14} color={palette.accent} />
              <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.accent }}>New host day</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showAdd && (
        <View>
          {sessions.length === 0 && (
            <Text style={{ ...type.body, color: palette.muted, marginBottom: 10 }}>No host days set up yet. Add one right here.</Text>
          )}
          <Text style={label}>Day</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
            {DAYS.map((d) => {
              const selected = day === d.value;
              return (
                <TouchableOpacity
                  key={d.value}
                  onPress={() => setDay(d.value)}
                  accessibilityState={{ selected }}
                  style={{ width: 42, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? palette.accent : palette.canvas }}
                >
                  <Text style={{ ...type.meta, fontFamily: fonts.bold, color: selected ? 'white' : palette.ink }}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={label}>Pickup time</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {TIME_PRESETS.map((t) => {
              const selected = time === t.value;
              return (
                <TouchableOpacity key={t.value} onPress={() => setTime(t.value)} accessibilityState={{ selected }} style={{ ...chip(selected), flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} color={selected ? 'white' : palette.muted} />
                  <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: selected ? 'white' : palette.ink }}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={creating}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: palette.accent, opacity: creating ? 0.6 : 1 }}
            >
              {creating ? <ActivityIndicator color="white" size="small" /> : <Text style={{ ...type.body, fontFamily: fonts.bold, color: 'white' }}>Create host day</Text>}
            </TouchableOpacity>
            {sessions.length > 0 && (
              <TouchableOpacity
                onPress={() => { setShowAdd(false); setDay(null); setTime(null); }}
                style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.accent, alignItems: 'center' }}
              >
                <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.accent }}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// Edit mode: move an existing host day to another date/time. Updates the session row in place, so the event keeps
// its listing, and refreshes the listing's order deadline. Locked once guests have booked, since they booked that date.
function RescheduleHostDay({ session, otherSessions, listingId, bookedCount, onDone }: {
  session: any;
  otherSessions: any[];
  listingId: string;
  bookedCount: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(session.session_date);
  const [time, setTime] = useState<string>(String(session.start_time).slice(0, 5));
  const [saving, setSaving] = useState(false);

  const options = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)).filter(
    (d) => !isTooCloseToExistingSessions(d, otherSessions)
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: sessionError } = await supabase
        .from('cook_sessions')
        .update({ session_date: date, start_time: `${time}:00` })
        .eq('id', session.id);
      if (sessionError) throw sessionError;
      const { error: listingError } = await supabase
        .from('listings')
        .update({ order_deadline: new Date(`${date}T${time}:00`).toISOString() })
        .eq('id', listingId);
      if (listingError) throw listingError;
      setOpen(false);
      onDone();
      Alert.alert('Date updated', `Your event is now on ${format(parseISO(date), 'EEE, MMM d')} at ${format(new Date(`2000-01-01T${time}:00`), 'h:mm a')}.`);
    } catch (err: any) {
      Alert.alert('Could not change the date', err.message);
    } finally {
      setSaving(false);
    }
  };

  const chip = (selected: boolean) => ({
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: selected ? palette.accent : palette.canvas,
  });

  return (
    <View>
      <View style={{ ...chip(true), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ ...type.body, fontFamily: fonts.semibold, color: 'white' }}>
          {format(parseISO(session.session_date), 'EEE, MMM d')} · {format(new Date(`2000-01-01T${session.start_time}`), 'h:mm a')}
        </Text>
        <Text style={{ ...type.meta, color: 'white' }}>Current</Text>
      </View>

      {bookedCount > 0 ? (
        <Text style={{ ...type.meta, color: palette.muted, marginTop: 10 }}>
          {bookedCount} {bookedCount === 1 ? 'guest has' : 'guests have'} already booked this date, so it can't be moved. Message them from your inbox if plans change.
        </Text>
      ) : !open ? (
        <TouchableOpacity
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          style={{ marginTop: 10, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.accent, alignItems: 'center' }}
        >
          <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.accent }}>Change date or time</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ marginTop: 14 }}>
          <Text style={label}>New date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
            {options.map((d) => {
              const key = format(d, 'yyyy-MM-dd');
              const selected = date === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setDate(key)}
                  accessibilityState={{ selected }}
                  style={{ width: 58, height: 70, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? palette.accent : palette.canvas }}
                >
                  <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: selected ? 'white' : palette.muted }}>{format(d, 'EEE')}</Text>
                  <Text style={{ ...type.section, color: selected ? 'white' : palette.ink }}>{format(d, 'd')}</Text>
                  <Text style={{ ...type.micro, color: selected ? 'white' : palette.muted }}>{format(d, 'MMM')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={label}>Pickup time</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {TIME_PRESETS.map((t) => {
              const selected = time === t.value;
              return (
                <TouchableOpacity key={t.value} onPress={() => setTime(t.value)} accessibilityState={{ selected }} style={{ ...chip(selected), flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} color={selected ? 'white' : palette.muted} />
                  <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: selected ? 'white' : palette.ink }}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: palette.accent, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={{ ...type.body, fontFamily: fonts.bold, color: 'white' }}>Save new date</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setOpen(false); setDate(session.session_date); setTime(String(session.start_time).slice(0, 5)); }}
              style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.accent, alignItems: 'center' }}
            >
              <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.accent }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export default function PostDishForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { edit_id: editParam, new: newParam } = useLocalSearchParams();
  const edit_id = Array.isArray(editParam) ? editParam[0] : editParam;
  // Changes every time "Create an Event" is tapped, so the form knows to start blank.
  const newToken = Array.isArray(newParam) ? newParam[0] : newParam;

  const [step, setStep] = useState<1 | 2>(1);
  const [mealName, setMealName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [prepTime, setPrepTime] = useState(30);
  const [isAvailable, setIsAvailable] = useState(true);
  const [pickupAvailable, setPickupAvailable] = useState(true);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [imagesBase64, setImagesBase64] = useState<string[]>([]);
  const [locationText, setLocationText] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationFetching, setLocationFetching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [portionsLeft, setPortionsLeft] = useState<number | null>(null);
  // An older event that has its own date but no host day yet: shown as-is and turned into a host day on save.
  const [legacyDeadline, setLegacyDeadline] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [mainDish, setMainDish] = useState('');
  const [starter, setStarter] = useState('');
  const [sidesDessert, setSidesDessert] = useState('');
  const [drinks, setDrinks] = useState('');
  const [showMenuExtras, setShowMenuExtras] = useState(false);
  const [atmosphereTags, setAtmosphereTags] = useState<string[]>([]);
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);

  // Back to a blank form: used by every "Create an Event" entry and after saving.
  const resetForm = () => {
    setStep(1);
    setMealName('');
    setDescription('');
    setPrice('');
    setPrepTime(30);
    setIsAvailable(true);
    setPickupAvailable(true);
    setDeliveryAvailable(false);
    setSelectedSessionId(null);
    setSelectedCategories([]);
    setImages([]);
    setImagesBase64([]);
    setLocationText('');
    setLocationLat(null);
    setLocationLng(null);
    setPortionsLeft(null);
    setLegacyDeadline(null);
    setShowPast(false);
    setMainDish('');
    setStarter('');
    setSidesDessert('');
    setDrinks('');
    setShowMenuExtras(false);
    setAtmosphereTags([]);
    setDietaryTags([]);
  };

  // Not editing (a fresh "Create an Event", or an edit just finished): never show the previous event's values.
  useEffect(() => {
    if (!edit_id) resetForm();
  }, [edit_id, newToken]);

  // Load the event when editing
  useEffect(() => {
    if (!edit_id) return;
    (async () => {
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
        setLegacyDeadline(!data.session_id && data.order_deadline ? data.order_deadline : null);
        setPortionsLeft(data.portions_available ?? null);
        setMainDish(data.main_dish || '');
        setStarter(data.starter || '');
        setSidesDessert(data.sides_dessert || '');
        setDrinks(data.drinks || '');
        setShowMenuExtras(!!(data.starter || data.sides_dessert || data.drinks));
        setAtmosphereTags(data.atmosphere_tags || []);
        setDietaryTags(data.dietary_tags || []);
        setSelectedCategories(data.category ? data.category.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
        const imgList = data.image ? data.image.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        setImages(imgList);
        setImagesBase64(new Array(imgList.length).fill(''));
        setLocationLat(data.latitude || null);
        setLocationLng(data.longitude || null);
        setLocationText(data.location_text || '');
      }
    })();
  }, [edit_id]);

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
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo) {
        const parts = [geo.district || geo.subregion, geo.city || geo.region].filter(Boolean);
        setLocationText(parts.join(', '));
      }
    } catch (e) {
      Alert.alert('Error', 'Could not get location. Please type it manually.');
    }
    setLocationFetching(false);
  };

  const pickImage = async () => {
    if (images.length >= 4) {
      Alert.alert('Limit Reached', 'You can select up to 4 images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true });
    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
      setImagesBase64([...imagesBase64, result.assets[0].base64 || '']);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImagesBase64(imagesBase64.filter((_, i) => i !== index));
  };

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
          const { error: uploadError } = await supabase.storage.from('listing-images').upload(filePath, decode(b64), { contentType: 'image/jpeg' });
          if (uploadError) {
            console.error('Image upload error:', uploadError);
          } else {
            const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(filePath);
            uploadedUrls.push(publicUrl);
          }
        }
      }
    }
    return uploadedUrls.join(',');
  };

  // Is this person an approved host?
  const { data: cookProfile, isLoading: isCookProfileLoading } = useQuery({
    queryKey: ['cook-approval-check'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('role, cook_application_status').eq('id', user.id).single();
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const isApprovedCook = cookProfile?.role === 'COOK' && cookProfile?.cook_application_status === 'approved';

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

  // The cook's earlier events, offered as starting points for a new one.
  const { data: pastEvents = [] } = useQuery({
    queryKey: ['cook-past-events'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from('listings')
        .select('id, title, description, price, category, prep_time_minutes, location_text, latitude, longitude, main_dish, starter, sides_dessert, drinks, atmosphere_tags, dietary_tags')
        .eq('cook_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12);
      const seen = new Set<string>();
      return (data || []).filter((l: any) => {
        const key = (l.title || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 6);
    },
    enabled: isApprovedCook && !edit_id,
  });

  const toggleTag = (tag: string, list: string[], setList: (v: string[]) => void) =>
    setList(list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag]);

  const tagChip = (tag: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={tag}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ backgroundColor: selected ? palette.accent : '#FFF1EC', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9999, borderWidth: 1, borderColor: selected ? palette.accent : '#DDC1B6' }}
    >
      <Text style={{ fontFamily: selected ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium', fontSize: 13, color: selected ? 'white' : '#56423B' }}>{tag}</Text>
    </TouchableOpacity>
  );

  const useAsStartingPoint = (e: any) => {
    setMealName(e.title || '');
    setDescription(e.description || '');
    setPrice(e.price != null ? String(e.price) : '');
    setPrepTime(e.prep_time_minutes || 30);
    setSelectedCategories(e.category ? e.category.split(',').map((c: string) => c.trim()).filter((c: string) => CATEGORIES.includes(c)) : []);
    setLocationText(e.location_text || '');
    setLocationLat(e.latitude ?? null);
    setLocationLng(e.longitude ?? null);
    setMainDish(e.main_dish || '');
    setStarter(e.starter || '');
    setSidesDessert(e.sides_dessert || '');
    setDrinks(e.drinks || '');
    setShowMenuExtras(!!(e.starter || e.sides_dessert || e.drinks));
    setAtmosphereTags(e.atmosphere_tags || []);
    setDietaryTags(e.dietary_tags || []);
    setShowPast(false);
  };

  // A new event defaults onto the soonest host day that has no dish yet.
  useEffect(() => {
    if (!edit_id && selectedSessionId === null) {
      const openSession = upcomingSessions.find((s: any) => !(s.listings || []).length);
      if (openSession) setSelectedSessionId(openSession.id);
    }
  }, [edit_id, upcomingSessions, selectedSessionId, newToken]);

  const selectedSession = upcomingSessions.find((x: any) => x.id === selectedSessionId);

  const handleSessionCreated = (newSessionId: string) => {
    setSelectedSessionId(newSessionId);
    queryClient.invalidateQueries({ queryKey: ['cook-upcoming-sessions'] });
  };

  const goToStep2 = () => {
    const numPrice = parseFloat(price);
    if (!mealName.trim() || !price || isNaN(numPrice) || numPrice <= 0) {
      Alert.alert('Incomplete Form', 'Please give your event a name and set a valid price.');
      return;
    }
    if (!mainDish.trim()) {
      Alert.alert('Main Dish Required', 'Tell guests what the main dish is. It is the star of your event.');
      return;
    }
    setStep(2);
  };

  const handlePublish = async () => {
    if (!mealName || !price) {
      Alert.alert('Incomplete Form', 'Please give your event a name and set a price.');
      setStep(1);
      return;
    }
    if (!mainDish.trim()) {
      Alert.alert('Main Dish Required', 'Tell guests what the main dish is. It is the star of your event.');
      setStep(1);
      return;
    }
    if (!locationLat || !locationLng) {
      Alert.alert('Location Required', 'Please set your location so customers can find you on the map. Tap the location button or type your address.');
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      setStep(1);
      return;
    }
    if (!selectedSessionId && !(edit_id && legacyDeadline)) {
      Alert.alert('Host Day Required', 'Every event needs a host day attached before it can go live. Pick or create one.');
      return;
    }
    const selectedSession = upcomingSessions.find((s: any) => s.id === selectedSessionId);
    if (selectedSession) {
      const otherDishes = (selectedSession.listings || []).filter((l: any) => l.id !== edit_id);
      if (otherDishes.length > 0) {
        Alert.alert('Host Day Already Has an Event', 'Each host day is one event only. Pick a different host day or edit the event already assigned to this one.');
        return;
      }
    }
    const orderDeadlineISO = selectedSession
      ? new Date(`${selectedSession.session_date}T${selectedSession.start_time}`).toISOString()
      : (edit_id && legacyDeadline ? legacyDeadline : null);

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const imageUrls = await uploadImages(user.id);

      // Older event with a date but no host day: reuse or create the host day for that exact date and time, so nothing has to be re-picked.
      let sessionIdToUse = selectedSessionId;
      if (!sessionIdToUse && edit_id && legacyDeadline) {
        const when = new Date(legacyDeadline);
        const dateStr = format(when, 'yyyy-MM-dd');
        const timeStr = format(when, 'HH:mm:ss');
        const { data: sameDay } = await supabase
          .from('cook_sessions')
          .select('id, listings(id)')
          .eq('cook_id', user.id)
          .eq('session_date', dateStr)
          .limit(1);
        const existing: any = sameDay && sameDay[0];
        if (existing) {
          const taken = (Array.isArray(existing.listings) ? existing.listings : existing.listings ? [existing.listings] : []).some((l: any) => l.id !== edit_id);
          sessionIdToUse = taken ? null : existing.id;
        } else {
          const { data: created } = await supabase
            .from('cook_sessions')
            .insert({ cook_id: user.id, session_date: dateStr, start_time: timeStr })
            .select('id')
            .single();
          sessionIdToUse = created?.id ?? null;
        }
      }

      const listingData: any = {
        cook_id: user.id,
        title: mealName,
        description: description,
        price: numPrice,
        portions_available: SESSION_SERVING_CAP,
        prep_time_minutes: prepTime,
        available: isAvailable,
        pickup_available: pickupAvailable,
        delivery_available: deliveryAvailable,
        session_id: sessionIdToUse,
        order_deadline: orderDeadlineISO,
        category: selectedCategories.length > 0 ? selectedCategories.join(', ') : 'Custom',
        location_text: locationText || null,
        latitude: locationLat,
        longitude: locationLng,
        image: imageUrls || null,
        main_dish: mainDish.trim() || null,
        starter: starter.trim() || null,
        sides_dessert: sidesDessert.trim() || null,
        drinks: drinks.trim() || null,
        atmosphere_tags: atmosphereTags,
        dietary_tags: dietaryTags,
      };

      // Editing must never refill the pool: portions_available already reflects what guests have booked.
      if (edit_id) delete listingData.portions_available;

      const { error: listingError } = edit_id
        ? await supabase.from('listings').update(listingData).eq('id', edit_id).select().single()
        : await supabase.from('listings').insert(listingData).select().single();
      if (listingError) throw listingError;

      Alert.alert('Success!', edit_id ? 'Your event has been updated.' : 'Your event is now live on the marketplace.');

      resetForm();
      queryClient.invalidateQueries({ queryKey: ['cook-past-events'] });
      queryClient.invalidateQueries({ queryKey: ['my-menu'] });
      queryClient.invalidateQueries({ queryKey: ['cook-upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['explore-feed'] });
      queryClient.invalidateQueries({ queryKey: ['listing', edit_id] });
      queryClient.invalidateQueries({ queryKey: ['cook-meals', user.id] });

      if (edit_id) {
        router.setParams({ edit_id: undefined as any });
        router.back();
      } else router.push('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isCookProfileLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // Not an approved host yet
  if (!isApprovedCook) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Lock size={36} color={palette.muted} />
          </View>
          <Text style={{ ...type.hero, color: palette.ink, textAlign: 'center', marginBottom: 12 }}>Kitchen Locked</Text>
          <Text style={{ ...type.card, fontFamily: fonts.regular, color: palette.muted, textAlign: 'center', marginBottom: 32 }}>
            You need to apply and get approved as a host before you can post meals. Complete the application to unlock your kitchen.
          </Text>
          {cookProfile?.cook_application_status === 'pending' ? (
            <View style={{ backgroundColor: palette.surface, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16, width: '100%', alignItems: 'center' }}>
              <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.accent }}>Application under review</Text>
              <Text style={{ ...type.body, color: palette.muted, marginTop: 4, textAlign: 'center' }}>We'll notify you once approved</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/onboarding/apply-to-cook')}
              style={{ backgroundColor: palette.accent, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%' }}
            >
              <UtensilsCrossed size={20} color="white" />
              <Text style={{ ...type.card, fontFamily: fonts.bold, color: 'white' }}>Apply to Host</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const stepTab = (n: 1 | 2, text: string) => {
    const active = step === n;
    return (
      <TouchableOpacity
        onPress={() => (n === 1 ? setStep(1) : goToStep2())}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        style={{ flexDirection: 'row', alignItems: 'center', opacity: active ? 1 : 0.55 }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: active ? palette.accent : palette.skeleton }}>
          <Text style={{ ...type.micro, color: active ? 'white' : palette.ink }}>{n}</Text>
        </View>
        <Text style={{ ...type.meta, fontFamily: active ? fonts.bold : fonts.semibold, color: active ? palette.ink : palette.muted }}>{text}</Text>
      </TouchableOpacity>
    );
  };

  const card = { backgroundColor: palette.surface, borderRadius: 20, padding: 16, marginBottom: 14 };
  const cover = images[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexShrink: 1, marginRight: 12 }}>
              <Text style={{ ...type.micro, color: palette.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Kitchen</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ ...type.section, color: palette.ink }}>{edit_id ? 'Edit Event' : 'Create an Event'}</Text>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.accent, marginTop: 4 }} />
              </View>
            </View>
            {(edit_id || step === 2) && (
              <TouchableOpacity
                onPress={() => (step === 2 ? setStep(1) : router.back())}
                accessibilityLabel={step === 2 ? 'Back to event details' : 'Close'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: palette.inkWash, alignItems: 'center', justifyContent: 'center' }}
              >
                {step === 2 ? <ArrowLeft size={16} color={palette.inkSoft} /> : <X size={16} color={palette.inkSoft} />}
              </TouchableOpacity>
            )}
          </View>

          {/* Stepper */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
            {stepTab(1, 'Event Details')}
            <View style={{ flex: 1, height: 1, backgroundColor: palette.skeleton, marginHorizontal: 10 }} />
            {stepTab(2, 'Host Day')}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 130 }}>
          {step === 1 ? (
            <>
              {/* Reuse a past event (new events only): one slim pill, opens a single row of titles */}
              {!edit_id && pastEvents.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => setShowPast(v => !v)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showPast }}
                    style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}
                  >
                    <History size={13} color={palette.accent} />
                    <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: palette.accent }}>Reuse a past event</Text>
                    {showPast ? <ChevronUp size={13} color={palette.accent} /> : <ChevronDown size={13} color={palette.accent} />}
                  </TouchableOpacity>
                  {showPast && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
                      {pastEvents.map((e: any) => (
                        <TouchableOpacity
                          key={e.id}
                          onPress={() => useAsStartingPoint(e)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`Start from ${e.title}`}
                          style={{ maxWidth: 200, height: 32, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 16, backgroundColor: palette.accent }}
                        >
                          <Text numberOfLines={1} style={{ ...type.meta, fontFamily: fonts.semibold, color: 'white' }}>{e.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Photos */}
              {images.length === 0 ? (
                <TouchableOpacity
                  onPress={pickImage}
                  activeOpacity={0.8}
                  style={{ height: 160, borderRadius: 20, borderWidth: 2, borderColor: palette.accent, borderStyle: 'dashed', backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', padding: 16, marginBottom: 14 }}
                >
                  <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Camera size={24} color={palette.accent} />
                  </View>
                  <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink }}>Upload event photos</Text>
                  <Text style={{ ...type.meta, color: palette.muted, textAlign: 'center', marginTop: 2 }}>Take or choose up to 4 photos of your event</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ height: 160, marginBottom: 14 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                    {images.map((img, idx) => (
                      <View key={idx} style={{ width: 190, height: '100%', borderRadius: 20, overflow: 'hidden', backgroundColor: palette.skeleton }}>
                        <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} />
                        <TouchableOpacity
                          onPress={() => removeImage(idx)}
                          accessibilityLabel="Remove photo"
                          style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(61,37,30,0.7)', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={15} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {images.length < 4 && (
                      <TouchableOpacity
                        onPress={pickImage}
                        activeOpacity={0.8}
                        style={{ width: 190, height: '100%', borderRadius: 20, borderWidth: 2, borderColor: palette.accent, borderStyle: 'dashed', backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Plus size={24} color={palette.accent} />
                        <Text style={{ ...type.meta, color: palette.muted, marginTop: 4 }}>Add photo ({images.length}/4)</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Dish details */}
              <View style={card}>
                <Text style={label}>Event title</Text>
                <TextInput
                  placeholder="e.g. Grandma's Jollof & Grilled Chicken"
                  placeholderTextColor={palette.muted}
                  style={input}
                  value={mealName}
                  onChangeText={setMealName}
                />

                <Text style={{ ...label, marginTop: 14 }}>Description</Text>
                <TextInput
                  placeholder="Tell guests why your version is special..."
                  placeholderTextColor={palette.muted}
                  multiline
                  textAlignVertical="top"
                  style={{ ...input, minHeight: 96, paddingTop: 14 }}
                  value={description}
                  onChangeText={setDescription}
                />

                <Text style={{ ...label, marginTop: 14 }}>Price per portion (₵)</Text>
                <View style={{ ...input, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: palette.accent }}>₵</Text>
                  <TextInput
                    placeholder="45.00"
                    placeholderTextColor={palette.muted}
                    keyboardType="numeric"
                    style={{ fontFamily: fonts.bold, fontSize: 16, color: palette.ink, flex: 1, paddingVertical: 12, minHeight: 48 }}
                    value={price}
                    onChangeText={setPrice}
                  />
                </View>

                <Text style={{ ...label, marginTop: 14 }}>Ready in (cooking time)</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {PREP_TIMES.map((time) => {
                    const selected = prepTime === time.value;
                    return (
                      <TouchableOpacity
                        key={time.value}
                        onPress={() => setPrepTime(time.value)}
                        accessibilityState={{ selected }}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: selected ? palette.accent : palette.canvas }}
                      >
                        <Text style={{ ...type.meta, fontFamily: fonts.bold, color: selected ? 'white' : palette.ink }}>{time.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Food category (unchanged) */}
              <View style={card}>
                <View className="mb-4">
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#231915', marginBottom: 8 }}>
                    Food Category (Select up to 2)
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                    {CATEGORIES.map((cat) => {
                      const IconComponent = CATEGORY_ICONS[cat];
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedCategories(selectedCategories.filter(c => c !== cat));
                            } else if (selectedCategories.length < 2) {
                              setSelectedCategories([...selectedCategories, cat]);
                            } else {
                              Alert.alert('Category Limit', 'You can select up to 2 categories for your event.');
                            }
                          }}
                          style={{
                            backgroundColor: isSelected ? palette.accent : '#FFF1EC',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 9999,
                            borderWidth: 1,
                            borderColor: isSelected ? palette.accent : '#DDC1B6',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          activeOpacity={0.8}
                        >
                          {IconComponent && <IconComponent size={14} color={isSelected ? 'white' : palette.accent} />}
                          <Text style={{ fontFamily: isSelected ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium', fontSize: 13, color: isSelected ? 'white' : '#56423B' }}>{cat}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* On the table: the main dish, plus optional starters, sides and drinks behind one button */}
              <View style={card}>
                <Text style={{ ...label, marginBottom: 2 }}>Main dish *</Text>
                <Text style={{ ...type.meta, color: palette.inkSoft, marginBottom: 8 }}>Include protein type and key ingredients.</Text>
                <TextInput
                  placeholder="e.g. Grilled beef chichinga skewers with onions and suya spice"
                  placeholderTextColor={palette.muted}
                  style={input}
                  value={mainDish}
                  onChangeText={setMainDish}
                  maxLength={160}
                />

                <TouchableOpacity
                  onPress={() => setShowMenuExtras(v => !v)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showMenuExtras }}
                  style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FFE9E0', borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.3)' }}
                >
                  {showMenuExtras ? <ChevronUp size={16} color={palette.accent} /> : <Plus size={16} color={palette.accent} />}
                  <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.accent }}>
                    {showMenuExtras ? 'Hide starters, sides & drinks' : 'Add starters, sides & drinks'}
                  </Text>
                </TouchableOpacity>

                {showMenuExtras && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={label}>Welcome snack / starter</Text>
                    <TextInput
                      placeholder="e.g. Spicy peanut dip & plantain chips"
                      placeholderTextColor={palette.muted}
                      style={input}
                      value={starter}
                      onChangeText={setStarter}
                      maxLength={200}
                    />
                    <Text style={{ ...label, marginTop: 14 }}>Sides & dessert</Text>
                    <TextInput
                      placeholder="e.g. Fried yam or kelewele"
                      placeholderTextColor={palette.muted}
                      style={input}
                      value={sidesDessert}
                      onChangeText={setSidesDessert}
                      maxLength={200}
                    />
                    <Text style={{ ...label, marginTop: 14 }}>Included drinks</Text>
                    <TextInput
                      placeholder="e.g. 1 chilled sobolo or club beer"
                      placeholderTextColor={palette.muted}
                      style={input}
                      value={drinks}
                      onChangeText={setDrinks}
                      maxLength={200}
                    />
                  </View>
                )}
              </View>

              {/* Atmosphere and dietary tags */}
              <View style={card}>
                <Text style={label}>Games & atmosphere</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {ATMOSPHERE_TAGS.map(tag => tagChip(tag, atmosphereTags.includes(tag), () => toggleTag(tag, atmosphereTags, setAtmosphereTags)))}
                </View>
                <Text style={label}>Dietary tags</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {DIETARY_TAGS.map(tag => tagChip(tag, dietaryTags.includes(tag), () => toggleTag(tag, dietaryTags, setDietaryTags)))}
                </View>
                <Text style={{ ...type.meta, color: palette.muted, marginTop: 10 }}>
                  Stated by you. Guests are told to confirm allergies with you before booking.
                </Text>
              </View>

              <TouchableOpacity onPress={goToStep2} activeOpacity={0.85} style={{ backgroundColor: palette.accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 4 }}>
                <Text style={{ ...type.card, fontFamily: fonts.bold, color: 'white' }}>Next: Host Day</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Summary */}
              <View style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {cover ? (
                  <Image source={{ uri: cover }} style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: palette.skeleton }} />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: palette.inkWash, alignItems: 'center', justifyContent: 'center' }}>
                    <UtensilsCrossed size={22} color={palette.accent} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink }}>{mealName}</Text>
                  <Text style={{ ...type.body, fontFamily: fonts.bold, color: palette.accent, marginTop: 2 }}>₵{price} / portion</Text>
                </View>
                <TouchableOpacity onPress={() => setStep(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ ...type.meta, fontFamily: fonts.semibold, color: palette.muted }}>Edit</Text>
                </TouchableOpacity>
              </View>

              {/* Host day */}
              <View style={card}>
                <Text style={label}>Select host day</Text>
                <Text style={{ ...type.meta, color: palette.muted, marginBottom: 12 }}>Which day is your event? Each host day is one event.</Text>
                {edit_id && selectedSession ? (
                  <RescheduleHostDay
                    key={`${selectedSession.id}-${selectedSession.session_date}-${selectedSession.start_time}`}
                    session={selectedSession}
                    otherSessions={upcomingSessions.filter((x: any) => x.id !== selectedSession.id)}
                    listingId={edit_id}
                    bookedCount={portionsLeft === null ? 0 : Math.max(0, SESSION_SERVING_CAP - portionsLeft)}
                    onDone={() => {
                      queryClient.invalidateQueries({ queryKey: ['cook-upcoming-sessions'] });
                      queryClient.invalidateQueries({ queryKey: ['kitchen-schedule'] });
                      queryClient.invalidateQueries({ queryKey: ['my-menu'] });
                      queryClient.invalidateQueries({ queryKey: ['explore-feed'] });
                      queryClient.invalidateQueries({ queryKey: ['listing', edit_id] });
                    }}
                  />
                ) : edit_id && !selectedSessionId && legacyDeadline ? (
                  <View>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: palette.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ ...type.body, fontFamily: fonts.semibold, color: 'white' }}>
                        {format(new Date(legacyDeadline), 'EEE, MMM d')} · {format(new Date(legacyDeadline), 'h:mm a')}
                      </Text>
                      <Text style={{ ...type.meta, color: 'white' }}>Current</Text>
                    </View>
                    <Text style={{ ...type.meta, color: palette.inkSoft, marginTop: 10 }}>
                      This is your event's date. It becomes your host day when you save, so there is nothing to pick.
                    </Text>
                  </View>
                ) : (
                  <HostDayPicker
                    sessions={upcomingSessions}
                    selectedId={selectedSessionId}
                    onSelect={setSelectedSessionId}
                    onSessionCreated={handleSessionCreated}
                    editId={edit_id}
                  />
                )}

                {/* Fixed portions */}
                <View style={{ backgroundColor: palette.canvas, borderRadius: 14, padding: 14, marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Lock size={16} color={palette.ink} />
                      <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.ink }}>Serving pool</Text>
                    </View>
                    <View style={{ backgroundColor: palette.ink, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Users size={11} color="white" />
                      <Text style={{ ...type.micro, color: 'white' }}>FIXED AT {SESSION_SERVING_CAP}</Text>
                    </View>
                  </View>
                  <Text style={{ ...type.meta, color: palette.muted, marginTop: 6 }}>
                    Every host day has a pool of {SESSION_SERVING_CAP} portions to keep food fresh and avoid waste.
                  </Text>
                </View>
              </View>

              {/* Pickup location */}
              <View style={card}>
                <Text style={label}>Pickup / host location</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    placeholder="e.g. East Legon, Accra"
                    placeholderTextColor={palette.muted}
                    style={{ ...input, flex: 1 }}
                    value={locationText}
                    onChangeText={setLocationText}
                  />
                  <TouchableOpacity
                    onPress={useCurrentLocation}
                    disabled={locationFetching}
                    accessibilityLabel="Use my current location"
                    style={{ width: 48, borderRadius: 12, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {locationFetching ? <ActivityIndicator size="small" color={palette.accent} /> : <Navigation size={20} color={palette.accent} />}
                  </TouchableOpacity>
                </View>
                {locationLat ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <MapPin size={13} color="#006A3C" />
                    <Text style={{ ...type.meta, color: '#006A3C' }}>GPS location captured</Text>
                  </View>
                ) : (
                  <Text style={{ ...type.meta, color: palette.muted, marginTop: 8 }}>Tap the arrow so guests can find you on the map.</Text>
                )}
              </View>

              {/* Availability */}
              <View style={{ ...card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ ...type.card, color: palette.ink }}>Available for sessions</Text>
                  <Text style={{ ...type.meta, color: palette.muted, marginTop: 2 }}>
                    {isAvailable ? 'Guests can book this event' : 'Hidden from guests'}
                  </Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={setIsAvailable}
                  trackColor={{ false: palette.skeleton, true: palette.accent }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Available for sessions"
                />
              </View>

              <TouchableOpacity
                onPress={handlePublish}
                disabled={loading}
                activeOpacity={0.85}
                style={{ backgroundColor: palette.accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 4, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <ActivityIndicator color="white" size="small" /> : (
                  <Text style={{ ...type.card, fontFamily: fonts.bold, color: 'white' }}>{edit_id ? 'Update Event' : 'Publish Event'}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ProcessLoader visible={loading} message={edit_id ? 'Saving Changes...' : 'Creating Event...'} />
    </SafeAreaView>
  );
}
