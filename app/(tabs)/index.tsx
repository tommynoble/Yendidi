import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, MapPin, Clock, Star, Sparkles, ChevronRight, X, Bell, LayoutDashboard, TrendingUp, Users as UsersIcon, Clock as ClockIcon, ShoppingCart, Loader2, Plus, Flame, ChefHat, Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { format, formatDistanceToNow } from 'date-fns';

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

export default function HomeScreen() {
  const router = useRouter();
  const { isCookMode, userName: storeName, cartItems, addToCart } = useAppStore();
  const cartCount = cartItems.reduce((sum, ci) => sum + ci.quantity, 0);
  const queryClient = useQueryClient();

  // -- State --
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('East Legon');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedOrderId, setDismissedOrderId] = useState<string | null>(null);

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
        .select('full_name, role')
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

  const { data: mealSessions, isLoading: isLoadingSessions, refetch: refetchMealSessions } = useQuery({
    queryKey: ['meal-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_sessions')
        .select(`
          *,
          profiles:cook_id (full_name, avatar_url, rating),
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

  const { data: cookSessions, isLoading: isLoadingCookSessions, refetch: refetchCookSessions } = useQuery({
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
    enabled: !!user && isCookMode
  });

  // Fetch Featured Meals (Cooking Now) — Real listings from cooks
  const { data: featuredMeals, isLoading: isLoadingMeals, error: featuredMealsError, refetch: refetchFeaturedMeals } = useQuery({
    queryKey: ['featured-meals', activeCategory],
    queryFn: async () => {
      let query = supabase
        .from('listings')
        .select('*, profiles(full_name, avatar_url, rating)')
        .eq('available', true);

      if (activeCategory !== 'All') {
        query = query.eq('category', activeCategory);
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
  const { data: allListings, refetch: refetchAllListings } = useQuery({
    queryKey: ['all-listings-profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('listings')
        .select('*, profiles(full_name, avatar_url, rating)')
        .eq('available', true);
      return data || [];
    },
    enabled: !isCookMode,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Helper to get cook avatars for a given main dish name
  const getCooksForDish = (dishName: string) => {
    if (!allListings || !dishName) return [];
    const keyword = dishName.split(' ')[0].toLowerCase();
    return allListings.filter((l: any) => l.title?.toLowerCase().includes(keyword));
  };

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
      if (!orders) return { revenue: 0, activeNow: 0, todayOrders: 0 };

      const completedOrders = orders.filter(o => o.status === 'Completed');
      const activeOrdersList = orders.filter(o => ['New', 'Accepted', 'Cooking', 'Ready'].includes(o.status));
      const revenue = completedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const uniqueCustomers = new Set(orders.map(o => o.user_id).filter(Boolean)).size;

      return {
        revenue,
        activeNow: activeOrdersList.length,
        todayOrders: uniqueCustomers
      };
    },
    enabled: !!user && isCookMode
  });
 
  // Fetch Cook's own Menu (Listings)
  const { data: myMenu, refetch: refetchMyMenu } = useQuery({
    queryKey: ['my-menu', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('cook_id', user.id);
      return data || [];
    },
    enabled: !!user && isCookMode
  });

  const chefStats = chefStatsData || {
    todayOrders: 0,
    revenue: 0,
    activeNow: 0
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
    enabled: !!user && isCookMode
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
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
    setRefreshing(false);
  }, [
    refetchUser, refetchProfile, refetchActiveOrder, refetchMealSessions, 
    refetchCookSessions, refetchFeaturedMeals, refetchAllListings,
    refetchChefStats, refetchMyMenu, refetchRecentActivity
  ]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    // Explicitly set results to empty while loading to trigger the loading state
    setSearchResults([]);

    try {
      // Fake delay for the "Searching for Cooks" animation to shine (optional, but requested for the feel)
      await new Promise(resolve => setTimeout(resolve, 800));

      const { data: mainDishResults } = await supabase
        .from('listings')
        .select('*, profiles(full_name, avatar_url, rating)')
        .ilike('title', `%${searchQuery}%`);

      setSearchResults(mainDishResults || []);
    } catch (err) {
      console.error(err);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
  };

  const handleQuickAdd = (item: any) => {
    addToCart({
      id: item.id,
      name: item.title,
      image: item.image,
      price: item.price,
      cookId: item.cook_id,
      cookName: item.profiles?.full_name || 'Chef',
    }, 1);

    Alert.alert(
      "Added to Cart! 🛒",
      `1x ${item.title} added to your cart.`,
      [
        { text: "Keep Browsing", style: "cancel" },
        { text: "View Cart", onPress: () => router.push('/cart') },
      ]
    );
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Accepted': return 'Order accepted';
      case 'Cooking': return 'Preparing your meal';
      case 'Ready': return 'Ready for pickup!';
      case 'Completed': return 'Enjoy your meal!';
      default: return 'Processing';
    }
  };

  const CATEGORIES = [
    { id: '1', name: 'All' },
    { id: '2', name: 'Rice Dishes' },
    { id: '4', name: 'Soups & Stews' },
    { id: '5', name: 'Grills & Kebabs' },
    { id: '6', name: 'Traditional Snacks' },
    { id: '7', name: 'Seafood' },
    { id: '8', name: 'Pastries' }
  ];

  const SOCIAL_PROOFS = [
    'Popular tonight',
    'Trending near you',
    '12 orders in the last hour',
    'High demand',
    'Top rated dish',
    'People ordered recently'
  ];

  const getDynamicSocialProof = (id: string) => {
    // Deterministic but feels random based on ID
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % SOCIAL_PROOFS.length;
    return SOCIAL_PROOFS[index];
  };

  // --- RENDER ---

  const MealDropCard = ({ session }: { session: any }) => {
    const progress = (session.filled_slots / session.total_slots) * 100;

    return (
      <TouchableOpacity
        className="w-[340px] bg-white rounded-[32px] mr-4 shadow-sm overflow-hidden border border-gray-100"
        activeOpacity={0.9}
        onPress={() => router.push(`/session/${session.id}`)}
      >
        <View className="flex-row h-40">
          {/* Left Content */}
          <View className="flex-1 p-5 justify-between">
            <View>
              <View className="flex-row items-center gap-2 mb-2">
                <Image
                  source={{ uri: session.profiles?.avatar_url || 'https://via.placeholder.com/24' }}
                  className="w-6 h-6 rounded-full"
                />
                <View>
                  <Text className="font-bold text-text-main text-sm font-sans-bold leading-tight" numberOfLines={1}>
                    {session.listings?.title || session.title}
                  </Text>
                  <Text className="text-[10px] text-text-sub font-sans">by {session.profiles?.full_name}</Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2.5 mb-1.5">
                <View className="flex-row items-center gap-1">
                  <Star size={12} color="#D97706" fill="#D97706" />
                  <Text className="text-[11px] font-bold text-text-main font-sans-bold">{session.profiles?.rating || '4.8'}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <UsersIcon size={12} color="#6D6D6D" />
                  <Text className="text-[11px] text-text-sub font-sans">{session.profiles?.served_count || 0} served</Text>
                </View>
              </View>

              <View className="flex-row items-center gap-1.5 mb-2.5">
                <ClockIcon size={12} color="#6D6D6D" />
                <Text className="text-[11px] text-text-sub font-sans">Ready at {session.start_time.slice(0, 5)}</Text>
              </View>

              <View className="bg-orange-50 self-start px-2 py-1 rounded-lg flex-row items-center gap-1 border border-orange-100/50">
                <Flame size={12} color="#D65A31" fill="#D65A31" />
                <Text className="text-[10px] text-clay-primary font-bold font-sans-bold">Filling fast!</Text>
              </View>
            </View>
          </View>

          {/* Right Image with Fade */}
          <View className="w-32 relative">
            <Image
              source={{ uri: session.listings?.image || 'https://i.imgur.com/yF9WbdD.png' }}
              className="w-full h-full object-cover"
            />
            <LinearGradient
              colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 0.3, y: 0.5 }}
              className="absolute inset-0"
            />
          </View>
        </View>

        {/* Bottom Bar */}
        <View className="px-5 py-3 border-t border-gray-50 flex-row items-center justify-between">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-lg font-bold text-text-main font-sans-bold">₵{session.price_per_plate}</Text>
          </View>

          <View className="flex-1 mx-4">
            <Text className="text-[10px] text-text-sub font-sans mb-1 text-center">Plates reserved</Text>
            <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <View
                className="h-full bg-[#007A33]"
                style={{ width: `${progress}%` }}
              />
            </View>
          </View>

          <TouchableOpacity
            className="bg-clay-primary px-4 py-2 rounded-xl"
            onPress={() => router.push(`/session/${session.id}`)}
          >
            <Text className="text-white text-xs font-bold font-sans-bold text-center">Reserve Spot</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (isCookMode) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="flex-1 bg-warm-cream">
        <View className="px-6 pt-3 pb-4 bg-white border-b border-gray-100">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-text-sub text-xs font-medium mb-0.5 font-sans">Kitchen Dashboard</Text>
              <Text className="text-text-main text-xl font-bold font-sans-bold">
                Chef {displayName}
              </Text>
            </View>
            <View className="bg-kente-yellow/10 px-3 py-1.5 rounded-full flex-row items-center gap-2 border border-kente-yellow/20">
              <View className="w-2 h-2 rounded-full bg-kente-yellow shadow-sm" />
              <Text className="text-clay-primary text-[10px] font-bold tracking-widest uppercase">OPEN</Text>
            </View>
          </View>
        </View>

        <ScrollView 
          className="flex-1 p-6" 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D65A31" colors={["#D65A31"]} />
          }
        >

          {/* Business Overview Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-text-main font-sans-bold">Business Overview</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
              <Text className="text-clay-primary text-xs font-bold font-sans-bold">View Orders</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Cards */}
          <View className="flex-row gap-3 mb-8">
            <View className="flex-1 bg-white p-4 rounded-[24px] shadow-sm border border-gray-50">
              <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center mb-3">
                <TrendingUp size={20} color="#007A33" />
              </View>
              <Text className="text-2xl font-bold text-text-main font-sans-bold">₵{chefStats.revenue.toFixed(0)}</Text>
              <Text className="text-[10px] text-text-sub font-sans-medium mt-0.5 uppercase tracking-wider">Revenue</Text>
            </View>
            <View className="flex-1 bg-white p-4 rounded-[24px] shadow-sm border border-gray-50">
              <View className="w-10 h-10 bg-orange-50 rounded-full items-center justify-center mb-3">
                <ClockIcon size={20} color="#D65A31" />
              </View>
              <Text className="text-2xl font-bold text-text-main font-sans-bold">{chefStats.activeNow}</Text>
              <Text className="text-[10px] text-text-sub font-sans-medium mt-0.5 uppercase tracking-wider">Active</Text>
            </View>
            <View className="flex-1 bg-white p-4 rounded-[24px] shadow-sm border border-gray-50">
              <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mb-3">
                <UsersIcon size={20} color="#0066CC" />
              </View>
              <Text className="text-2xl font-bold text-text-main font-sans-bold">{chefStats.todayOrders}</Text>
              <Text className="text-[10px] text-text-sub font-sans-medium mt-0.5 uppercase tracking-wider">Customers</Text>
            </View>
          </View>

          {/* Quick Actions Grid */}
          <View className="bg-clay-primary rounded-[32px] p-6 mb-8 shadow-md">
            <Text className="text-white font-bold text-lg mb-5 font-sans-bold text-center">Quick Actions</Text>
            <View className="flex-row flex-wrap gap-4">
              <TouchableOpacity
                className="flex-1 min-w-[120px] bg-white rounded-2xl p-5 items-center shadow-sm active:scale-95"
                onPress={() => router.push('/(tabs)/cook')}
              >
                <View className="w-12 h-12 bg-orange-50 rounded-full items-center justify-center mb-3">
                  <Plus size={24} color="#D65A31" />
                </View>
                <Text className="text-text-main font-bold text-sm font-sans-bold">New Dish</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 min-w-[120px] bg-kente-yellow rounded-2xl p-5 items-center shadow-sm active:scale-95"
                onPress={() => router.push('/(tabs)/cook')}
              >
                <View className="w-12 h-12 bg-white/30 rounded-full items-center justify-center mb-3">
                  <Flame size={24} color="#D65A31" fill="#D65A31" />
                </View>
                <Text className="text-clay-primary font-bold text-sm font-sans-bold">New Session</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="w-full bg-white/10 rounded-2xl py-4 flex-row items-center justify-center gap-3 border border-white/20 active:bg-white/20"
                onPress={() => router.push('/(tabs)/explore/list')}
              >
                <LayoutDashboard size={20} color="white" />
                <Text className="text-white font-bold text-sm font-sans-bold">Manage Menu</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Meal Drops (Cook View) */}
          {cookSessions && cookSessions.length > 0 && (
            <View className="mb-8">
              <Text className="text-lg font-bold text-text-main mb-4 font-sans-bold">Active Meal Drops</Text>
              {cookSessions.map((session: any) => (
                <TouchableOpacity
                  key={session.id}
                  className="bg-white p-5 rounded-3xl shadow-sm mb-4 border border-orange-50 flex-row items-center gap-4"
                  onPress={() => router.push(`/session/${session.id}`)}
                >
                  <View className="w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center">
                    <Flame size={24} color="#D65A31" fill="#D65A31" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-text-main text-base font-sans-bold mb-1">{session.title}</Text>
                    <Text className="text-xs text-text-sub font-sans">
                      {(function() {
                        try {
                          const date = new Date(session.session_date);
                          return isNaN(date.getTime()) ? 'Today' : format(date, 'MMM d');
                        } catch (e) {
                          return 'Today';
                        }
                      })()} • {session.filled_slots}/{session.total_slots} joined
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#D65A31" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* My Menu Section */}
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-text-main font-sans-bold">My active Menu</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/cook')}>
                <Text className="text-clay-primary text-xs font-bold font-sans-bold">+ Add Dish</Text>
              </TouchableOpacity>
            </View>
            {myMenu && myMenu.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
                {myMenu.map((item: any) => (
                  <View key={item.id} className="w-40 bg-white rounded-2xl mr-4 p-3 shadow-sm border border-gray-100">
                    {item.image ? (
                      <Image source={{ uri: item.image }} className="w-full h-24 rounded-xl mb-2 bg-gray-50" resizeMode="cover" />
                    ) : (
                      <View className="w-full h-24 rounded-xl mb-2 bg-gray-100 items-center justify-center">
                        <Text style={{ fontSize: 28 }}>🍽️</Text>
                      </View>
                    )}
                    <Text className="font-bold text-text-main text-xs font-sans-bold" numberOfLines={1}>{item.title}</Text>
                    <Text className="text-clay-primary font-bold text-xs mt-1">₵{item.price}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View className="bg-white/50 p-6 rounded-2xl border border-dashed border-gray-200 items-center">
                <Text className="text-text-sub text-xs font-sans">No listings yet. Post your first dish!</Text>
              </View>
            )}
          </View>

          {/* Recent Activity */}
          <Text className="text-lg font-bold text-text-main mb-4 font-sans-bold">Recent Activity</Text>
          {recentActivity && recentActivity.length > 0 ? (
            recentActivity.map((activity: any) => (
              <View key={activity.id} className="bg-white p-4 rounded-2xl shadow-sm mb-3 border border-gray-50 flex-row items-center gap-4">
                <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                  <Star size={18} color="#D65A31" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-text-main font-sans-bold">{activity.title}</Text>
                  <Text className="text-xs text-text-sub font-sans mt-0.5">{activity.subtitle}</Text>
                </View>
                <Text className="text-[10px] text-text-sub font-sans-medium">
                  {activity.time ? (function() {
                    try {
                      const date = new Date(activity.time);
                      return isNaN(date.getTime()) ? 'Recently' : formatDistanceToNow(date) + ' ago';
                    } catch (e) {
                      return 'Recently';
                    }
                  })() : 'Recently'}
                </Text>
              </View>
            ))
          ) : (
            <View className="bg-white p-8 rounded-3xl shadow-sm items-center border border-dashed border-gray-200">
              <LayoutDashboard size={32} color="#9CA3AF" />
              <Text className="text-text-sub text-sm font-sans mt-3">No activity yet. Your first order is coming!</Text>
            </View>
          )}

        </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // --- EATER VIEW (DEFAULT) ---
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-1 bg-warm-cream">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">

        {/* Header */}
        <View className="px-6 pt-3 pb-4 bg-white">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-text-sub text-xs font-medium mb-0.5 font-sans">{greeting}</Text>
              <Text className="text-text-main text-xl font-bold font-sans-bold">
                {displayName} <Text className="text-xl">👋🏾</Text>
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              {/* Cart Icon */}
              <Pressable 
                onPress={() => router.push('/cart')} 
                className="relative"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View className="w-9 h-9 bg-[#FFF9F5] border border-[#FFEDD5] shadow-sm rounded-full items-center justify-center" style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
                  <ShoppingCart size={18} color="#D65A31" />
                </View>
                {cartCount > 0 && (
                  <View className="absolute -top-1 -right-1 w-4 h-4 bg-clay-primary rounded-full border-2 border-white items-center justify-center">
                    <Text className="text-[9px] text-white font-bold">{cartCount}</Text>
                  </View>
                )}
              </Pressable>
              {/* Notification Bell */}
              <Pressable 
                onPress={() => router.push('/notifications')} 
                className="relative"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View className="w-9 h-9 bg-[#FFF9F5] border border-[#FFEDD5] shadow-sm rounded-full items-center justify-center" style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
                  <Bell size={18} color="#D65A31" />
                </View>
                {/* Badge only shown if there are accepted/cooking/ready orders */}
                {activeOrder && activeOrder.status !== 'New' && (
                  <View className="absolute -top-1 -right-1 w-4 h-4 bg-kente-red rounded-full border-2 border-white items-center justify-center">
                    <Text className="text-[9px] text-white font-bold">1</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Minimal Search & Location Row */}
          <View className="flex-row items-center gap-3 mt-1 pb-1">
            {/* Search Box */}
            <View className="flex-1 bg-white rounded-full px-5 py-3.5 flex-row items-center gap-3 border border-gray-100 shadow-sm" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
              <Search size={20} color="#9CA3AF" />
              <TextInput
                placeholder="Craving Jollof, Waakye..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={(t) => {
                  setSearchQuery(t);
                  if (t.length > 2) handleSearch();
                  if (t.length === 0) clearSearch();
                }}
                onSubmitEditing={handleSearch}
                className="flex-1 text-text-main font-sans text-base h-6"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} className="bg-gray-100 rounded-full p-1">
                  <X size={14} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>

            {/* Location Button */}
            <Pressable
              className="bg-white rounded-full w-12 h-12 border border-gray-100 items-center justify-center shadow-sm"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
              onPress={() => router.push('/address')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MapPin size={22} color="#D65A31" />
            </Pressable>
          </View>
        </View>

        {/* Active Order Banner */}
        {activeOrder && activeOrder.id !== dismissedOrderId && (
          <View className="px-6 bg-white pb-4">
            <View className="bg-kente-green/10 rounded-2xl border border-kente-green/20 overflow-hidden">
              <TouchableOpacity
                className="p-4 flex-row items-center gap-3"
                onPress={() => router.push(`/(tabs)/orders`)}
                activeOpacity={0.8}
              >
                {activeOrder.order_items?.[0]?.listings?.image ? (
                  <Image source={{ uri: activeOrder.order_items[0].listings.image }} className="w-10 h-10 rounded-full" />
                ) : (
                  <View className="w-10 h-10 rounded-full bg-kente-green/20 items-center justify-center">
                    <ChefHat size={20} color="#007A33" />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="font-bold text-text-main text-sm" numberOfLines={1}>
                    {activeOrder.order_items?.[0]?.listings?.title || 'Your Order'}
                  </Text>
                  <Text className="text-kente-green text-xs font-semibold">{getStatusText(activeOrder.status)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDismissedOrderId(activeOrder.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  className="w-7 h-7 bg-black/5 rounded-full items-center justify-center ml-1"
                >
                  <X size={14} color="#6B7280" />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D65A31" colors={["#D65A31"]} />
          }
        >

          <View className="px-6 pt-6">

            {/* Categories */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-6 px-6 pb-2 pt-1">
              {CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.name;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setActiveCategory(cat.name)}
                    className={`mr-3 px-5 py-2.5 rounded-full ${isActive ? 'bg-clay-primary border-transparent' : 'bg-white border border-gray-100'}`}
                    style={({ pressed }) => ({ 
                      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isActive ? 0.15 : 0.05, shadowRadius: 6, elevation: isActive ? 4 : 2,
                      opacity: pressed ? 0.8 : 1
                    })}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Text className={`${isActive ? 'font-sans-bold text-white' : 'font-sans-medium text-text-sub'}`}>
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* DYNAMIC CONTENT AREA */}
            {isSearching && searchQuery ? (
              /* Search Results View */
              searchResults.length === 0 ? (
                /* LOADING STATE */
                <View className="items-center justify-center py-20">
                  <View className="w-24 h-24 bg-kente-yellow/20 rounded-full items-center justify-center mb-6">
                    <Animated.View style={{ transform: [{ rotate: '0deg' }] }}>
                      <Search size={40} color="#D65A31" className="opacity-80 animate-spin" />
                    </Animated.View>
                  </View>
                  <Text className="text-2xl font-bold text-text-main mb-2 font-sans-bold text-center">
                    Looking around...
                  </Text>
                  <Text className="text-text-sub font-sans text-center px-4">
                    Scanning nearby kitchens for the best <Text className="font-bold text-clay-primary">{searchQuery}</Text>
                  </Text>
                </View>
              ) : (
                /* RESULTS STATE */
                <View>
                  <View className="flex-row items-center justify-between mb-6">
                    <Text className="text-xl font-bold text-text-main font-sans-bold">
                      {searchResults.length} {searchResults.length === 1 ? 'dish found' : 'dishes found'}
                    </Text>
                    <TouchableOpacity onPress={clearSearch} className="px-3 py-1 bg-gray-100 rounded-full">
                      <Text className="text-sm font-bold text-text-sub">Clear</Text>
                    </TouchableOpacity>
                  </View>

                  {searchResults.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      className="bg-white rounded-3xl p-4 mb-4 flex-row items-start gap-4 border border-gray-50 bg-white"
                      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 }}
                      onPress={() => router.push(`/meal/${item.id}`)}
                    >
                      <Image source={{ uri: item.base_image_url || item.image || 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400' }} className="w-20 h-20 rounded-2xl bg-gray-100 object-cover" resizeMode="cover" />
                      <View className="flex-1 justify-between min-h-[80px] py-1">
                        <View>
                          <Text className="font-bold text-text-main text-lg font-sans-bold leading-tight" numberOfLines={2}>{item.name}</Text>
                          <View className="flex-row items-center gap-1.5 mt-1">
                            <MapPin size={12} color="#D65A31" />
                            <Text className="text-sm text-text-sub font-sans">See cooks near you</Text>
                          </View>
                        </View>
                        <View className="flex-row justify-between items-end mt-2">
                          <Text className="text-clay-primary font-bold text-sm font-sans-bold">₵15 – ₵50</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            ) : (
              /* Default Browse View */
              <View>


                <View className="flex-row items-center gap-2.5 mb-5 mt-2">
                  <Flame size={22} color="#D65A31" fill="#D65A31" />
                  <Text className="text-xl font-bold text-text-main font-sans-bold tracking-tight">Cooking Now</Text>
                </View>

                {isLoadingMeals ? (
                  <ActivityIndicator color="#D65A31" className="mt-8" />
                ) : (
                  <View>
                    {(featuredMeals || []).slice(0, 3).map((item: any) => (
                      <Pressable
                        key={item.id}
                        className="mb-8"
                        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                        onPress={() => router.push(`/listing/${item.id}`)}
                      >
                        {/* Thumbnail Wrapper with Shadow */}
                        <View style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 6 }}>
                          {/* Inner Clipped Image Container */}
                          <View 
                            className="w-full relative bg-gray-100 rounded-[40px] overflow-hidden border border-gray-200/50" 
                            style={{ height: 220 }}
                          >
                            <Image
                              source={{ uri: item.image || 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=800' }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                            />
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.6)']}
                              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}
                            />
                            {/* Price badge */}
                            <View 
                              className="absolute bottom-4 left-5 bg-clay-primary px-4 py-1.5 rounded-full"
                              style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 }}
                            >
                              <Text className="text-white font-bold text-lg font-sans-bold tracking-tight">₵{item.price}</Text>
                            </View>
                            {/* Portions badge */}
                            {item.portions_available > 0 ? (
                              <View className="absolute top-4 right-4 bg-[#FF4500]/90 px-2.5 py-1 rounded-full flex-row items-center gap-1.5 shadow-sm">
                                <Flame size={12} color="white" fill="white" />
                                <Text className="text-white text-[11px] font-bold tracking-wide">{item.portions_available} left</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        {/* Card Content */}
                        <View className="px-2 pt-4 pb-2">
                          <Text className="font-bold text-text-main text-lg font-sans-bold mb-2 leading-tight" numberOfLines={1}>
                            {item.title || item.name}
                          </Text>

                          <View className="flex-row items-center justify-between mt-1">
                            {/* Cook Name */}
                            <View className="flex-row items-center gap-2">
                              <View className="w-6 h-6 bg-orange-50 rounded-full items-center justify-center border border-orange-100">
                                <Text className="text-[10px]">👨‍🍳</Text>
                              </View>
                              <Text className="text-[13px] text-text-sub font-sans font-medium" numberOfLines={1}>
                                {item.profiles?.full_name || 'Chef'}
                              </Text>
                            </View>

                            <View className="flex-row items-center gap-3">
                              {/* Ready In */}
                              <View className="flex-row items-center gap-1.5">
                                <ClockIcon size={13} color="#9CA3AF" />
                                <Text className="text-[13px] text-text-sub font-sans">
                                  {item.prep_time_minutes || 30} min
                                </Text>
                              </View>

                              {/* Order Button Arrow */}
                              <View className="flex-row items-center ml-1">
                                <Text className="text-[13px] font-bold text-clay-primary font-sans-bold mr-0.5">Order</Text>
                                <ChevronRight size={14} color="#D65A31" />
                              </View>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    ))}

                    {/* Horizontal Inject After 3rd Item */}
                    {(featuredMeals || []).length > 3 && (
                      <View className="mt-4 mb-8">
                        <View className="flex-row items-center justify-between mb-4">
                          <View className="flex-row items-center gap-2">
                            <Flame size={18} color="#D65A31" fill="#D65A31" />
                            <Text className="text-lg font-bold text-text-main font-sans-bold">Popular Near You</Text>
                          </View>
                          <Pressable onPress={() => router.push('/explore')} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                            <Text className="text-clay-primary text-xs font-bold font-sans-bold">See all</Text>
                          </Pressable>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6 pb-2" decelerationRate="fast">
                          {(featuredMeals || []).slice().reverse().map((hItem: any) => (
                            <Pressable
                              key={`popular-${hItem.id}`}
                              className="w-[220px] mr-5 mb-4 mt-1"
                              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                              onPress={() => router.push(`/listing/${hItem.id}`)}
                            >
                              <View style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 }}>
                                <View className="w-full h-36 relative bg-gray-100 rounded-[32px] overflow-hidden border border-gray-200/50">
                                  <Image source={{ uri: hItem.image || 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400' }} className="w-full h-full object-cover" resizeMode="cover" />
                                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }} />
                                  <View className="absolute bottom-2 left-3 bg-clay-primary px-2.5 py-1 rounded-full">
                                    <Text className="text-white font-bold text-xs font-sans-bold">₵{hItem.price}</Text>
                                  </View>
                                </View>
                              </View>
                              <View className="px-1 pt-3">
                                <Text className="font-bold text-text-main text-base font-sans-bold mb-0.5" numberOfLines={1}>{hItem.title || hItem.name}</Text>
                                <View className="flex-row justify-between items-center">
                                  <Text className="text-[11px] font-bold text-clay-primary font-sans-bold">₵{hItem.price}</Text>
                                  <View className="flex-row items-center gap-0.5">
                                    <Star size={10} color="#D97706" fill="#D97706" />
                                    <Text className="text-[10px] font-bold text-amber-700 font-sans-bold">{hItem.profiles?.rating || 'New'}</Text>
                                  </View>
                                </View>
                                {hItem.profiles?.full_name && (
                                  <Text className="text-[10px] text-text-sub font-sans mt-1" numberOfLines={1}>by {hItem.profiles.full_name}</Text>
                                )}
                              </View>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* Remaining Vertical Cards */}
                    {(featuredMeals || []).slice(3).map((item: any) => (
                      <Pressable
                        key={item.id}
                        className="mb-8"
                        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                        onPress={() => router.push(`/listing/${item.id}`)}
                      >
                        {/* Thumbnail Wrapper with Shadow */}
                        <View style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 6 }}>
                          <View className="w-full relative bg-gray-100 rounded-[40px] overflow-hidden border border-gray-200/50" style={{ height: 220 }}>
                            <Image source={{ uri: item.image || 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=800' }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }} />
                            <View className="absolute bottom-4 left-5 bg-clay-primary px-4 py-1.5 rounded-full" style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 }}>
                              <Text className="text-white font-bold text-lg font-sans-bold tracking-tight">₵{item.price}</Text>
                            </View>
                            {item.portions_available > 0 && (
                              <View className="absolute top-4 right-4 bg-[#FF4500]/90 px-2.5 py-1 rounded-full flex-row items-center gap-1.5 shadow-sm">
                                <Flame size={12} color="white" fill="white" />
                                <Text className="text-white text-[11px] font-bold tracking-wide">{item.portions_available} left</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View className="px-2 pt-4 pb-2">
                          <Text className="font-bold text-text-main text-lg font-sans-bold mb-2 leading-tight" numberOfLines={1}>{item.title || item.name}</Text>
                          <View className="flex-row items-center justify-between mt-1">
                            <View className="flex-row items-center gap-2">
                              <View className="w-6 h-6 bg-orange-50 rounded-full items-center justify-center border border-orange-100">
                                <Text className="text-[10px]">👨‍🍳</Text>
                              </View>
                              <Text className="text-[13px] text-text-sub font-sans font-medium" numberOfLines={1}>{item.profiles?.full_name || 'Chef'}</Text>
                            </View>
                            <View className="flex-row items-center gap-3">
                              <View className="flex-row items-center gap-1.5">
                                <ClockIcon size={13} color="#9CA3AF" />
                                <Text className="text-[13px] text-text-sub font-sans">{item.prep_time_minutes || 30} min</Text>
                              </View>
                              <View className="flex-row items-center ml-1">
                                <Text className="text-[13px] font-bold text-clay-primary font-sans-bold mr-0.5">Order</Text>
                                <ChevronRight size={14} color="#D65A31" />
                              </View>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    ))}

                    {/* Loved Foods (Horizontal Scroll at bottom) */}
                    {(featuredMeals || []).length > 0 && (
                      <View className="mb-10 mt-6">
                        <View className="flex-row items-center justify-between mb-4">
                          <View className="flex-row items-center gap-2">
                            <Heart size={18} color="#D65A31" fill="#D65A31" />
                            <Text className="text-lg font-bold text-text-main font-sans-bold">Loved Foods</Text>
                          </View>
                          <Pressable onPress={() => router.push('/explore')} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                            <Text className="text-clay-primary text-xs font-bold font-sans-bold">See all</Text>
                          </Pressable>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6 pb-2" decelerationRate="fast">
                          {(featuredMeals || []).slice(0, 3).map((hItem: any) => (
                            <Pressable
                              key={`loved-food-${hItem.id}`}
                              className="w-[220px] mr-5 mb-4 mt-1"
                              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                              onPress={() => router.push(`/listing/${hItem.id}`)}
                            >
                              <View style={{ shadowColor: '#2D241E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 }}>
                                <View className="w-full h-36 relative bg-gray-100 rounded-[32px] overflow-hidden border border-gray-200/50">
                                  <Image source={{ uri: hItem.image || 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400' }} className="w-full h-full object-cover" resizeMode="cover" />
                                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }} />
                                  <View className="absolute bottom-2 left-3 bg-clay-primary px-2.5 py-1 rounded-full">
                                    <Text className="text-white font-bold text-xs font-sans-bold">₵{hItem.price}</Text>
                                  </View>
                                </View>
                              </View>
                              <View className="px-1 pt-3">
                                <Text className="font-bold text-text-main text-base font-sans-bold mb-0.5" numberOfLines={1}>{hItem.title || hItem.name}</Text>
                                <View className="flex-row justify-between items-center">
                                  <Text className="text-[11px] font-bold text-clay-primary font-sans-bold">₵{hItem.price}</Text>
                                  <View className="flex-row items-center gap-0.5">
                                    <Star size={10} color="#D97706" fill="#D97706" />
                                    <Text className="text-[10px] font-bold text-amber-700 font-sans-bold">{hItem.profiles?.rating || 'New'}</Text>
                                  </View>
                                </View>
                                {hItem.profiles?.full_name && (
                                  <Text className="text-[10px] text-text-sub font-sans mt-1" numberOfLines={1}>by {hItem.profiles.full_name}</Text>
                                )}
                              </View>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
