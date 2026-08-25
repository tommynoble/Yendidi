import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, ActivityIndicator, TextInput, Animated, PanResponder, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, ChevronRight, Navigation, MapPin, ChefHat, Search, X, Utensils, Wheat, Soup, Flame, Apple, Fish, Cake, Leaf, Sprout } from 'lucide-react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';

// Same curated category list used on Home, so search stays consistent across the app
const CATEGORIES = [
    { id: '1', name: 'All', icon: 'Utensils' },
    { id: '2', name: 'Rice Dishes', icon: 'Wheat' },
    { id: '4', name: 'Soups & Stews', icon: 'Soup' },
    { id: '5', name: 'Grills & Kebabs', icon: 'Flame' },
    { id: '6', name: 'Traditional Snacks', icon: 'Apple' },
    { id: '7', name: 'Seafood', icon: 'Fish' },
    { id: '8', name: 'Pastries', icon: 'Cake' },
    { id: '9', name: 'Vegan', icon: 'Leaf' },
    { id: '10', name: 'Vegetarian', icon: 'Sprout' },
];

const ICON_MAP: { [key: string]: React.ComponentType<any> } = {
    Utensils, Wheat, Soup, Flame, Apple, Fish, Cake, Leaf, Sprout,
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Default region (Accra, Ghana)
const ACCRA_REGION: Region = {
    latitude: 5.6037,
    longitude: -0.1870,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
};

type CookMarker = {
    id: string;
    name: string;
    avatar_url: string | null;
    latitude: number;
    longitude: number;
    rating: number | null;
    location: string | null;
    listing_count: number;
    listings: {
        id: string;
        title: string;
        price: number;
        image: string | null;
        category: string | null;
        available: boolean;
    }[];
};

export default function ExploreMapScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    // State
    const [selectedCook, setSelectedCook] = useState<CookMarker | null>(null);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    // Bottom sheet — peek (collapsed) and expanded snap points
    const HEADER_SPACE = insets.top + 150;
    const PEEK_HEIGHT = 130;
    const EXPANDED_HEIGHT = SCREEN_HEIGHT - HEADER_SPACE;
    const sheetY = useRef(new Animated.Value(EXPANDED_HEIGHT - PEEK_HEIGHT)).current;
    const sheetYValue = useRef(EXPANDED_HEIGHT - PEEK_HEIGHT);
    const [sheetExpanded, setSheetExpanded] = useState(false);

    useEffect(() => {
        const id = sheetY.addListener(({ value }) => { sheetYValue.current = value; });
        return () => sheetY.removeListener(id);
    }, [sheetY]);

    const snapSheet = (expanded: boolean) => {
        setSheetExpanded(expanded);
        Animated.spring(sheetY, {
            toValue: expanded ? 0 : EXPANDED_HEIGHT - PEEK_HEIGHT,
            useNativeDriver: true,
            bounciness: 4,
        }).start();
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
            onPanResponderGrant: () => {
                sheetY.setOffset(sheetYValue.current);
                sheetY.setValue(0);
            },
            onPanResponderMove: (_, gesture) => {
                const next = gesture.dy;
                const min = -(EXPANDED_HEIGHT - PEEK_HEIGHT);
                const max = EXPANDED_HEIGHT - PEEK_HEIGHT;
                sheetY.setValue(Math.max(min, Math.min(max, next)));
            },
            onPanResponderRelease: (_, gesture) => {
                sheetY.flattenOffset();
                const shouldExpand = gesture.dy < -60 || (gesture.vy < -0.5);
                const shouldCollapse = gesture.dy > 60 || (gesture.vy > 0.5);
                if (shouldExpand) snapSheet(true);
                else if (shouldCollapse) snapSheet(false);
                else snapSheet(sheetExpanded);
            },
        })
    ).current;

    // Get user's current location
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setUserLocation({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                });
            } catch (e) {
                console.log('Location error:', e);
            }
        })();
    }, []);

    // Fetch approved cooks with location data + their listings
    const { data: cooks = [], isLoading } = useQuery({
        queryKey: ['map-cooks'],
        queryFn: async () => {
            // Get all approved cooks with lat/lng
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, rating, latitude, longitude, location')
                .eq('role', 'COOK')
                .eq('cook_application_status', 'approved')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null);

            if (error) {
                console.error('Error fetching cook profiles:', error);
                return [];
            }
            if (!profiles || profiles.length === 0) return [];

            // Get all available listings for these cooks
            const cookIds = profiles.map(p => p.id);
            const { data: listings, error: listingErr } = await supabase
                .from('listings')
                .select('id, cook_id, title, price, image, category, available')
                .in('cook_id', cookIds)
                .eq('available', true);

            if (listingErr) {
                console.error('Error fetching listings:', listingErr);
            }

            // Merge listings into cook profiles
            const cookMarkers: CookMarker[] = profiles.map(profile => {
                const cookListings = (listings || []).filter(l => l.cook_id === profile.id);
                return {
                    id: profile.id,
                    name: profile.full_name || 'Cook',
                    avatar_url: profile.avatar_url,
                    latitude: profile.latitude!,
                    longitude: profile.longitude!,
                    rating: profile.rating,
                    location: profile.location,
                    listing_count: cookListings.length,
                    listings: cookListings,
                };
            });

            return cookMarkers;
        },
        staleTime: 60 * 1000, // 1 minute
    });

    // Filter cooks by category AND food/cook name search
    const filteredCooks = useMemo(() => {
        let result = cooks;
        if (selectedCategory !== 'All') {
            const q = selectedCategory.toLowerCase();
            result = result.filter(cook => cook.listings.some(l => (l.category || '').toLowerCase().includes(q)));
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(cook =>
                cook.name.toLowerCase().includes(q) ||
                cook.listings.some(l => l.title.toLowerCase().includes(q))
            );
        }
        return result;
    }, [cooks, selectedCategory, searchQuery]);

    // Calculate distance between two points (km)
    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
    };

    // Get price range for a cook
    const getPriceRange = (cook: CookMarker): string => {
        if (cook.listings.length === 0) return 'No listings';
        const prices = cook.listings.map(l => l.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (min === max) return `₵${min}`;
        return `₵${min} - ₵${max}`;
    };

    // Map region — center on user if available, otherwise Accra
    const initialRegion = useMemo(() => {
        if (userLocation) {
            return {
                ...userLocation,
                latitudeDelta: 0.06,
                longitudeDelta: 0.06,
            };
        }
        return ACCRA_REGION;
    }, [userLocation]);

    const selectCook = (cook: CookMarker, fly = true) => {
        setSelectedCook(cook);
        snapSheet(true);
        if (fly) {
            mapRef.current?.animateToRegion({
                latitude: cook.latitude,
                longitude: cook.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            }, 500);
        }
    };

    // Render markers
    const markers = useMemo(() => {
        return filteredCooks.map((cook) => {
            const isSelected = selectedCook?.id === cook.id;

            return (
                <Marker
                    key={cook.id}
                    coordinate={{
                        latitude: cook.latitude,
                        longitude: cook.longitude,
                    }}
                    onPress={() => selectCook(cook, false)}
                    style={{ zIndex: isSelected ? 100 : 1 }}
                >
                    <View style={{ alignItems: 'center' }}>
                        {/* Food image circle */}
                        <View style={{
                            width: isSelected ? 62 : 54,
                            height: isSelected ? 62 : 54,
                            borderRadius: 31,
                            borderWidth: isSelected ? 3 : 2.5,
                            borderColor: isSelected ? '#BF592B' : '#fff',
                            overflow: 'hidden',
                            backgroundColor: '#F3F4F6',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: isSelected ? 5 : 2 },
                            shadowOpacity: isSelected ? 0.3 : 0.2,
                            shadowRadius: isSelected ? 8 : 4,
                            elevation: isSelected ? 10 : 5,
                            transform: [{ scale: isSelected ? 1.08 : 1 }],
                        }}>
                            {cook.listings[0]?.image ? (
                                <Image
                                    source={{ uri: (cook.listings[0].image.includes(',') ? cook.listings[0].image.split(',')[0].trim() : cook.listings[0].image) }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1EC' }}>
                                    <ChefHat size={22} color="#BF592B" />
                                </View>
                            )}
                        </View>
                        {/* Price pill */}
                        {cook.listings[0]?.price !== undefined && (
                            <View style={{
                                marginTop: 4,
                                backgroundColor: isSelected ? '#BF592B' : '#231915',
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 20,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.2,
                                shadowRadius: 3,
                                elevation: 3,
                            }}>
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>₵{cook.listings[0].price}</Text>
                            </View>
                        )}
                    </View>
                </Marker>
            );
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredCooks, selectedCook]);

    return (
        <View style={{ flex: 1, backgroundColor: '#FFF8F6' }}>
            {/* MAP LAYER */}
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_DEFAULT}
                initialRegion={initialRegion}
                showsUserLocation
                showsMyLocationButton={false}
                onPress={() => setSelectedCook(null)}
            >
                {markers}
            </MapView>

            {/* HEADER OVERLAY */}
            <View
                style={{
                    paddingTop: insets.top + 12,
                    paddingBottom: 14,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                }}
            >
                {/* Search pill */}
                <View
                    style={{
                        marginHorizontal: 20,
                        marginBottom: 12,
                        backgroundColor: 'white',
                        borderRadius: 9999,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 18,
                        height: 56,
                        gap: 10,
                        shadowColor: '#231915',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.12,
                        shadowRadius: 16,
                        elevation: 6,
                    }}
                >
                    <Search size={18} color="#BF592B" />
                    <View style={{ flex: 1 }}>
                        <TextInput
                            value={searchQuery}
                            onChangeText={(t) => { setSearchQuery(t); setSelectedCook(null); }}
                            placeholder="Search dishes or cooks"
                            placeholderTextColor="#8A7269"
                            style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#231915', padding: 0 }}
                            returnKeyType="search"
                        />
                        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#8A7269', marginTop: 1 }}>
                            {isLoading ? 'Loading cooks…' : `${filteredCooks.length} cook${filteredCooks.length !== 1 ? 's' : ''} near you`}
                        </Text>
                    </View>
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchQuery(''); setSelectedCook(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X size={18} color="#8A7269" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Categories Filter */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4, gap: 10 }}
                >
                    {CATEGORIES.map(category => {
                        const isActive = selectedCategory === category.name;
                        const IconComponent = ICON_MAP[category.icon];
                        return (
                        <TouchableOpacity
                            key={category.id}
                            onPress={() => {
                                setSelectedCategory(category.name);
                                setSelectedCook(null);
                            }}
                            activeOpacity={0.75}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 14,
                                paddingVertical: 9,
                                borderRadius: 999,
                                backgroundColor: isActive ? '#BF592B' : '#FFF1EC',
                                borderColor: isActive ? '#BF592B' : '#DDC1B6',
                                borderWidth: 1.5,
                                shadowColor: '#BF592B',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: isActive ? 0.2 : 0,
                                shadowRadius: 6,
                                elevation: isActive ? 3 : 0,
                            }}
                        >
                            {IconComponent && <IconComponent size={14} color={isActive ? 'white' : '#BF592B'} />}
                            <Text
                                style={{
                                    fontFamily: isActive ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium',
                                    fontSize: 13,
                                    color: isActive ? 'white' : '#56423B',
                                }}
                            >
                                {category.name}
                            </Text>
                        </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* LOADING STATE */}
            {isLoading && (
                <View style={{
                    position: 'absolute', top: '45%', alignSelf: 'center',
                    backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 20,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
                    zIndex: 60,
                }}>
                    <ActivityIndicator size="small" color="#BF592B" />
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#231915' }}>Finding cooks...</Text>
                </View>
            )}

            {/* Recenter Button */}
            {userLocation && (
                <View
                    style={{
                        position: 'absolute',
                        right: 16,
                        zIndex: 60,
                        bottom: (sheetExpanded ? EXPANDED_HEIGHT : PEEK_HEIGHT) + 16,
                    }}
                >
                    <TouchableOpacity
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: '#fff',
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                            elevation: 4,
                        }}
                        onPress={() => {
                            mapRef.current?.animateToRegion({
                                ...userLocation,
                                latitudeDelta: 0.06,
                                longitudeDelta: 0.06,
                            }, 500);
                        }}
                    >
                        <Navigation size={20} color="#BF592B" />
                    </TouchableOpacity>
                </View>
            )}

            {/* BOTTOM SHEET — drag up to browse all cooks like a list, drag down to see the map */}
            {!isLoading && (
                <Animated.View
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: EXPANDED_HEIGHT + 40,
                        backgroundColor: 'white',
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                        shadowColor: '#231915',
                        shadowOffset: { width: 0, height: -6 },
                        shadowOpacity: 0.1,
                        shadowRadius: 20,
                        elevation: 12,
                        zIndex: 55,
                        transform: [{ translateY: sheetY }],
                    }}
                >
                    {/* Drag handle + count — the draggable area */}
                    <View {...panResponder.panHandlers} style={{ paddingTop: 10, paddingBottom: 4 }}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => selectedCook ? setSelectedCook(null) : snapSheet(!sheetExpanded)}
                            style={{ alignItems: 'center' }}
                        >
                            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: '#E5D9D3', marginBottom: 12 }} />
                            {selectedCook ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#231915' }}>
                                        {selectedCook.name}
                                    </Text>
                                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#BF592B' }}>
                                        · back to all cooks
                                    </Text>
                                </View>
                            ) : filteredCooks.length > 0 ? (
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#231915' }}>
                                    {filteredCooks.length} cook{filteredCooks.length !== 1 ? 's' : ''} near you
                                </Text>
                            ) : (
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#231915' }}>
                                    No cooks in this area yet
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Selected food — replaces the list until dismissed */}
                    {selectedCook ? (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            scrollEnabled={sheetExpanded}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 24 }}
                        >
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => {
                                    if (selectedCook.listings.length > 0) router.push(`/listing/${selectedCook.listings[0].id}`);
                                }}
                                disabled={selectedCook.listings.length === 0}
                            >
                                {selectedCook.listings[0]?.image ? (
                                    <Image
                                        source={{ uri: (selectedCook.listings[0].image.includes(',') ? selectedCook.listings[0].image.split(',')[0].trim() : selectedCook.listings[0].image) }}
                                        style={{ width: '100%', height: 200, borderRadius: 20, backgroundColor: '#F2DFD7' }}
                                    />
                                ) : (
                                    <View style={{ width: '100%', height: 200, borderRadius: 20, backgroundColor: '#FFF1EC', alignItems: 'center', justifyContent: 'center' }}>
                                        <ChefHat size={40} color="#BF592B" />
                                    </View>
                                )}

                                <View style={{ marginTop: 14 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, color: '#231915', flex: 1 }} numberOfLines={1}>
                                            {selectedCook.listings[0]?.title || selectedCook.name}
                                        </Text>
                                        {selectedCook.rating && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF1EC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                                                <Star size={13} color="#BF592B" fill="#BF592B" />
                                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#BF592B' }}>{selectedCook.rating}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#56423B', marginTop: 4 }}>
                                        by {selectedCook.name}
                                    </Text>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
                                        {userLocation && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Navigation size={13} color="#8A7269" />
                                                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#56423B' }}>
                                                    {getDistance(userLocation.latitude, userLocation.longitude, selectedCook.latitude, selectedCook.longitude)}
                                                </Text>
                                            </View>
                                        )}
                                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#BF592B' }}>{getPriceRange(selectedCook)}</Text>
                                        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#8A7269' }}>
                                            {selectedCook.listing_count} dish{selectedCook.listing_count !== 1 ? 'es' : ''}
                                        </Text>
                                    </View>
                                </View>

                                <View
                                    style={{
                                        marginTop: 16,
                                        backgroundColor: '#BF592B',
                                        borderRadius: 9999,
                                        height: 52,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        opacity: selectedCook.listings.length === 0 ? 0.5 : 1,
                                    }}
                                >
                                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: 'white' }}>View Food Listing</Text>
                                    <ChevronRight size={18} color="white" />
                                </View>
                            </TouchableOpacity>
                        </ScrollView>
                    ) : (
                    /* Scrollable cook cards */
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={sheetExpanded}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 24 }}
                    >
                        {filteredCooks.map((cook) => {
                            return (
                                <TouchableOpacity
                                    key={cook.id}
                                    activeOpacity={0.85}
                                    onPress={() => selectCook(cook)}
                                    style={{
                                        flexDirection: 'row',
                                        gap: 14,
                                        padding: 12,
                                        marginBottom: 12,
                                        borderRadius: 20,
                                        backgroundColor: '#FCFBFA',
                                        borderWidth: 1.5,
                                        borderColor: '#F2DFD7',
                                    }}
                                >
                                    {cook.listings[0]?.image ? (
                                        <Image
                                            source={{ uri: (cook.listings[0].image.includes(',') ? cook.listings[0].image.split(',')[0].trim() : cook.listings[0].image) }}
                                            style={{ width: 78, height: 78, borderRadius: 16, backgroundColor: '#F2DFD7' }}
                                        />
                                    ) : (
                                        <View style={{ width: 78, height: 78, borderRadius: 16, backgroundColor: '#FFF1EC', alignItems: 'center', justifyContent: 'center' }}>
                                            <ChefHat size={30} color="#BF592B" />
                                        </View>
                                    )}
                                    <View style={{ flex: 1, justifyContent: 'center' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#231915', flex: 1 }} numberOfLines={1}>
                                                {cook.name}
                                            </Text>
                                            {cook.rating && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                                    <Star size={12} color="#BF592B" fill="#BF592B" />
                                                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#231915' }}>{cook.rating}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#56423B', marginTop: 2 }} numberOfLines={1}>
                                            {cook.listings.length > 0 ? cook.listings.map(l => l.title).slice(0, 2).join(', ') : 'New cook — menu coming soon'}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                            {userLocation && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                                    <Navigation size={11} color="#8A7269" />
                                                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#56423B' }}>
                                                        {getDistance(userLocation.latitude, userLocation.longitude, cook.latitude, cook.longitude)}
                                                    </Text>
                                                </View>
                                            )}
                                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#BF592B' }}>{getPriceRange(cook)}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (cook.listings.length > 0) router.push(`/listing/${cook.listings[0].id}`);
                                        }}
                                        disabled={cook.listings.length === 0}
                                        style={{ alignSelf: 'center' }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <ChevronRight size={20} color="#BF592B" />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            );
                        })}
                        {filteredCooks.length === 0 && (
                            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                                <MapPin size={28} color="#BF592B" />
                                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#56423B', marginTop: 8 }}>
                                    Try a different search or category
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                    )}
                </Animated.View>
            )}
        </View>
    );
}
