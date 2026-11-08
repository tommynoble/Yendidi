import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, Pressable, KeyboardAvoidingView, Platform, Animated, LayoutAnimation, RefreshControl, Dimensions, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, Star, ChevronRight, X, LayoutDashboard, TrendingUp, Users as UsersIcon, Clock as ClockIcon, Plus, Flame, ChefHat, Heart, Leaf, Utensils, Soup, Fish, Cake, Apple, Sprout, Wheat, ShoppingBag, Check, MessageCircle, Calendar as CalendarIcon } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { unreadMessageCount, fetchConversations, otherPersonId } from '@/lib/messaging';
import { useCurrentUserId } from '@/lib/useCurrentUserId';
import { useCurrentCity, formatLocationLabel } from '@/lib/useCurrentCity';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { getDishImage } from '@/constants/Images';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProcessLoader from '@/components/ProcessLoader';
import AvatarStack from '@/components/AvatarStack';
import { formatPotCountdownBadge, formatPotCountdownCompactBadge, isPotCountdownActive } from '@/lib/countdown';
import SectionHeader from '@/components/SectionHeader';
import ArrowIcon from '@/components/ArrowIcon';
import FeatureCard from '@/components/FeatureCard';
import { PASSES } from '@/lib/passes';
import NotificationIcon from '@/components/NotificationIcon';
import MessagesIcon from '@/components/MessagesIcon';
import LiveBadge from '@/components/LiveBadge';
import { palette, type, fonts } from '@/constants/theme';
import HeartButton from '@/components/HeartButton';
import CartIcon from '@/components/CartIcon';
import PeopleIcon from '@/components/PeopleIcon';
import HostRow from '@/components/HostRow';
import AnimatedHeartOverlay from '@/components/AnimatedHeartOverlay';
import EventCardStyle2 from '@/components/EventCardStyle2';
import EventCardCompact from '@/components/EventCardCompact';
import ShimmerBox from '@/components/ShimmerBox';
import ShimmerImage from '@/components/ShimmerImage';

const { width } = Dimensions.get('window');

// Review system isn't built yet — show the real average once reviews exist, a believable
// placeholder in the meantime so cards don't look unfinished.
const getDisplayRating = (rating: any, id?: string) => {
  if (rating) return Number(rating).toFixed(1);
  const seed = id ? id.charCodeAt(0) : 0;
  return seed % 2 === 0 ? '4.5' : '4.2';
};

// RN has no native inner-shadow — fake it with a dark gradient that fades in
// right at the edges of the food photo, leaving the center untouched.
const ImageInnerShadow = () => (
  <LinearGradient
    pointerEvents="none"
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    colors={['rgba(217,130,92,0.2)', 'rgba(217,130,92,0)', 'rgba(217,130,92,0)', 'rgba(217,130,92,0.2)']}
    locations={[0, 0.14, 0.86, 1]}
    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
  />
);

// Gray pulsing placeholder block — standard skeleton-loading pattern, shown
// in place of cards while their query is still in flight.
// Loading placeholder block with a shimmer sweep (see components/ShimmerBox).
const SkeletonBox = ({ style }: { style?: any }) => <ShimmerBox style={style} />;

