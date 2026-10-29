import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';

type HostHighlightCardProps = {
    name: string;
    subtitle?: string;
    avatarUrl?: string | null;
    verified?: boolean;
    onPressStory?: () => void;
};

// Host card with avatar, name, one-line background and a "Host Story" button (Host Highlight Card_margin.svg).
export default function HostHighlightCard({ name, subtitle, avatarUrl, verified, onPressStory }: HostHighlightCardProps) {
    return (
        <View style={{ borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View>
                <Image
                    source={{ uri: avatarUrl || 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150' }}
                    style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#F2DFD7' }}
                />
                {verified && (
                    <View style={{ position: 'absolute', right: -4, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#715C00', alignItems: 'center', justifyContent: 'center' }}>
                        <BadgeCheck size={12} color="white" />
                    </View>
                )}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18, lineHeight: 22, color: '#1B1C19' }} numberOfLines={1}>{name}</Text>
                {!!subtitle && (
                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 18, color: '#55433C', marginTop: 2 }} numberOfLines={2}>{subtitle}</Text>
                )}
            </View>
            {onPressStory && (
                <TouchableOpacity
                    onPress={onPressStory}
                    activeOpacity={0.8}
                    style={{ width: 78, height: 44, borderRadius: 22, backgroundColor: '#F2DFD7', alignItems: 'center', justifyContent: 'center' }}
                >
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, lineHeight: 16, color: '#944421', textAlign: 'center' }}>Host{'\n'}Story</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
