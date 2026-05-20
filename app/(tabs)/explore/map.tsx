import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Map, List, Star, ChevronRight, Navigation, MapPin, ChefHat, Search, X } from 'lucide-react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';

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

    // Derive categories from actual listings
    const categories = useMemo(() => {
        const cats = new Set<string>();
        cooks.forEach(cook => {
            cook.listings.forEach(l => {
                if (l.category) cats.add(l.category);
            });
        });
        return ['All', ...Array.from(cats)];
    }, [cooks]);

    // Filter cooks by category AND food/cook name search
    const filteredCooks = useMemo(() => {
        let result = cooks;
        if (selectedCategory !== 'All') {
            result = result.filter(cook => cook.listings.some(l => l.category === selectedCategory));
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

    // Render markers
    const markers = useMemo(() => {
        return filteredCooks.map((cook) => {
            const isSelected = selectedCook?.id === cook.id;
            const hasListings = cook.listing_count > 0;

            return (
                <Marker
                    key={cook.id}
                    coordinate={{
                        latitude: cook.latitude,
                        longitude: cook.longitude,
                    }}
                    onPress={() => setSelectedCook(cook)}
                    style={{ zIndex: isSelected ? 100 : 1 }}
                >
                    <View style={{ alignItems: 'center' }}>
                        {/* Food image circle */}
                        <View style={{
                            width: isSelected ? 62 : 54,
                            height: isSelected ? 62 : 54,
                            borderRadius: 31,
                            borderWidth: isSelected ? 3 : 2.5,
                            borderColor: isSelected ? '#D65A31' : '#fff',
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
                                    source={{ uri: cook.listings[0].image }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0EB' }}>
                                    <ChefHat size={22} color="#D65A31" />
                                </View>
                            )}
                        </View>
                        {/* Price pill */}
                        {cook.listings[0]?.price !== undefined && (
                            <View style={{
                                marginTop: 4,
                                backgroundColor: isSelected ? '#D65A31' : '#1F2937',
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
    }, [filteredCooks, selectedCook]);

    return (
        <View style={{ flex: 1, backgroundColor: '#FAF9F6' }}>
            {/* MAP LAYER */}
            <MapView
                ref={mapRef}
                style={[StyleSheet.absoluteFillObject, { marginBottom: 90 }]}
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
                    paddingBottom: 16,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    elevation: 10,
                }}
            >
                {/* Top Row: Title + Toggle */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
                    <View>
                        <Text className="text-xl font-bold text-text-main font-sans-bold">Map View</Text>
                        <Text className="text-sm text-text-sub font-sans">
                            {isLoading ? 'Loading cooks...' : `${filteredCooks.length} cook${filteredCooks.length !== 1 ? 's' : ''} near you`}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', padding: 4, borderRadius: 999 }}>
                        <TouchableOpacity
                            style={{ padding: 8, borderRadius: 999, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
                            activeOpacity={1}
                        >
                            <Map size={20} color="#D65A31" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{ padding: 8, borderRadius: 999 }}
                            onPress={() => router.push('/(tabs)/explore/list')}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <List size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginBottom: 12, backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
                    <Search size={16} color="#9CA3AF" />
                    <TextInput
                        value={searchQuery}
                        onChangeText={(t) => { setSearchQuery(t); setSelectedCook(null); }}
                        placeholder="Search food or cook..."
                        placeholderTextColor="#9CA3AF"
                        style={{ flex: 1, fontSize: 15, color: '#1F2937' }}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchQuery(''); setSelectedCook(null); }}>
                            <X size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Categories Filter */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 4, gap: 12 }}
                >
                    {categories.map(category => (
                        <TouchableOpacity
                            key={category}
                            onPress={() => {
                                setSelectedCategory(category);
                                setSelectedCook(null);
                            }}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: 999,
                                backgroundColor: selectedCategory === category ? '#2D241E' : '#fff',
                                borderColor: selectedCategory === category ? '#2D241E' : '#E5E7EB',
                                borderWidth: 1,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: selectedCategory === category ? 0.2 : 0.05,
                                shadowRadius: 2,
                                elevation: selectedCategory === category ? 4 : 1,
                            }}
                        >
                            <Text
                                className={`font-semibold font-sans-semibold ${selectedCategory === category ? 'text-white' : 'text-text-sub'}`}
                            >
                                {category}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* LOADING STATE */}
            {isLoading && (
                <View style={{
                    position: 'absolute', top: '50%', alignSelf: 'center',
                    backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 20,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
                    zIndex: 60,
                }}>
                    <ActivityIndicator size="small" color="#D65A31" />
                    <Text className="font-bold text-text-main font-sans-bold">Finding cooks...</Text>
                </View>
            )}

            {/* FLOATING CARD - DYNAMIC */}
            {selectedCook ? (
                /* Selected Cook Callout */
                <View
                    style={{
                        position: 'absolute', bottom: 110, left: 16, right: 16,
                        backgroundColor: '#fff', borderRadius: 24,
                        padding: 16,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
                        zIndex: 60,
                    }}
                >
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        {/* Cook Avatar or First Listing Image */}
                        {selectedCook.listings.length > 0 && selectedCook.listings[0].image ? (
                            <Image
                            source={{ uri: selectedCook.listings[0].image! }}
                                style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: '#F3F4F6' }}
                            />
                        ) : (
                            <View style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: '#FFF0EB', alignItems: 'center', justifyContent: 'center' }}>
                                <ChefHat size={36} color="#D65A31" />
                            </View>
                        )}
                        <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 2 }}>
                            <View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F2937', flex: 1 }} numberOfLines={1}>
                                        {selectedCook.name}
                                    </Text>
                                    {selectedCook.rating && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                            <Star size={14} color="#D97706" fill="#D97706" />
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#B45309' }}>{selectedCook.rating}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                                    {selectedCook.listings.length > 0
                                        ? selectedCook.listings.map(l => l.title).slice(0, 2).join(', ')
                                        : 'New cook — menu coming soon'}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                {userLocation && (
                                    <>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Navigation size={14} color="#9CA3AF" />
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563' }}>
                                                {getDistance(userLocation.latitude, userLocation.longitude, selectedCook.latitude, selectedCook.longitude)}
                                            </Text>
                                        </View>
                                        <Text style={{ fontSize: 13, color: '#D1D5DB' }}>•</Text>
                                    </>
                                )}
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563' }}>{getPriceRange(selectedCook)}</Text>
                                <Text style={{ fontSize: 13, color: '#D1D5DB' }}>•</Text>
                                <Text style={{ fontSize: 13, color: '#6B7280' }}>{selectedCook.listing_count} dish{selectedCook.listing_count !== 1 ? 'es' : ''}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: selectedCook.listing_count > 0 ? '#007A33' : '#FF9500' }} />
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#4B5563' }}>
                                {selectedCook.listing_count > 0 ? 'Cooking Now' : 'Setting up kitchen'}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={{ backgroundColor: '#D65A31', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                            onPress={() => {
                                if (selectedCook.listings.length > 0) {
                                    router.push(`/listing/${selectedCook.listings[0].id}`);
                                }
                            }}
                            disabled={selectedCook.listings.length === 0}
                        >
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>View Menu</Text>
                            <ChevronRight size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            ) : !isLoading ? (
                /* Tappable Cook Count Pill — tapping flies to nearest cook */
                <TouchableOpacity
                    onPress={() => {
                        if (filteredCooks.length === 0) return;
                        // Find the nearest cook to user, or just use first
                        let target = filteredCooks[0];
                        if (userLocation) {
                            let minDist = Infinity;
                            filteredCooks.forEach(cook => {
                                const dLat = cook.latitude - userLocation.latitude;
                                const dLon = cook.longitude - userLocation.longitude;
                                const d = Math.sqrt(dLat * dLat + dLon * dLon);
                                if (d < minDist) { minDist = d; target = cook; }
                            });
                        }
                        setSelectedCook(target);
                        mapRef.current?.animateToRegion({
                            latitude: target.latitude,
                            longitude: target.longitude,
                            latitudeDelta: 0.02,
                            longitudeDelta: 0.02,
                        }, 600);
                    }}
                    style={{
                        position: 'absolute', bottom: 110, alignSelf: 'center',
                        backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
                        flexDirection: 'row', alignItems: 'center', gap: 8,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
                        zIndex: 60,
                    }}
                    activeOpacity={0.8}
                >
                    {filteredCooks.length > 0 ? (
                        <>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#007A33' }} />
                            <Text className="font-bold text-base text-text-main font-sans-bold">
                                {filteredCooks.length} Cook{filteredCooks.length !== 1 ? 's' : ''} Near You
                            </Text>
                            <ChevronRight size={16} color="#D65A31" />
                        </>
                    ) : (
                        <>
                            <MapPin size={16} color="#D65A31" />
                            <Text className="font-bold text-base text-text-main font-sans-bold">
                                No cooks in this area yet
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            ) : null}

            {/* Recenter Button */}
            {userLocation && (
                <TouchableOpacity
                    style={{
                        position: 'absolute',
                        bottom: selectedCook ? 280 : 170,
                        right: 16,
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
                        zIndex: 60,
                    }}
                    onPress={() => {
                        mapRef.current?.animateToRegion({
                            ...userLocation,
                            latitudeDelta: 0.06,
                            longitudeDelta: 0.06,
                        }, 500);
                    }}
                >
                    <Navigation size={20} color="#D65A31" />
                </TouchableOpacity>
            )}
        </View>
    );
}