const SkeletonGridCard = () => (
  <View style={{ width: '48%' }}>
    <View style={{ backgroundColor: palette.surface, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.15)' }}>
      <SkeletonBox style={{ width: '100%', height: 155 }} />
      <View style={{ padding: 12 }}>
        <SkeletonBox style={{ width: '70%', height: 13, borderRadius: 6, marginBottom: 8 }} />
        <SkeletonBox style={{ width: '45%', height: 10, borderRadius: 5 }} />
      </View>
    </View>
  </View>
);

const SkeletonHeroCard = () => (
  <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
    <View style={{ backgroundColor: palette.surface, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.15)' }}>
      <SkeletonBox style={{ width: '100%', height: 300 }} />
      <View style={{ padding: 16, paddingBottom: 22 }}>
        <SkeletonBox style={{ width: '60%', height: 18, borderRadius: 8, marginBottom: 10 }} />
        <SkeletonBox style={{ width: '35%', height: 13, borderRadius: 6 }} />
      </View>
    </View>
  </View>
);

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
  const { data: currentCity } = useCurrentCity(!isCookMode);
  const queryClient = useQueryClient();
  const currentUserId = useCurrentUserId();
  const { data: unreadChats = 0 } = useQuery({
    queryKey: ['unread-chats', currentUserId],
    queryFn: () => unreadMessageCount(currentUserId as string),
    enabled: !!currentUserId,
    refetchInterval: 60000,
  });

  // -- State --
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchScale = useRef(new Animated.Value(1)).current;

  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true);
    // The haptics native module is missing from some dev builds; a failed buzz must not break search.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(searchScale, { toValue: 1.03, useNativeDriver: true, friction: 6 }).start();
  }, [searchScale]);

  const handleSearchBlur = useCallback(() => {
    setSearchFocused(false);
    Animated.spring(searchScale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, [searchScale]);

  // Leaving Home (e.g. signing out) can skip the input's onBlur, which left the bar stuck enlarged and highlighted
  // when the next login came back to this still-mounted screen. Reset it whenever the screen loses focus.
  useFocusEffect(useCallback(() => () => {
    Keyboard.dismiss();
    handleSearchBlur();
  }, [handleSearchBlur]));
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  // Banner is dismissed per order + status: a new status (Accepted, Cooking, Ready...) brings it back for a few seconds.
  const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(null);
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

  const orderBannerKey = activeOrder ? `${activeOrder.id}:${activeOrder.status}` : null;
  const dismissOrderBanner = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDismissedBannerKey(orderBannerKey);
  }, [orderBannerKey]);
  useEffect(() => {
    if (!orderBannerKey || orderBannerKey === dismissedBannerKey) return;
    const timer = setTimeout(dismissOrderBanner, 5000);
    return () => clearTimeout(timer);
  }, [orderBannerKey, dismissedBannerKey, dismissOrderBanner]);

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

  // Live feed: when a host pauses or resumes an event, or it fills up, the guest feed updates without a pull-to-refresh.
  useEffect(() => {
    if (isCookMode) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`feed:listings:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, (payload: any) => {
        const row = payload.new;
        // Paused: it leaves the feed straight away, easing out, before the refetch confirms it.
        if (payload.eventType === 'UPDATE' && row && row.available === false) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const drop = (old: any) => (Array.isArray(old) ? old.filter((l: any) => l.id !== row.id) : old);
          queryClient.setQueriesData({ queryKey: ['featured-meals'] }, drop);
          queryClient.setQueryData(['all-listings-profiles'], drop);
        }
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['featured-meals'] });
          queryClient.invalidateQueries({ queryKey: ['all-listings-profiles'] });
        }, 300);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [isCookMode, queryClient]);

  // --- QUERIES ---

  // Fetch Featured Meals (Cooking Now) — Real listings from cooks
  const { data: featuredMeals, isLoading: isLoadingMeals, refetch: refetchFeaturedMeals } = useQuery({
    queryKey: ['featured-meals', activeCategory, 'with-cook-location'],
    queryFn: async () => {
      let query = supabase
        .from('listings')
        .select('*, profiles(full_name, avatar_url, rating, kitchen_image_url, location)')
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

  const featuredMealsMain = useMemo(() => featuredMeals || [], [featuredMeals]);


  // Fetch all available listings with cook profiles for thumbnails
  const { data: allListings = [], refetch: refetchAllListings } = useQuery({
    queryKey: ['all-listings-profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('listings')
        .select('*, profiles(full_name, avatar_url, rating, kitchen_image_url, location)')
        .eq('available', true)
        .limit(100);
      return data || [];
    },
    enabled: !isCookMode,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // One entry per host with a live event, busiest hosts first. Real data only: no made-up review counts or badges.
  const discoverHosts = useMemo(() => {
    const byHost = new Map<string, any>();
    for (const l of allListings as any[]) {
      if (!l.cook_id) continue;
      const entry = byHost.get(l.cook_id) || {
        id: l.cook_id,
        name: (l.profiles?.full_name || '').trim() || 'Host',
        avatarUrl: l.profiles?.avatar_url as string | null,
        rating: l.profiles?.rating ? Number(l.profiles.rating) : null,
        location: (l.profiles?.location || '').trim(),
        specialty: '',
        events: 0,
        cover: l.profiles?.kitchen_image_url ? { uri: l.profiles.kitchen_image_url } : getDishImage(l.title, l.image),
      };
      entry.events += 1;
      if (!entry.specialty && l.category) entry.specialty = String(l.category).split(',')[0].trim();
      byHost.set(l.cook_id, entry);
    }
    return Array.from(byHost.values()).sort((a, b) => b.events - a.events).slice(0, 10);
  }, [allListings]);

  // The user's actually-liked dishes — pulled from the full listings pool, not just the small featured slice,
  // so a liked item still shows here even if it isn't part of the current featured set.
  const likedItems = useMemo(
    () => (allListings || []).filter((m: any) => savedIds.includes(m.id)),
    [allListings, savedIds]
  );

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
 
  // The cook's next upcoming host day, for the dashboard shortcut.
  const { data: nextHostDay, refetch: refetchNextHostDay } = useQuery({
    queryKey: ['kitchen-schedule', 'next', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('cook_sessions')
        .select('session_date, start_time')
        .eq('cook_id', user.id)
        .gte('session_date', format(new Date(), 'yyyy-MM-dd'))
        .order('session_date', { ascending: true })
        .limit(1);
      if (data && data[0]) return data[0];
      // No host day: fall back to the soonest event that carries its own date.
      const { data: loose } = await supabase
        .from('listings')
        .select('order_deadline')
        .eq('cook_id', user.id)
        .is('session_id', null)
        .or('archived.eq.false,archived.is.null')
        .gte('order_deadline', new Date().toISOString())
        .order('order_deadline', { ascending: true })
        .limit(1);
      const when = loose && loose[0]?.order_deadline ? new Date(loose[0].order_deadline) : null;
      return when ? { session_date: format(when, 'yyyy-MM-dd'), start_time: format(when, 'HH:mm:ss') } : null;
    },
    enabled: !!user && isCookMode,
    staleTime: 60 * 1000,
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

  // The tab stays mounted, so refresh the events summary each time the dashboard is opened (e.g. after posting, pausing or moving an event).
  useFocusEffect(useCallback(() => {
    if (user && isCookMode) {
      refetchMyMenu();
      refetchNextHostDay();
    }
  }, [user?.id, isCookMode]));

  const chefStats = chefStatsData || {
    todayOrders: 0,
    revenue: 0,
    activeNow: 0,
    completedCount: 0,
    totalCount: 0
  };

  // Recent Activity (Cook): orders, messages from guests and events the host created, newest first.
  const { data: recentActivity, refetch: refetchRecentActivity } = useQuery({
    queryKey: ['recent-activity', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const [ordersRes, convoRes, eventsRes] = await Promise.all([
        supabase
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
          .limit(5),
        fetchConversations(user.id).catch(() => null),
        supabase
          .from('listings')
          .select('id, title, created_at')
          .eq('cook_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      const orderItems = (ordersRes.data || []).map((o: any) => {
        // Handle joined data which might be array or object
        const profile = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
        const firstItem = Array.isArray(o.order_items) ? o.order_items[0] : o.order_items;
        const listing = firstItem?.listings;
        const actualListing = Array.isArray(listing) ? listing[0] : listing;
        return {
          id: `order-${o.id}`,
          type: 'order',
          title: o.status === 'New' ? 'New Booking!' : `Booking #${o.id.slice(0, 4)}`,
          subtitle: `${profile?.full_name || 'Customer'} • ${actualListing?.title || 'Meal'}`,
          time: o.created_at,
          route: '/(tabs)/orders',
        };
      });

      const messageItems = convoRes
        ? convoRes.conversations
            .filter(c => c.last_sender_id && c.last_sender_id !== user.id && !convoRes.blockedIds.includes(otherPersonId(c, user.id)))
            .slice(0, 3)
            .map(c => ({
              id: `message-${c.id}`,
              type: 'message',
              title: `${convoRes.people[otherPersonId(c, user.id)]?.name || 'A guest'} sent you a message`,
              subtitle: c.last_message || '',
              time: c.last_message_at,
              route: `/messages/${c.id}`,
            }))
        : [];

      const eventItems = (eventsRes.data || []).map((l: any) => ({
        id: `event-${l.id}`,
        type: 'event',
        title: 'You created an event',
        subtitle: l.title,
        time: l.created_at,
        route: `/listing/${l.id}`,
      }));

      return [...orderItems, ...messageItems, ...eventItems]
        .sort((x, y) => new Date(y.time).getTime() - new Date(x.time).getTime())
        .slice(0, 5);
    },
    enabled: !!user && isCookMode,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Same as the events summary: reload when the dashboard is opened so new messages and events show up.
  useFocusEffect(useCallback(() => {
    if (user && isCookMode) refetchRecentActivity();
  }, [user?.id, isCookMode]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchUser(),
        refetchProfile(),
        refetchActiveOrder(),
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
    refetchUser, refetchProfile, refetchActiveOrder, refetchFeaturedMeals,
    refetchAllListings, refetchChefStats, refetchMyMenu, refetchRecentActivity
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
    const hasEvents = (myMenu || []).length > 0;
    const liveCount = (myMenu || []).filter((l: any) => l.available !== false).length;
    // Says what is true right now instead of a fixed slogan.
    const eventsSubtitle = !hasEvents
      ? 'Nothing live yet. Create one to start taking bookings'
      : [
          liveCount > 0 ? `${liveCount} live` : 'None live right now',
          nextHostDay ? `next host day ${format(parseISO(nextHostDay.session_date), 'EEE, MMM d')}` : null,
        ].filter(Boolean).join(' · ');
    // Thin accent-tint rule between dashboard sections.
    const sectionDivider = <View style={{ height: 1, marginHorizontal: 24, marginBottom: 16, backgroundColor: 'rgba(194, 83, 39,0.22)' }} />;
    const ringRadius = 36;
    const ringCircumference = 2 * Math.PI * ringRadius;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }} edges={['bottom']}>
        <View style={{ flex: 1, backgroundColor: palette.canvas }}>

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 12, paddingBottom: 16, backgroundColor: palette.canvas }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: palette.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>Kitchen Dashboard</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: palette.ink, letterSpacing: -0.3 }}>Host {displayName}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable onPress={() => router.push('/messages')} style={{ position: 'relative' }} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }} accessibilityLabel="Messages">
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.inkWash, alignItems: 'center', justifyContent: 'center' }}>
                    <MessagesIcon size={24} hasUnread={unreadChats > 0} />
                  </View>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FFF8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, borderWidth: 1, borderColor: '#B2DFCC' }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#006A3C' }} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#006A3C', letterSpacing: 1 }}>OPEN</Text>
                </View>
                <Pressable onPress={() => router.push('/account')} accessibilityRole="button" accessibilityLabel="Profile and settings" hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#F2DFD7', borderWidth: 2, borderColor: palette.accent }} />
                ) : (
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.accent }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: 'white' }}>{displayName.charAt(0)}</Text>
                  </View>
                )}
                </Pressable>
              </View>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} colors={[palette.accent]} />}
          >

            {/* Business Overview */}
            <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
              <SectionHeader
                title="Business Overview"
                subtitle="Revenue, active orders and customers at a glance"
                inset={false}
                actionLabel="View Details"
                actionIcon={<ChevronRight size={13} color={palette.accent} />}
                onActionPress={() => router.push('/business-overview')}
                extraBottom={4}
              />
            </View>

            {/* Stats Cards */}
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 20 }}>
              {[
                { icon: TrendingUp, color: '#007A33', bg: '#F0FFF8', label: 'REVENUE', value: `₵${chefStats.revenue.toFixed(0)}` },
                { icon: ClockIcon, color: palette.accent, bg: '#FFF1EC', label: 'ACTIVE', value: String(chefStats.activeNow) },
                { icon: UsersIcon, color: '#0066CC', bg: '#EFF6FF', label: 'CUSTOMERS', value: String(chefStats.todayOrders) },
              ].map(({ icon: Icon, color, bg, label, value }) => (
                <View key={label} style={{ flex: 1, backgroundColor: '#F7EEE7', borderRadius: 20, padding: 14, shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Icon size={18} color={color} />
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: palette.ink, marginBottom: 2 }}>{value}</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9, color: palette.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Text>
                </View>
              ))}
            </View>

            {sectionDivider}

            {/* Quick Actions */}
            <View style={{ marginHorizontal: 24, marginBottom: 20, borderRadius: 26, backgroundColor: palette.accent, shadowColor: palette.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.32, shadowRadius: 14, elevation: 5 }}>
              <View style={{ borderRadius: 26, padding: 18, overflow: 'hidden' }}>
                {/* Soft tonal circles for depth */}
                <View pointerEvents="none" style={{ position: 'absolute', top: -46, right: -36, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.10)' }} />
                <View pointerEvents="none" style={{ position: 'absolute', top: 18, right: 38, width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                <View pointerEvents="none" style={{ position: 'absolute', bottom: -60, left: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(0,0,0,0.06)' }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.8)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>Your kitchen</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: 'white' }}>Quick Actions</Text>
                  </View>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}>
                    <ChefHat size={22} color="white" />
                  </View>
                </View>

                {/* Primary action: light on the orange so it reads first */}
                <TouchableOpacity
                  style={{ backgroundColor: palette.surface, borderRadius: 20, paddingVertical: 14, paddingLeft: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, shadowColor: palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 }}
                  onPress={() => router.push(`/(tabs)/cook?new=${Date.now()}`)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={hasEvents ? 'Create an event' : 'Create your first event'}
                >
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={24} color="white" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: palette.ink }}>{hasEvents ? 'Create an Event' : 'Create Your First Event'}</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: palette.muted, marginTop: 1 }}>{hasEvents ? 'Post a dish for a host day' : 'Post a dish and pick your host day'}</Text>
                  </View>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF1EC', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={16} color={palette.accent} />
                  </View>
                </TouchableOpacity>

                {/* Shortcuts with live info */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[
                    {
                      icon: CalendarIcon, label: 'Schedule', route: '/(tabs)/profile', badge: 0,
                      sub: nextHostDay
                        ? `${format(parseISO(nextHostDay.session_date), 'EEE, MMM d')} · ${format(new Date(`2000-01-01T${nextHostDay.start_time}`), 'h:mm a')}`
                        : 'Set a host day',
                      eyebrow: nextHostDay ? 'Next host day' : 'No host day yet',
                    },
                    {
                      icon: ShoppingBag, label: 'Bookings', route: '/(tabs)/orders', badge: chefStats.activeNow,
                      sub: chefStats.activeNow > 0 ? `${chefStats.activeNow} active now` : 'All caught up',
                      eyebrow: 'Guest seats',
                    },
                  ].map(({ icon: Icon, label, sub, eyebrow, route, badge }) => (
                    <TouchableOpacity
                      key={label}
                      style={{ flex: 1, backgroundColor: '#FFF1EC', borderRadius: 20, padding: 14, shadowColor: palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 2 }}
                      onPress={() => router.push(route as any)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}>
                          <Icon size={19} color={palette.accent} />
                        </View>
                        {badge > 0 ? (
                          <View style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: 'white' }}>{badge}</Text>
                          </View>
                        ) : (
                          <ChevronRight size={16} color={palette.accent} />
                        )}
                      </View>
                      {/* Reads top to bottom: what it is, the live detail, then a quiet caption */}
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: palette.ink }}>{label}</Text>
                      <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: palette.accent, marginTop: 3 }} numberOfLines={1}>{sub}</Text>
                      <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: palette.muted, marginTop: 3 }}>{eyebrow}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {sectionDivider}

            {/* Today's Progress */}
            <View style={{ marginHorizontal: 24, backgroundColor: '#FFF1EC', borderRadius: 24, padding: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}>
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
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: palette.ink }}>{progressPercent}%</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: palette.ink, marginBottom: 4 }}>Today's Progress</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: palette.muted, marginBottom: 14 }}>
                  {completedCount} of {chefStats.totalCount} orders completed
                </Text>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <View key={i} style={{ height: 5, flex: 1, borderRadius: 3, backgroundColor: i < Math.ceil(progressPercent / 20) ? '#84523C' : '#DDC1B6' }} />
                  ))}
                </View>
              </View>
            </View>

            {sectionDivider}

            {/* My active Menu */}
            <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
              <SectionHeader title="Your Events" subtitle={eventsSubtitle} inset={false} actionLabel="Add Event" onActionPress={() => router.push(`/(tabs)/cook?new=${Date.now()}`)} extraBottom={4} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(myMenu || []).slice(0, 1).map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={{ flex: 1, backgroundColor: '#F7EEE7', borderRadius: 20, overflow: 'hidden', shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}
                    onPress={() => router.push(`/listing/${item.id}`)}
                    activeOpacity={0.85}
                  >
                    <Image source={getDishImage(item.title, item.image)} style={{ width: '100%', height: 120 }} resizeMode="cover" />
                    <View style={{ padding: 12 }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: palette.ink, marginBottom: 4 }} numberOfLines={2}>{item.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: palette.accent }}>₵{item.price}</Text>
                        <LiveBadge live={item.available !== false} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                {(!myMenu || myMenu.length === 0) && (
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#F7EEE7', borderRadius: 20, overflow: 'hidden', shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}
                    onPress={() => router.push(`/(tabs)/cook?new=${Date.now()}`)}
                    activeOpacity={0.85}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#DDC1B6', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <Plus size={20} color={palette.ink} />
                    </View>
                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: palette.muted, textAlign: 'center' }}>Add your first{'\n'}event</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#F7EEE7', borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(194, 83, 39,0.5)', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}
                  onPress={() => router.push(`/(tabs)/cook?new=${Date.now()}`)}
                  activeOpacity={0.75}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#DDC1B6', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Plus size={18} color={palette.ink} />
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: palette.muted, textAlign: 'center' }}>Add another{'\n'}event</Text>
                </TouchableOpacity>
              </View>
            </View>

            {sectionDivider}

            {/* Recent Activity */}
            <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
              <SectionHeader title="Recent Activity" inset={false} extraBottom={4} />
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((activity: any) => {
                  const look = activity.type === 'message'
                    ? { Icon: MessageCircle, color: '#0066CC', bg: '#EFF6FF' }
                    : activity.type === 'event'
                      ? { Icon: CalendarIcon, color: palette.accent, bg: '#FFF1EC' }
                      : { Icon: ShoppingBag, color: '#007A33', bg: '#F0FFF8' };
                  return (
                    <TouchableOpacity
                      key={activity.id}
                      onPress={() => router.push(activity.route as any)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      style={{ backgroundColor: '#F7EEE7', borderRadius: 18, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)', shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 1 }}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: look.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <look.Icon size={18} color={look.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: palette.ink }}>{activity.title}</Text>
                        <Text numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: palette.muted, marginTop: 2 }}>{activity.subtitle}</Text>
                      </View>
                      <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: palette.muted }}>
                        {activity.time ? (() => {
                          try {
                            const d = new Date(activity.time);
                            return isNaN(d.getTime()) ? 'Recently' : formatDistanceToNow(d) + ' ago';
                          } catch { return 'Recently'; }
                        })() : 'Recently'}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={{ backgroundColor: '#F7EEE7', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(194, 83, 39,0.5)' }}>
                  <ShoppingBag size={32} color="#DDC1B6" />
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: palette.muted, marginTop: 10, textAlign: 'center' }}>Nothing yet. Orders, guest messages and new events will show up here.</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>

        {/* Sticky Top Bar */}
        <View style={{ backgroundColor: palette.canvas, paddingHorizontal: 20, paddingVertical: 4, marginBottom: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          {/* Brand + location */}
          <View style={{ flexShrink: 1, marginRight: 12 }}>
            <Pressable
              onPress={() => router.push('/address')}
              accessibilityRole="button"
              accessibilityLabel="Change location"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 16 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ ...type.micro, color: palette.muted, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 1 }} numberOfLines={1}>
                {currentCity || formatLocationLabel((profileData as any)?.location)}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              {/* paddingRight + no shrinking: iOS clips the last glyph of a bold custom font when the text box is measured exactly */}
              <Text style={{ ...type.section, color: palette.ink, paddingRight: 4, flexShrink: 0 }} numberOfLines={1}>YenDidii</Text>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.accent, marginTop: 4 }} />
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => router.push('/notifications')} style={{ position: 'relative' }} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.inkWash, alignItems: 'center', justifyContent: 'center' }}>
                <NotificationIcon size={24} hasUnread={!!activeOrder} />
              </View>
            </Pressable>
            <Pressable onPress={() => router.push('/messages')} style={{ position: 'relative' }} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.inkWash, alignItems: 'center', justifyContent: 'center' }}>
                <MessagesIcon size={24} hasUnread={unreadChats > 0} />
              </View>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/profile')} style={{ position: 'relative' }} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
              {(profileData as any)?.avatar_url ? (
                <Image
                  source={{ uri: (profileData as any).avatar_url }}
                  style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: palette.accent }}
                />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.accent }}>
                  <Text style={{ ...type.card, fontFamily: fonts.bold, color: 'white' }}>{displayName.charAt(0)}</Text>
                </View>
              )}
              <View style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#00A862', borderWidth: 2, borderColor: palette.canvas }} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} colors={[palette.accent]} />}
        >
          {/* Search Bar */}
          <View style={{ paddingHorizontal: 20, marginTop: 16, marginBottom: 20 }}>
            <Animated.View style={{ transform: [{ scale: searchScale }] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1.5, borderColor: searchFocused ? '#D9825C' : '#DDC1B6', paddingHorizontal: 14, height: 52, shadowColor: searchFocused ? palette.accent : palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: searchFocused ? 0.25 : 0.16, shadowRadius: searchFocused ? 12 : 10, elevation: searchFocused ? 5 : 4 }}>
                <Search size={18} color={palette.ink} />
                <TextInput
                  placeholder="Search hosts, dishes, gatherings or locations..."
                  placeholderTextColor={palette.muted}
                  value={searchQuery}
                  onChangeText={(t) => { setSearchQuery(t); if (t.length > 2) handleSearch(); if (t.length === 0) clearSearch(); }}
                  onSubmitEditing={handleSearch}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  style={{ flex: 1, height: 40, paddingVertical: 0, paddingHorizontal: 10, fontFamily: fonts.regular, fontSize: 12, color: palette.ink }}
                />
                {searchQuery.length > 0 ? (
                  <TouchableOpacity onPress={clearSearch} style={{ padding: 4 }}>
                    <X size={16} color={palette.ink} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => router.push('/address')} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
                    <MapPin size={18} color={palette.ink} />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </View>

          {/* Order update banner: shows for a few seconds on each new status, tap to open Bookings, X to close */}
          {activeOrder && orderBannerKey !== dismissedBannerKey && (
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <TouchableOpacity
                style={{ backgroundColor: '#FFF1EC', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.3)', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                onPress={() => router.push('/(tabs)/orders')}
                activeOpacity={0.8}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(194, 83, 39,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <ChefHat size={20} color={palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: palette.ink }} numberOfLines={1}>
                    {activeOrder.order_items?.[0]?.listings?.title || 'Your Order'}
                  </Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: palette.accent, marginTop: 1 }}>{getStatusText(activeOrder.status)}</Text>
                </View>
                <TouchableOpacity onPress={dismissOrderBanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Dismiss">
                  <X size={16} color={palette.ink} />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          )}

          {/* Category Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: -8, marginBottom: 32 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 6 }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.name;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setActiveCategory(cat.name)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9999, backgroundColor: isActive ? palette.accent : palette.surface, borderWidth: 1.5, borderColor: isActive ? palette.accent : '#DDC1B6', shadowColor: isActive ? palette.accent : palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: isActive ? 0.22 : 0.1, shadowRadius: isActive ? 6 : 4, elevation: isActive ? 3 : 2 }}
                >
                  {(() => {
                    const IconComponent = ICON_MAP[cat.icon];
                    if (IconComponent) {
                      return <IconComponent size={10} color={isActive ? 'white' : palette.accent} />;
                    }
                    return null;
                  })()}
                  <Text style={{ fontFamily: isActive ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium', fontSize: 12, color: isActive ? 'white' : palette.muted }}>
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
                    <Search size={36} color={palette.accent} />
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: palette.ink, marginBottom: 8, textAlign: 'center' }}>Looking around...</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: palette.muted, textAlign: 'center' }}>
                    Scanning nearby kitchens for{' '}
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: palette.accent }}>{searchQuery}</Text>
                  </Text>
                </View>
              ) : (
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: palette.ink }}>
                      {searchResults.length} {searchResults.length === 1 ? 'dish found' : 'dishes found'}
                    </Text>
                    <TouchableOpacity onPress={clearSearch} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F2DFD7', borderRadius: 9999 }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: palette.muted }}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  {searchResults.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={{ backgroundColor: '#F7EEE7', borderRadius: 20, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#F2DFD7', shadowColor: palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.11, shadowRadius: 10, elevation: 3 }}
                      onPress={() => router.push(`/listing/${item.id}`)}
                    >
                      <Image source={{ uri: (item.image && item.image.includes(',') ? item.image.split(',')[0].trim() : item.image) || 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400' }} style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: '#F2DFD7' }} resizeMode="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: palette.ink, marginBottom: 4 }} numberOfLines={2}>{item.title}</Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: palette.muted }}>by {item.profiles?.full_name || 'Local Host'}</Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: palette.accent, marginTop: 4 }}>₵{item.price}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            /* DEFAULT BROWSE VIEW */
            <View>

              {/* Gathering Nearby heading */}
              <SectionHeader title="Gathering Nearby" subtitle="Pull up a chair at a table in your neighborhood..." extraBottom={8} />

              {/* Featured Bento Card */}
              {isLoadingMeals ? (
                <>
                  <SkeletonHeroCard />
                  <SkeletonHeroCard />
                </>
              ) : featuredMealsMain.length > 0 && (
                <View>
                  {featuredMealsMain
                    .filter((m: any) => !(m.title || m.name || '').toLowerCase().includes('fufu'))
                    .slice(0, 2)
                    .map((hero: any, heroIndex: number, heroArr: any[]) => (
                    <EventCardStyle2
                      key={`hero-wrapper-${hero.id}`}
                      item={hero}
                      saved={savedIds.includes(hero.id)}
                      onToggleSaved={() => toggleSaved(hero.id)}
                      animatingLike={!!animatingLikes[hero.id]}
                      onPress={() => handleCardPress(hero.id)}
                      marginBottom={heroIndex === heroArr.length - 1 ? 34 : 36}
                    />
                  ))}
                </View>
              )}

              {isLoadingMeals && (
                <View style={{ paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 28, marginTop: 8 }}>
                  <SkeletonGridCard />
                  <SkeletonGridCard />
                  <SkeletonGridCard />
                  <SkeletonGridCard />
                </View>
              )}

              {(featuredMeals || []).length > 0 && (
                <>
                  {/* POPULAR DISHES HEADER */}
                  <SectionHeader
                    title="Upcoming Gatherings"
                    subtitle="Intimate communal dining & supper club feasts"
                    actionLabel=""
                    actionIcon={<ArrowIcon />}
                    onActionPress={() => router.push('/(tabs)/explore/map')}
                    extraBottom={14}
                  />

                  {/* UPCOMING GATHERINGS — swipeable row */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 32 }}
                    style={{ marginBottom: 0 }}
                    decelerationRate="fast"
                  >
                    {(featuredMeals || []).slice(0, 4).map((item: any) => (
                      <EventCardCompact
                        key={`popular-wrapper-${item.id}`}
                        item={item}
                        saved={savedIds.includes(item.id)}
                        onToggleSaved={() => toggleSaved(item.id)}
                        animatingLike={!!animatingLikes[item.id]}
                        onPress={() => handleCardPress(item.id)}
                      />
                    ))}
                  </ScrollView>
                </>
              )}

              {/* FEATURED EDITORIAL CARDS */}
              <SectionHeader title="Exclusive & Bespoke" subtitle="Book top local hosts for private celebrations" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 28 }}
                style={{ marginBottom: 0 }}
                decelerationRate="fast"
              >
                <FeatureCard
                  tall
                  tag="Exclusive"
                  title="Book a Chef for Your Next Event"
                  subtitle="Bring intimate host-led dining, customized menus and warm hospitality to your celebration."
                  cta="Inquire Now"
                  image={require('@/assets/images/chef-event.jpg')}
                  anchor="top-right"
                  onPress={() => router.push('/(tabs)/explore/map')}
                />
                <FeatureCard
                  tall
                  tag="Popular"
                  title="Backyard Chichinga & Palm Wine Night"
                  subtitle="Join host Kwesi for smoky skewers, storytelling, and cold refreshments under the stars."
                  cta="Join Table"
                  imageUrl="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1000&q=80"
                  anchor="top-right"
                  onPress={() => router.push('/(tabs)/explore/map')}
                />
                <FeatureCard
                  tall
                  tag="Collab"
                  title="Chef Ekua x C0R3 Special Tasting"
                  subtitle="A one-night-only 5-course Afro-fusion menu paired with live guest performances."
                  cta="View Menu"
                  imageUrl="https://images.unsplash.com/photo-1574484284002-952d92456975?w=1000&q=80"
                  anchor="top-right"
                  onPress={() => router.push('/(tabs)/explore/map')}
                />
                <FeatureCard
                  tall
                  tag="Sunday Special"
                  title="Traditional Fante Feast & Storytelling"
                  subtitle="Slow-cooked local favorites served family-style around a shared community table."
                  cta="Book Table"
                  imageUrl="https://images.unsplash.com/photo-1596797882870-8c33deeac224?w=1000&q=80"
                  anchor="top-right"
                  onPress={() => router.push('/(tabs)/explore/map')}
                />
              </ScrollView>

              {/* Two more big listing cards, the next events after the ones at the top of the feed */}
              {(() => {
                const moreBig = featuredMealsMain
                  .filter((m: any) => !(m.title || m.name || '').toLowerCase().includes('fufu'))
                  .slice(2, 4);
                if (moreBig.length === 0) return null;
                return (
                  <>
                    <SectionHeader title="More Tables to Join" subtitle="Reserve a seat at one of these gatherings" extraBottom={8} />
                    {moreBig.map((item: any, idx: number) => (
                      <EventCardStyle2
                        key={`more-big-${item.id}`}
                        item={item}
                        saved={savedIds.includes(item.id)}
                        onToggleSaved={() => toggleSaved(item.id)}
                        animatingLike={!!animatingLikes[item.id]}
                        onPress={() => handleCardPress(item.id)}
                        marginBottom={idx === moreBig.length - 1 ? 28 : 36}
                      />
                    ))}
                  </>
                );
              })()}

              {/* Popular Hosts Near You — one card per host with a live event */}
              <SectionHeader
                title="Popular Hosts Near You"
                subtitle="Find kitchens and supper clubs worth a visit"
                actionLabel=""
                actionIcon={<ArrowIcon />}
                onActionPress={() => router.push('/(tabs)/explore/map')}
              />
              {discoverHosts.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 32 }}
                  style={{ marginBottom: 0 }}
                  decelerationRate="fast"
                >
                  {discoverHosts.map((host: any) => (
                    <View
                      key={`host-card-${host.id}`}
                      style={{
                        width: 144,
                        shadowColor: palette.ink,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.26,
                        shadowRadius: 18,
                        elevation: 7,
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => router.push(`/cook/${host.id}`)}
                        style={{
                          flex: 1,
                          backgroundColor: palette.surface,
                          borderRadius: 24,
                          overflow: 'hidden',
                          borderWidth: 1,
                          borderColor: 'rgba(194, 83, 39,0.35)',
                        }}
                      >
                        {/* Mini cover photo */}
                        <View style={{ height: 44, backgroundColor: '#F2DFD7' }}>
                          <ShimmerImage source={host.cover} style={{ width: '100%', height: '100%' }} />
                          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(61,37,30,0.15)' }} />
                        </View>

                        {/* Avatar overlapping the cover */}
                        <View style={{ alignSelf: 'center', marginTop: -22 }}>
                          {host.avatarUrl ? (
                            <Image source={{ uri: host.avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: palette.surface, backgroundColor: '#F2DFD7' }} />
                          ) : (
                            <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: palette.surface, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ ...type.card, fontFamily: fonts.bold, color: 'white' }}>{host.name.charAt(0).toUpperCase()}</Text>
                            </View>
                          )}
                        </View>

                        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10 }}>
                          <Text style={{ ...type.cardTitleSmall, color: palette.ink, textAlign: 'center' }} numberOfLines={2}>{host.name}</Text>

                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 2 }}>
                            {host.rating ? (
                              <>
                                <Star size={11} color={palette.accent} fill={palette.accent} />
                                <Text style={{ ...type.meta, color: palette.bodyText }}>{host.rating.toFixed(1)}</Text>
                              </>
                            ) : (
                              <Text style={{ ...type.meta, color: palette.bodyText }}>New Host</Text>
                            )}
                            {!!host.location && (
                              <Text style={{ ...type.meta, color: palette.bodyText, flexShrink: 1 }} numberOfLines={1}>• {host.location}</Text>
                            )}
                          </View>

                          <View style={{ backgroundColor: '#FFF1EC', borderRadius: 9999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 6, maxWidth: '100%' }}>
                            <Text style={{ ...type.micro, color: '#944421' }} numberOfLines={1}>
                              {host.specialty || `${host.events} ${host.events === 1 ? 'event' : 'events'}`}
                            </Text>
                          </View>

                          <View style={{ flexGrow: 1 }} />
                          <View style={{ alignSelf: 'stretch', marginTop: 8, paddingVertical: 6, borderRadius: 9999, backgroundColor: palette.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <Text style={{ ...type.micro, fontFamily: fonts.bold, color: 'white' }}>Host Profile</Text>
                            <ChevronRight size={12} color="white" strokeWidth={2.5} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Small cards slider: the events after the ones already shown above */}
              {(() => {
                const rest = featuredMealsMain
                  .filter((m: any) => !(m.title || m.name || '').toLowerCase().includes('fufu'))
                  .slice(4, 14);
                if (rest.length === 0) return null;
                return (
                  <>
                    <SectionHeader title="More to Explore" subtitle="Other gatherings happening around you" />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, gap: 12, paddingBottom: 32 }}
                      decelerationRate="fast"
                    >
                      {rest.map((item: any) => (
                        <EventCardCompact
                          key={`explore-small-${item.id}`}
                          item={item}
                          saved={savedIds.includes(item.id)}
                          onToggleSaved={() => toggleSaved(item.id)}
                          animatingLike={!!animatingLikes[item.id]}
                          onPress={() => handleCardPress(item.id)}
                        />
                      ))}
                    </ScrollView>
                  </>
                );
              })()}

              {/* Divider, then the VIP pass banner */}
              <View style={{ height: 1, backgroundColor: 'rgba(86,66,59,0.15)', marginHorizontal: 20, marginBottom: 8 }} />

              <SectionHeader title="Exclusive YenDidii Passes" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, gap: 14, paddingBottom: 28 }}
                decelerationRate="fast"
              >
                {PASSES.map((pass) => (
                  <FeatureCard
                    key={pass.id}
                    tag={pass.tag}
                    title={pass.title}
                    subtitle={pass.subtitle}
                    cta={pass.cta}
                    image={pass.image}
                    imageUrl={pass.imageUrl}
                    anchor={pass.anchor}
                    bgColor={pass.bgColor}
                    onPress={() => router.push(`/pass/${pass.id}`)}
                  />
                ))}
              </ScrollView>

              {/* Liked Meals — only what the user has actually hearted */}
              {likedItems.length > 0 && (
                <View style={{ marginBottom: 28 }}>
                  {/* Section header */}
                  <SectionHeader
                    title="Liked Meals"
                    icon={<Heart size={18} color={palette.accent} fill={palette.accent} />}
                    onActionPress={() => router.push('/(tabs)/explore/map')}
                  />

                  {/* Row 1 — big cards (70% width) */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, gap: 4, paddingBottom: 4 }}
                    decelerationRate="fast"
                    style={{ marginBottom: 14 }}
                  >
                    {likedItems.slice(0, 3).map((hItem: any) => (
                      <View
                        key={`big-wrapper-${hItem.id}`}
                        style={{ width: 128 }}
                      >
                        <Pressable
                          style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                          onPress={() => handleCardPress(hItem.id)}
                        >
                          <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 10 }}>
                            <View style={{ position: 'relative' }}>
                              <View style={{ width: 108, height: 108, borderRadius: 54, overflow: 'hidden', borderWidth: 2.5, borderColor: palette.accent }}>
                                <Image source={getDishImage(hItem.title || hItem.name, hItem.image)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                              </View>
                              <HeartButton saved={savedIds.includes(hItem.id)} onPress={() => toggleSaved(hItem.id)} size={22} iconSize={10} style={{ position: 'absolute', top: -2, right: -2 }} />
                              <AnimatedHeartOverlay visible={!!animatingLikes[hItem.id]} />
                            </View>
                            <View style={{ paddingHorizontal: 10, marginTop: 8, alignItems: 'center' }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: palette.ink, marginBottom: 3, textAlign: 'center' }} numberOfLines={1}>{hItem.title || hItem.name}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Flame size={10} color="#BA1A1A" fill="#BA1A1A" />
                                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: '#BA1A1A' }} numberOfLines={1}>
                                  {hItem.order_deadline && isPotCountdownActive(hItem.order_deadline) ? formatPotCountdownBadge(hItem.order_deadline) : `${hItem.portions_available} seat${hItem.portions_available === 1 ? "" : "s"} left`}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>

                  {/* Row 2 — small compact cards (43% width), only when there are more liked items */}
                  {likedItems.length > 3 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, gap: 2, paddingBottom: 4 }}
                    decelerationRate="fast"
                  >
                    {likedItems.slice(3, 8).map((hItem: any, idx: number) => (
                      <View
                        key={`small-wrapper-${hItem.id}`}
                        style={{ width: 100 }}
                      >
                        <Pressable
                          style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                          onPress={() => handleCardPress(hItem.id)}
                        >
                          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 9 }}>
                            <View style={{ position: 'relative' }}>
                              <View style={{ width: 84, height: 84, borderRadius: 42, overflow: 'hidden', borderWidth: 2, borderColor: palette.accent }}>
                                <Image source={getDishImage(hItem.title || hItem.name, hItem.image)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                              </View>
                              <HeartButton saved={savedIds.includes(hItem.id)} onPress={() => toggleSaved(hItem.id)} size={20} iconSize={9} style={{ position: 'absolute', top: -2, right: -2 }} />
                              <AnimatedHeartOverlay visible={!!animatingLikes[hItem.id]} />
                            </View>
                            <View style={{ paddingHorizontal: 8, marginTop: 7, alignItems: 'center' }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: palette.ink, marginBottom: 4, textAlign: 'center' }} numberOfLines={1}>{hItem.title || hItem.name}</Text>
                              {idx === 0 ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF1EC', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9999 }}>
                                  <Star size={9} color={palette.accent} fill={palette.accent} />
                                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: palette.accent }}>New</Text>
                                </View>
                              ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <Flame size={10} color="#BA1A1A" fill="#BA1A1A" />
                                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: '#BA1A1A' }} numberOfLines={1}>
                                    {hItem.order_deadline && isPotCountdownActive(hItem.order_deadline) ? formatPotCountdownBadge(hItem.order_deadline) : `${hItem.portions_available} seat${hItem.portions_available === 1 ? "" : "s"} left`}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                  )}
                </View>
              )}

            </View>
          )}
        </ScrollView>
      </View>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <ProcessLoader
        visible={refreshing}
        message="Refreshing Menu..."
      />
    </SafeAreaView>
  );
}
