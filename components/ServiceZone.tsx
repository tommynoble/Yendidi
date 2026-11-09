import React, { useRef, useState } from 'react';
import { View, Text, PanResponder } from 'react-native';
import { Compass, MapPin } from 'lucide-react-native';
import MapViewWrapper, { Marker, Circle } from '@/components/MapViewWrapper';
import { palette, fonts } from '@/constants/theme';

export const MIN_RADIUS_KM = 2;
export const MAX_RADIUS_KM = 15;
const STEP = 0.5;
const THUMB = 28;

const cardBorder = 'rgba(194, 83, 39, 0.25)';
const clamp = (v: number) => Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Math.round(v / STEP) * STEP));

type Props = {
    latitude: number | null;
    longitude: number | null;
    locationLabel: string;
    radiusKm: number;
    onChange: (km: number) => void;
};

// The kitchen's service zone: a map with the radius drawn around the kitchen, and a slider to change it.
export default function ServiceZone({ latitude, longitude, locationLabel, radiusKm, onChange }: Props) {
    const [trackWidth, setTrackWidth] = useState(0);
    const widthRef = useRef(0);
    const valueRef = useRef(radiusKm);
    const startRef = useRef(radiusKm);
    valueRef.current = radiusKm;
    const range = MAX_RADIUS_KM - MIN_RADIUS_KM;

    const pan = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: evt => {
                if (!widthRef.current) return;
                const next = clamp(MIN_RADIUS_KM + (evt.nativeEvent.locationX / widthRef.current) * range);
                startRef.current = next;
                if (next !== valueRef.current) onChange(next);
            },
            onPanResponderMove: (_, g) => {
                if (!widthRef.current) return;
                const next = clamp(startRef.current + (g.dx / widthRef.current) * range);
                if (next !== valueRef.current) onChange(next);
            },
        })
    ).current;

    const hasPoint = latitude != null && longitude != null;
    const delta = Math.max(0.04, (radiusKm * 2.8) / 111);
    const fraction = (radiusKm - MIN_RADIUS_KM) / range;
    const thumbLeft = Math.max(0, Math.min(trackWidth - THUMB, fraction * (trackWidth - THUMB)));

    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Compass size={18} color={palette.accent} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.ink }}>Service Zone</Text>
                </View>
                <View style={{ backgroundColor: '#9C3F12', borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#FFFFFF' }}>{radiusKm.toFixed(1)} km coverage</Text>
                </View>
            </View>

            <View style={{ borderRadius: 16, backgroundColor: '#FBDCCD', padding: 12, borderWidth: 1, borderColor: cardBorder }}>
            <View style={{ height: 190, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F2DFD7', alignItems: 'center', justifyContent: 'center' }}>
                {hasPoint ? (
                    <View pointerEvents="none" style={{ width: '100%', height: '100%' }}>
                        <MapViewWrapper
                            style={{ width: '100%', height: '100%' }}
                            region={{ latitude: latitude as number, longitude: longitude as number, latitudeDelta: delta, longitudeDelta: delta }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                            toolbarEnabled={false}
                        >
                            <Circle
                                center={{ latitude: latitude as number, longitude: longitude as number }}
                                radius={radiusKm * 1000}
                                fillColor="rgba(194, 83, 39, 0.2)"
                                strokeColor="rgba(156, 63, 18, 0.7)"
                                strokeWidth={2}
                            />
                            <Marker coordinate={{ latitude: latitude as number, longitude: longitude as number }} pinColor="#9C3F12" />
                        </MapViewWrapper>
                    </View>
                ) : (
                    <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
                        <MapPin size={28} color="#8A7269" />
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.muted, textAlign: 'center', marginTop: 6 }}>Your kitchen's GPS location isn't set yet, so there's no map to show.</Text>
                    </View>
                )}
                {!!locationLabel && (
                    <View pointerEvents="none" style={{ position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}>
                        <MapPin size={16} color="#9C3F12" />
                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: palette.ink }}>{locationLabel}</Text>
                    </View>
                )}
            </View>

            <View style={{ borderRadius: 14, backgroundColor: '#FFF8F5', padding: 16, marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: palette.ink }}>Service Radius</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#9C3F12' }}>{radiusKm.toFixed(1)} km</Text>
                </View>
                <View
                    {...pan.panHandlers}
                    onLayout={e => { widthRef.current = e.nativeEvent.layout.width; setTrackWidth(e.nativeEvent.layout.width); }}
                    style={{ height: 40, justifyContent: 'center', marginTop: 6 }}
                >
                    <View pointerEvents="none" style={{ height: 8, borderRadius: 4, backgroundColor: '#E8D5CC' }}>
                        <View style={{ width: `${fraction * 100}%`, height: 8, borderRadius: 4, backgroundColor: '#C25327', opacity: 0.35 }} />
                    </View>
                    <View pointerEvents="none" style={{ position: 'absolute', left: thumbLeft, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#9C3F12', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 4 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>{MIN_RADIUS_KM} km (Local)</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>{MAX_RADIUS_KM} km (Wider area)</Text>
                </View>
            </View>
            </View>
        </View>
    );
}
