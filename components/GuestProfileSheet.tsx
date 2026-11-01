import React, { useEffect, useState } from 'react';
import { View, Text, Image, Modal, Pressable, TouchableOpacity } from 'react-native';
import { BadgeCheck, X } from 'lucide-react-native';
import { palette, type, fonts } from '@/constants/theme';
import TasteProfile from '@/components/TasteProfile';
import { loadPublicTaste, GuestPreferences } from '@/lib/preferencesOnboarding';

// What another guest or host sees when they tap a face at the table: photo, first name, verified badge and the PUBLIC
// taste profile. Dietary needs are never loaded or shown here — those are for the guest's own hosts only.
export default function GuestProfileSheet({ visible, onClose, userId, name, avatarUrl, verified }: {
    visible: boolean;
    onClose: () => void;
    userId?: string;
    name: string;
    avatarUrl?: string | null;
    verified?: boolean;
}) {
    const [taste, setTaste] = useState<GuestPreferences>({});

    useEffect(() => {
        if (visible && userId) loadPublicTaste(userId).then(setTaste);
    }, [visible, userId]);

    const firstName = name.trim().split(' ')[0] || 'Guest';

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(35,25,21,0.45)' }} onPress={onClose} />
            <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Close" style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
                    <X size={22} color={palette.ink} />
                </TouchableOpacity>

                <View style={{ alignItems: 'center', gap: 6, marginBottom: 18 }}>
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: palette.canvas }} />
                    ) : (
                        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ ...type.section, color: palette.accent }}>{firstName.charAt(0).toUpperCase()}</Text>
                        </View>
                    )}
                    <Text style={{ ...type.section, color: palette.ink }}>{firstName}</Text>
                    {verified && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: 'rgba(0,106,60,0.1)' }}>
                            <BadgeCheck size={14} color="#006A3C" />
                            <Text style={{ ...type.micro, color: '#006A3C' }}>Verified guest</Text>
                        </View>
                    )}
                </View>

                <TasteProfile taste={taste} emptyText={`${firstName} hasn't shared their taste yet.`} />
            </View>
        </Modal>
    );
}
