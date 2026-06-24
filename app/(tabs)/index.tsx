import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, Star, ChevronRight, X, Bell, LayoutDashboard, TrendingUp, Users as UsersIcon, Clock as ClockIcon, ShoppingCart, Plus, Flame, ChefHat, Heart, Zap, Leaf, Utensils, Soup, Fish, Cake, Apple, Sprout, Wheat, ShoppingBag } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';
import { getDishImage } from '@/constants/Images';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProcessLoader from '@/components/ProcessLoader';

const AnimatedHeartOverlay = ({ visible }: { visible: boolean }) => {
  const scale = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      scale.setValue(0.3);
      opacity.setValue(0);
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1.2,
            friction: 4,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.9,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(300),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        opacity,
        transform: [{ scale }],
      }}
      pointerEvents="none"
    >
      <Heart size={48} color="#FFFFFF" fill="#FFFFFF" />
    </Animated.View>
  );
};

const { width } = Dimensions.get('window');

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning,';
  if (hour < 17) return 'Good Afternoon,';
  return 'Good Evening,';
};

export const MOCK_MAIN_DISHES = [
  {
    id: 'jollof',
    name: 'Jollof Rice',
    description: 'Classic West African seasoned rice cooked in rich tomato sauce.',
    base_image_url: 'https://media.screensdesign.com/gasset/b2f9baeb-dfb0-41f6-9a4e-a80e958e8e6e.png',
    category: 'Lunch & Dinner'
  },
  {
    id: 'waakye',
    name: 'Waakye',
    description: 'Rice and beans cooked with dried millet leaves, served with shito.',
    base_image_url: 'https://media.screensdesign.com/gasset/7b8349e8-337a-47c1-9718-f6066ab6fd1f.png',
    category: 'Lunch'
  },
  {
    id: 'fufu',
    name: 'Fufu & Light Soup',
    description: 'Pounded cassava and plantain served with spicy light soup.',
    base_image_url: 'https://media.screensdesign.com/gasset/75c93ccb-f921-46ff-8105-d4b729201d6e.png',
    category: 'Dinner'
  },
  {
    id: 'banku',
    name: 'Banku & Tilapia',
    description: 'Fermented corn and cassava dough served with grilled tilapia and hot pepper.',
    base_image_url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=1000',
    category: 'Lunch & Dinner'
  },
  {
    id: 'kenkey',
    name: 'Kenkey & Fish',
    description: 'Fermented corn dough served with fried fish and hot pepper sauce.',
    base_image_url: 'https://media.screensdesign.com/gasset/b2f9baeb-dfb0-41f6-9a4e-a80e958e8e6e.png',
    category: 'Lunch & Dinner'
  }
];

const ICON_MAP: { [key: string]: React.ComponentType<any> } = {
  Utensils,
  Wheat,
  Soup,
  Flame,
  Apple,
  Fish,
  Cake,
  Leaf,
  Sprout
};

const CATEGORIES = [
  { id: '1', name: 'All', icon: 'Utensils' },
  { id: '2', name: 'Rice Dishes', icon: 'Wheat' },
  { id: '4', name: 'Soups & Stews', icon: 'Soup' },
  { id: '5', name: 'Grills & Kebabs', icon: 'Flame' },
  { id: '6', name: 'Traditional Snacks', icon: 'Apple' },
  { id: '7', name: 'Seafood', icon: 'Fish' },
  { id: '8', name: 'Pastries', icon: 'Cake' },
  { id: '9', name: 'Vegan', icon: 'Leaf' },
  { id: '10', name: 'Vegetarian', icon: 'Sprout' }
];

