import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import MapViewWrapper, { Marker } from './MapViewWrapper';
import * as Location from 'expo-location';
import { LocateFixed } from 'lucide-react-native';
import { palette, type, fonts } from '@/constants/theme';

interface LocationPickerProps {
    onLocationPicked: (location: { lat: number; lng: number; address?: string }) => void;
}

export default function LocationPicker({ onLocationPicked }: LocationPickerProps) {
    const [mapRegion, setMapRegion] = useState<{
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    } | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission to access location was denied',
                    'You need to grant location permissions to use this app.'
                );
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setMapRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
            });
            onLocationPicked({
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            });
        })();
    }, []);

    const verifyPermissions = async () => {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
            const permissionResponse = await Location.requestForegroundPermissionsAsync();
            return permissionResponse.status === 'granted';
        }
        return true;
    };

    const getLocationHandler = async () => {
        const hasPermission = await verifyPermissions();
        if (!hasPermission) {
            return;
        }

        try {
            setIsFetching(true);
            const location = await Location.getCurrentPositionAsync();
            setMapRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
            });
            onLocationPicked({
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            });
        } catch (err) {
            Alert.alert(
                'Could not fetch location!',
                'Please try again later or pick a location on the map.'
            );
        }
        setIsFetching(false);
    };

    const mapRegionChangeHandler = (region: any) => {
        // conceptual: update region if we want to track where they drag
    };

    const selectLocationHandler = (event: any) => {
        const lat = event.nativeEvent.coordinate.latitude;
        const lng = event.nativeEvent.coordinate.longitude;

        setMapRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
        });

        onLocationPicked({ lat: lat, lng: lng });
    };

    return (
        <View style={styles.locationPicker}>
            <View style={styles.mapPreview}>
                {isFetching ? (
                    <ActivityIndicator size="large" color={palette.accent} />
                ) : mapRegion ? (
                    <MapViewWrapper
                        style={styles.map}
                        region={mapRegion}
                        onPress={selectLocationHandler}
                        showsUserLocation
                        showsMyLocationButton
                    >
                        <Marker title="Picked Location" coordinate={mapRegion} />
                    </MapViewWrapper>
                ) : (
                    <Text style={{ ...type.body, color: palette.muted }}>No location chosen yet</Text>
                )}
            </View>
            <View style={styles.actions}>
                <TouchableOpacity style={styles.button} onPress={getLocationHandler}>
                    <LocateFixed size={18} color="white" />
                    <Text style={styles.buttonText}>Use My Location</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    locationPicker: {
        marginBottom: 12,
    },
    mapPreview: {
        marginBottom: 12,
        width: '100%',
        height: 240,
        borderColor: '#F2DFD7',
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: palette.canvas,
        borderRadius: 16,
        overflow: 'hidden'
    },
    map: {
        width: '100%',
        height: '100%',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.accent,
        height: 44,
        paddingHorizontal: 20,
        borderRadius: 14,
        gap: 8
    },
    buttonText: {
        ...type.body,
        fontFamily: fonts.bold,
        color: 'white'
    }
});