const getStatusText = (status: string) => {
  switch (status) {
    case 'Accepted': return 'Order accepted';
    case 'Cooking': return 'Preparing your meal';
    case 'Ready': return 'Ready for pickup!';
    case 'Completed': return 'Enjoy your meal!';
    default: return 'Processing';
  }
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isCookMode = useAppStore(state => state.isCookMode);
  const storeName = useAppStore(state => state.userName);
  const cartItems = useAppStore(state => state.cartItems);
  const cartCount = cartItems.reduce((sum, ci) => sum + ci.quantity, 0);
  const queryClient = useQueryClient();

  // -- State --
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedOrderId, setDismissedOrderId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [animatingLikes, setAnimatingLikes] = useState<{ [key: string]: boolean }>({});
  const lastTap = React.useRef<{ [key: string]: number }>({});
  const tapTimeout = React.useRef<{ [key: string]: any }>({});

  const navigation = useNavigation();

  useEffect(() => {
    return () => {
      // Clear timeouts on unmount
      Object.values(tapTimeout.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('yendidii_favorites');
      const ids = raw ? JSON.parse(raw) : [];
      setSavedIds(ids);
    } catch (_) {}
  }, []);

  const toggleSaved = useCallback(async (listingId: string) => {
    try {
      const raw = await AsyncStorage.getItem('yendidii_favorites');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const isCurrentlySaved = ids.includes(listingId);
      const updated = isCurrentlySaved
        ? ids.filter(id => id !== listingId)
        : [...ids, listingId];
      await AsyncStorage.setItem('yendidii_favorites', JSON.stringify(updated));
      setSavedIds(updated);
    } catch (_) {}
  }, []);

  const handleCardPress = useCallback((itemId: string) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 250;
    if (lastTap.current[itemId] && (now - lastTap.current[itemId] < DOUBLE_PRESS_DELAY)) {
      if (tapTimeout.current[itemId]) {
        clearTimeout(tapTimeout.current[itemId]);
        delete tapTimeout.current[itemId];
      }
      toggleSaved(itemId);
      setAnimatingLikes(prev => ({ ...prev, [itemId]: true }));
      setTimeout(() => {
        setAnimatingLikes(prev => ({ ...prev, [itemId]: false }));
      }, 750);
    } else {
      lastTap.current[itemId] = now;
      tapTimeout.current[itemId] = setTimeout(() => {
        router.push(`/listing/${itemId}`);
        delete tapTimeout.current[itemId];
      }, DOUBLE_PRESS_DELAY);
    }
  }, [router, toggleSaved]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadFavorites();
    });
    return unsubscribe;
  }, [navigation, loadFavorites]);

  // -- Data Fetching --
  const { data: userData, refetch: refetchUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => supabase.auth.getUser().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const user = userData?.user;


  // Fetch profile for the name
  const { data: profileData, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, avatar_url')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const displayName = profileData?.full_name?.split(' ')[0] || storeName?.split(' ')[0] || 'Foodie';
  const greeting = useMemo(() => getGreeting(), []);

  // Poll for active order (Eater)
  const { data: activeOrder, refetch: refetchActiveOrder } = useQuery({
    queryKey: ['active-order'],
    queryFn: async () => {
      if (!user || isCookMode) return null; // Don't fetch eater orders in cook mode
      const { data } = await supabase
        .from('orders')
        .select(`*, order_items(listings(title, image, profiles(full_name)))`)
        .eq('user_id', user.id)
        .in('status', ['New', 'Accepted', 'Cooking', 'Ready'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return data;
    },
    enabled: !!user && !isCookMode
  });

  // Real-time listener for active orders to prevent scroll lag
  useEffect(() => {
    if (!user || isCookMode) return;

    const channel = supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        () => {
          // Wrap in requestAnimationFrame to prevent interrupting JS thread during scrolls
          requestAnimationFrame(() => {
            queryClient.invalidateQueries({ queryKey: ['active-order'] });
            queryClient.invalidateQueries({ queryKey: ['chef-stats'] });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isCookMode, queryClient]);

  // --- QUERIES ---

  const { refetch: refetchMealSessions } = useQuery({
    queryKey: ['meal-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_sessions')
        .select(`
          *,
          profiles:cook_id (full_name, avatar_url, rating, kitchen_image_url),
          listings:listing_id (title, price, image)
        `)
        .eq('status', 'open')
        .gte('session_date', new Date().toISOString().split('T')[0])
        .order('session_date', { ascending: true })
        .limit(5);

      if (error) {
        console.error('Error fetching sessions:', error);
        return [];
      }
      return data;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { refetch: refetchCookSessions } = useQuery({
    queryKey: ['cook-sessions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_sessions')
        .select(`
          *
        `)
        .eq('cook_id', user?.id)
        .order('session_date', { ascending: true });

      if (error) {
        console.error('Error fetching cook sessions:', error);
        return [];
      }
      return data;
    },
    enabled: !!user && isCookMode,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch Featured Meals (Cooking Now) — Real listings from cooks
  const { data: featuredMeals, isLoading: isLoadingMeals, refetch: refetchFeaturedMeals } = useQuery({
    queryKey: ['featured-meals', activeCategory],
    queryFn: async () => {
      let query = supabase
        .from('listings')
        .select('*, profiles(full_name, avatar_url, rating, kitchen_image_url)')
        .eq('available', true);

      if (activeCategory !== 'All') {
        query = query.ilike('category', `%${activeCategory}%`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Featured meals query error:', error);
        throw error;
      }
      return data;
    },
    enabled: !isCookMode,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch all available listings with cook profiles for thumbnails
  const { refetch: refetchAllListings } = useQuery({
    queryKey: ['all-listings-profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('listings')
        .select('*, profiles(full_name, avatar_url, rating, kitchen_image_url)')
        .eq('available', true)
        .limit(100);
      return data || [];
    },
    enabled: !isCookMode,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // CHEF DASHBOARD DATA
  const { data: chefStatsData, refetch: refetchChefStats } = useQuery({
    queryKey: ['chef-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('cook_id', user.id);

      if (error) throw error;
      if (!orders) return { revenue: 0, activeNow: 0, todayOrders: 0, completedCount: 0, totalCount: 0 };

      const completedOrders = orders.filter(o => o.status === 'Completed');
      const activeOrdersList = orders.filter(o => ['New', 'Accepted', 'Cooking', 'Ready'].includes(o.status));
      const revenue = completedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const uniqueCustomers = new Set(orders.map(o => o.user_id).filter(Boolean)).size;

      return {
        revenue,
        activeNow: activeOrdersList.length,
        todayOrders: uniqueCustomers,
        completedCount: completedOrders.length,
        totalCount: orders.length
      };
    },
    enabled: !!user && isCookMode,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
 
  // Fetch Cook's own Menu (Listings)
  const { data: myMenu, refetch: refetchMyMenu } = useQuery({
    queryKey: ['my-menu', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('cook_id', user.id)
        .or('archived.eq.false,archived.is.null');
      return data || [];
    },
    enabled: !!user && isCookMode,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const chefStats = chefStatsData || {
    todayOrders: 0,
    revenue: 0,
    activeNow: 0,
    completedCount: 0,
    totalCount: 0
  };

  // Fetch Recent Activity (Cook)
  const { data: recentActivity, refetch: refetchRecentActivity } = useQuery({
    queryKey: ['recent-activity', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          profiles:user_id (full_name),
          order_items (listings (title))
        `)
        .eq('cook_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4);

      return (orders || []).map(o => {
        // Handle joined data which might be array or object
        const profile = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
        const firstItem = Array.isArray(o.order_items) ? o.order_items[0] : o.order_items;
        const listing = firstItem?.listings;
        const actualListing = Array.isArray(listing) ? listing[0] : listing;

        return {
          id: o.id,
          type: 'order',
          title: o.status === 'New' ? 'New Order!' : `Order #${o.id.slice(0, 4)}`,
          subtitle: `${profile?.full_name || 'Customer'} • ${actualListing?.title || 'Meal'}`,
          time: o.created_at
        };
      });
    },
    enabled: !!user && isCookMode,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchUser(),
        refetchProfile(),
        refetchActiveOrder(),
        refetchMealSessions(),
        refetchCookSessions(),
        refetchFeaturedMeals(),
        refetchAllListings(),
        refetchChefStats(),
        refetchMyMenu(),
        refetchRecentActivity()
      ]);
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [
    refetchUser, refetchProfile, refetchActiveOrder, refetchMealSessions, 
    refetchCookSessions, refetchFeaturedMeals, refetchAllListings,
    refetchChefStats, refetchMyMenu, refetchRecentActivity
  ]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const { data: mainDishResults } = await supabase
        .from('listings')
        .select('*, profiles(full_name, avatar_url, rating, kitchen_image_url)')
        .ilike('title', `%${searchQuery}%`);

      setSearchResults(mainDishResults || []);
    } catch (err) {
      console.error(err);
    }
  }, [searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
  }, []);

  if (isCookMode) {
    const avatarUrl = (profileData as any)?.avatar_url;
    const completedCount = chefStats.completedCount;
    const totalCount = Math.max(chefStats.totalCount, 1);
    const progressPercent = Math.min(Math.round((completedCount / totalCount) * 100), 100);
    const ringRadius = 36;
    const ringCircumference = 2 * Math.PI * ringRadius;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF8F6' }} edges={['bottom']}>
        <View style={{ flex: 1, backgroundColor: '#FFF8F6' }}>

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 12, paddingBottom: 16, backgroundColor: '#FFF8F6' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#8A7269', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>Kitchen Dashboard</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: '#231915', letterSpacing: -0.3 }}>Chef {displayName}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FFF8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, borderWidth: 1, borderColor: '#B2DFCC' }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#006A3C' }} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#006A3C', letterSpacing: 1 }}>OPEN</Text>
                </View>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#F2DFD7', borderWidth: 2, borderColor: 'white' }} />
                ) : (
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#BF592B', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: 'white' }}>{displayName.charAt(0)}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BF592B" colors={['#BF592B']} />}
          >

            {/* Business Overview */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 14 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915' }}>Business Overview</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#BF592B' }}>View Orders</Text>
                <ChevronRight size={14} color="#BF592B" />
              </TouchableOpacity>
            </View>

            {/* Stats Cards */}
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 20 }}>
              {[
                { icon: TrendingUp, color: '#007A33', bg: '#F0FFF8', label: 'REVENUE', value: `₵${chefStats.revenue.toFixed(0)}` },
                { icon: ClockIcon, color: '#D65A31', bg: '#FFF1EC', label: 'ACTIVE', value: String(chefStats.activeNow) },
                { icon: UsersIcon, color: '#0066CC', bg: '#EFF6FF', label: 'CUSTOMERS', value: String(chefStats.todayOrders) },
              ].map(({ icon: Icon, color, bg, label, value }) => (
                <View key={label} style={{ flex: 1, backgroundColor: 'white', borderRadius: 20, padding: 14, shadowColor: '#231915', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F2DFD7' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Icon size={18} color={color} />
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#231915', marginBottom: 2 }}>{value}</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9, color: '#8A7269', letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Quick Actions */}
            <View style={{ marginHorizontal: 24, backgroundColor: '#84523C', borderRadius: 28, padding: 20, marginBottom: 20 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: 'white', textAlign: 'center', marginBottom: 16 }}>Quick Actions</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: 'white', borderRadius: 18, paddingVertical: 20, alignItems: 'center', gap: 10 }}
                  onPress={() => router.push('/(tabs)/cook')}
                  activeOpacity={0.85}
                >
                  <Plus size={24} color="#BF592B" />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#231915' }}>New Dish</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#FFCD00', borderRadius: 18, paddingVertical: 20, alignItems: 'center', gap: 10 }}
                  onPress={() => router.push('/(tabs)/cook')}
                  activeOpacity={0.85}
                >
                  <Flame size={24} color="#BF592B" fill="#BF592B" />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#231915' }}>New Session</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onPress={() => router.push('/(tabs)/explore/list')}
                activeOpacity={0.8}
              >
                <LayoutDashboard size={18} color="white" />
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: 'white' }}>Manage Menu</Text>
              </TouchableOpacity>
            </View>

            {/* Today's Progress */}
            <View style={{ marginHorizontal: 24, backgroundColor: '#FFF1EC', borderRadius: 24, padding: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#F2DFD7' }}>
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 90, height: 90 }}>
                <Svg width={90} height={90} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                  <Circle cx={45} cy={45} r={ringRadius} stroke="#F2DFD7" strokeWidth={9} fill="none" />
                  <Circle
                    cx={45} cy={45} r={ringRadius}
                    stroke="#84523C" strokeWidth={9} fill="none"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference * (1 - progressPercent / 100)}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#231915' }}>{progressPercent}%</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#231915', marginBottom: 4 }}>Today's Progress</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#56423B', marginBottom: 14 }}>
                  {completedCount} of {chefStats.totalCount} orders completed
                </Text>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <View key={i} style={{ height: 5, flex: 1, borderRadius: 3, backgroundColor: i < Math.ceil(progressPercent / 20) ? '#84523C' : '#DDC1B6' }} />
                  ))}
                </View>
              </View>
            </View>

            {/* My active Menu */}
            <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915' }}>My active Menu</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/cook')}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#BF592B' }}>+ Add Dish</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(myMenu || []).slice(0, 1).map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={{ flex: 1, backgroundColor: 'white', borderRadius: 20, overflow: 'hidden', shadowColor: '#231915', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F2DFD7' }}
                    onPress={() => router.push(`/listing/${item.id}`)}
                    activeOpacity={0.85}
                  >
                    <Image source={getDishImage(item.title, item.image)} style={{ width: '100%', height: 120 }} resizeMode="cover" />
                    <View style={{ padding: 12 }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#231915', marginBottom: 4 }} numberOfLines={2}>{item.title}</Text>
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#BF592B' }}>₵{item.price}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {(!myMenu || myMenu.length === 0) && (
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'white', borderRadius: 20, overflow: 'hidden', shadowColor: '#231915', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F2DFD7', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}
                    onPress={() => router.push('/(tabs)/cook')}
                    activeOpacity={0.85}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#DDC1B6', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <Plus size={20} color="#8A7269" />
                    </View>
                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#8A7269', textAlign: 'center' }}>Add your first{'\n'}dish</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: 'white', borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: '#DDC1B6', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}
                  onPress={() => router.push('/(tabs)/cook')}
                  activeOpacity={0.75}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#DDC1B6', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Plus size={18} color="#8A7269" />
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#8A7269', textAlign: 'center' }}>Add another{'\n'}dish</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recent Activity */}
            <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915', marginBottom: 14 }}>Recent Activity</Text>
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((activity: any) => (
                  <View key={activity.id} style={{ backgroundColor: 'white', borderRadius: 18, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#F2DFD7', shadowColor: '#231915', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF1EC', alignItems: 'center', justifyContent: 'center' }}>
                      <ShoppingBag size={18} color="#BF592B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#231915' }}>{activity.title}</Text>
                      <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#8A7269', marginTop: 2 }}>{activity.subtitle}</Text>
                    </View>
                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#8A7269' }}>
                      {activity.time ? (() => {
                        try {
                          const d = new Date(activity.time);
                          return isNaN(d.getTime()) ? 'Recently' : formatDistanceToNow(d) + ' ago';
                        } catch { return 'Recently'; }
                      })() : 'Recently'}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#DDC1B6' }}>
                  <ShoppingBag size={32} color="#DDC1B6" />
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#8A7269', marginTop: 10, textAlign: 'center' }}>No activity yet. Your first order is coming!</Text>
                </View>
              )}
            </View>

          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // --- EATER VIEW (DEFAULT) ---

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF8F6' }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Sticky Top Bar */}
        <View style={{ backgroundColor: '#FFF8F6', paddingHorizontal: 20, paddingVertical: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <View />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => router.push('/cart')} style={{ position: 'relative' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 22, 
                backgroundColor: 'rgba(191, 89, 43, 0.15)', 
                alignItems: 'center', 
                justifyContent: 'center',
                shadowColor: '#231915',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2
              }}>
                <ShoppingCart size={20} color="#BF592B" />
              </View>
              {cartCount > 0 && (
                <View style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#BF592B', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#BF592B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 2 }}>
                  <Text style={{ color: 'white', fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold' }}>{cartCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => router.push('/notifications')} style={{ position: 'relative' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 22, 
                backgroundColor: 'rgba(191, 89, 43, 0.15)', 
                alignItems: 'center', 
                justifyContent: 'center',
                shadowColor: '#231915',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2
              }}>
                <Bell size={20} color="#BF592B" />
              </View>
              {activeOrder && (
                <View style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#BA1A1A', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#BA1A1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 2 }}>
                  <Text style={{ color: 'white', fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold' }}>1</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BF592B" colors={['#BF592B']} />}
        >
          {/* Greeting */}
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#56423B', opacity: 0.8 }}>{greeting}</Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: '#231915', letterSpacing: -0.4, marginTop: 2 }}>
              {displayName} <Text style={{ fontSize: 24 }}>👋🏾</Text>
            </Text>
          </View>

          {/* Search Bar */}
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 14, borderWidth: 1.5, borderColor: '#DDC1B6', paddingHorizontal: 14, height: 52, shadowColor: '#231915', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <Search size={18} color="#8A7269" />
              <TextInput
                placeholder="Craving Jollof, Waakye..."
                placeholderTextColor="#8A7269"
                value={searchQuery}
                onChangeText={(t) => { setSearchQuery(t); if (t.length > 2) handleSearch(); if (t.length === 0) clearSearch(); }}
                onSubmitEditing={handleSearch}
                style={{ flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#231915', paddingHorizontal: 10 }}
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity onPress={clearSearch} style={{ padding: 4 }}>
                  <X size={16} color="#8A7269" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => router.push('/address')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MapPin size={18} color="#BF592B" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Active Order Banner */}
          {activeOrder && activeOrder.id !== dismissedOrderId && (
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <TouchableOpacity
                style={{ backgroundColor: '#F0FFF8', borderRadius: 16, borderWidth: 1, borderColor: '#B2DFCC', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                onPress={() => router.push('/(tabs)/orders')}
                activeOpacity={0.8}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,106,60,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <ChefHat size={20} color="#006A3C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#231915' }} numberOfLines={1}>
                    {activeOrder.order_items?.[0]?.listings?.title || 'Your Order'}
                  </Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#006A3C', marginTop: 1 }}>{getStatusText(activeOrder.status)}</Text>
                </View>
                <TouchableOpacity onPress={() => setDismissedOrderId(activeOrder.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={16} color="#8A7269" />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          )}

          {/* Category Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 32 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.name;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setActiveCategory(cat.name)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, backgroundColor: isActive ? '#BF592B' : '#FFF1EC', borderWidth: 1.5, borderColor: isActive ? '#BF592B' : '#DDC1B6', shadowColor: '#BF592B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isActive ? 0.2 : 0, shadowRadius: 6, elevation: isActive ? 3 : 0 }}
                >
                  {(() => {
                    const IconComponent = ICON_MAP[cat.icon];
                    if (IconComponent) {
                      return <IconComponent size={14} color={isActive ? 'white' : '#BF592B'} />;
                    }
                    return null;
                  })()}
                  <Text style={{ fontFamily: isActive ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium', fontSize: 13, color: isActive ? 'white' : '#56423B' }}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* SEARCH RESULTS */}
          {isSearching && searchQuery ? (
            <View style={{ paddingHorizontal: 20 }}>
              {searchResults.length === 0 ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF1EC', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <Search size={36} color="#BF592B" />
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#231915', marginBottom: 8, textAlign: 'center' }}>Looking around...</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#56423B', textAlign: 'center' }}>
                    Scanning nearby kitchens for{' '}
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#BF592B' }}>{searchQuery}</Text>
                  </Text>
                </View>
              ) : (
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#231915' }}>
                      {searchResults.length} {searchResults.length === 1 ? 'dish found' : 'dishes found'}
                    </Text>
                    <TouchableOpacity onPress={clearSearch} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F2DFD7', borderRadius: 9999 }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#56423B' }}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  {searchResults.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={{ backgroundColor: 'white', borderRadius: 20, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#F2DFD7', shadowColor: '#231915', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }}
                      onPress={() => router.push(`/listing/${item.id}`)}
                    >
                      <Image source={{ uri: (item.image && item.image.includes(',') ? item.image.split(',')[0].trim() : item.image) || 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400' }} style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: '#F2DFD7' }} resizeMode="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: '#231915', marginBottom: 4 }} numberOfLines={2}>{item.title}</Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#56423B' }}>by {item.profiles?.full_name || 'Local Cook'}</Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#BF592B', marginTop: 4 }}>₵{item.price}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            /* DEFAULT BROWSE VIEW */
            <View>

              {/* Featured Bento Card */}
              {isLoadingMeals ? (
                <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                  <ActivityIndicator color="#BF592B" />
                </View>
              ) : (featuredMeals || []).length > 0 && (
                <View style={{ marginBottom: 36 }}>
                  {(featuredMeals || []).slice(0, 2).map((hero: any) => (
                    <View
                      key={`hero-wrapper-${hero.id}`}
                      style={{
                        marginHorizontal: 16,
                        marginBottom: 36,
                        shadowColor: '#231915',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.1,
                        shadowRadius: 18,
                        elevation: 6
                      }}
                    >
                      <Pressable
                        style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
                        onPress={() => handleCardPress(hero.id)}
                      >
                        <View style={{ backgroundColor: 'white', borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: '#F2DFD7' }}>
                          <View style={{ position: 'relative', height: 256 }}>
                            <Image source={getDishImage(hero.title || hero.name, hero.image)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            <AnimatedHeartOverlay visible={!!animatingLikes[hero.id]} />
                          </View>
                          <View style={{ padding: 16, paddingBottom: 22 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#231915' }} numberOfLines={1}>{hero.title || hero.name}</Text>
                              <TouchableOpacity onPress={() => toggleSaved(hero.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                <Heart size={22} color={savedIds.includes(hero.id) ? '#BF592B' : '#8A7269'} fill={savedIds.includes(hero.id) ? '#BF592B' : 'transparent'} strokeWidth={1.5} />
                              </TouchableOpacity>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Flame size={13} color="#BA1A1A" fill="#BA1A1A" />
                                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#BA1A1A' }}>{hero.portions_available} left</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <ClockIcon size={13} color="#56423B" />
                                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#56423B' }}>{hero.prep_time_minutes || 30}m prep</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Loved Foods */}
              {(featuredMeals || []).length > 1 && (
                <View style={{ marginBottom: 28 }}>
                  {/* Section header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 16, marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Heart size={18} color="#BF592B" fill="#BF592B" />
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915' }}>Loved Foods</Text>
                    </View>
                    <Pressable onPress={() => router.push('/(tabs)/explore/list')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#BF592B' }}>See all</Text>
                    </Pressable>
                  </View>

                  {/* Row 1 — big cards (70% width) */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 4 }}
                    decelerationRate="fast"
                    style={{ marginBottom: 14 }}
                  >
                    {(featuredMeals || []).slice(2, 5).map((hItem: any) => (
                      <View
                        key={`big-wrapper-${hItem.id}`}
                        style={{
                          width: width * 0.7,
                          shadowColor: '#231915', 
                          shadowOffset: { width: 0, height: 4 }, 
                          shadowOpacity: 0.08, 
                          shadowRadius: 12, 
                          elevation: 4 
                        }}
                      >
                        <Pressable
                          style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                          onPress={() => handleCardPress(hItem.id)}
                        >
                          <View style={{ backgroundColor: 'white', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#F2DFD7' }}>
                            <View style={{ height: 160, position: 'relative' }}>
                              <Image source={getDishImage(hItem.title || hItem.name, hItem.image)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                              <TouchableOpacity
                                style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' }}
                                onPress={() => toggleSaved(hItem.id)}
                              >
                                <Heart size={14} color="#BF592B" fill={savedIds.includes(hItem.id) ? '#BF592B' : 'transparent'} />
                              </TouchableOpacity>
                              <AnimatedHeartOverlay visible={!!animatingLikes[hItem.id]} />
                            </View>
                            <View style={{ padding: 12 }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#231915', marginBottom: 5 }} numberOfLines={1}>{hItem.title || hItem.name}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Flame size={12} color="#BA1A1A" fill="#BA1A1A" />
                                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#BA1A1A' }}>{hItem.portions_available} left</Text>
                                <Text style={{ color: '#DDC1B6', marginHorizontal: 2 }}>·</Text>
                                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#8A7269' }}>Top Rated This Week</Text>
                              </View>
                            </View>
                          </View>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>

                  {/* Row 2 — small compact cards (43% width) */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 4 }}
                    decelerationRate="fast"
                  >
                    {(featuredMeals || []).slice(5, 10).map((hItem: any, idx: number) => (
                      <View
                        key={`small-wrapper-${hItem.id}`}
                        style={{
                          width: width * 0.43,
                          shadowColor: '#231915', 
                          shadowOffset: { width: 0, height: 3 }, 
                          shadowOpacity: 0.07, 
                          shadowRadius: 10, 
                          elevation: 3 
                        }}
                      >
                        <Pressable
                          style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                          onPress={() => handleCardPress(hItem.id)}
                        >
                          <View style={{ backgroundColor: 'white', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#F2DFD7' }}>
                            <View style={{ height: 130, position: 'relative' }}>
                              <Image source={getDishImage(hItem.title || hItem.name, hItem.image)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                              <TouchableOpacity
                                style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' }}
                                onPress={() => toggleSaved(hItem.id)}
                              >
                                <Heart size={12} color="#BF592B" fill={savedIds.includes(hItem.id) ? '#BF592B' : 'transparent'} />
                              </TouchableOpacity>
                              <AnimatedHeartOverlay visible={!!animatingLikes[hItem.id]} />
                            </View>
                            <View style={{ padding: 10 }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#231915', marginBottom: 4 }} numberOfLines={1}>{hItem.title || hItem.name}</Text>
                              {idx === 0 ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: '#FFF1EC', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9999 }}>
                                  <Star size={9} color="#BF592B" fill="#BF592B" />
                                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#BF592B' }}>New</Text>
                                </View>
                              ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <Flame size={10} color="#BA1A1A" fill="#BA1A1A" />
                                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: '#BA1A1A' }}>{hItem.portions_available} left</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Fastest Delivery */}
              <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915', marginBottom: 12 }}>Fastest Delivery</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[
                    { icon: Zap, color: '#BF592B', bg: 'rgba(191,89,43,0.1)', label: 'Quick Bites', time: '15-20 min' },
                    { icon: Leaf, color: '#006A3C', bg: 'rgba(0,106,60,0.1)', label: 'Healthy', time: '25-30 min' },
                  ].map(({ icon: Icon, color, bg, label, time }) => (
                    <TouchableOpacity
                      key={label}
                      style={{ flex: 1, backgroundColor: '#FFF1EC', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#DDC1B6' }}
                      onPress={() => router.push('/(tabs)/explore/list')}
                      activeOpacity={0.8}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={20} color={color} />
                      </View>
                      <View>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#231915' }}>{label}</Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#8A7269', marginTop: 1 }}>{time}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* More Dishes — vertical + grid */}
              {(featuredMeals || []).length > 6 && (
                <View style={{ paddingHorizontal: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Flame size={18} color="#BF592B" fill="#BF592B" />
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#231915' }}>Popular Near You</Text>
                    </View>
                    <Pressable onPress={() => router.push('/(tabs)/explore/list')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#BF592B' }}>See all</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {(featuredMeals || []).slice(6, 12).map((item: any) => (
                      <View
                        key={`grid-wrapper-${item.id}`}
                        style={{
                          width: '47%',
                          shadowColor: '#231915', 
                          shadowOffset: { width: 0, height: 3 }, 
                          shadowOpacity: 0.07, 
                          shadowRadius: 10, 
                          elevation: 3 
                        }}
                      >
                        <Pressable
                          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                          onPress={() => handleCardPress(item.id)}
                        >
                          <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: 'white', borderWidth: 1, borderColor: '#F2DFD7' }}>
                            <View style={{ position: 'relative', height: 140 }}>
                              <Image source={getDishImage(item.title || item.name, item.image)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                              <TouchableOpacity style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }} onPress={() => toggleSaved(item.id)}>
                                <Heart size={13} color="#BF592B" fill={savedIds.includes(item.id) ? '#BF592B' : 'transparent'} />
                              </TouchableOpacity>
                              <AnimatedHeartOverlay visible={!!animatingLikes[item.id]} />
                            </View>
                            <View style={{ padding: 10 }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#231915', marginBottom: 4 }} numberOfLines={1}>{item.title || item.name}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <Flame size={10} color="#BA1A1A" fill="#BA1A1A" />
                                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: '#BA1A1A' }}>{item.portions_available} left</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <ClockIcon size={10} color="#8A7269" />
                                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: '#56423B' }}>{item.prep_time_minutes || 30}m</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              )}

            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ProcessLoader 
        visible={refreshing} 
        message="Refreshing Menu..."
      />
    </SafeAreaView>
  );
}
