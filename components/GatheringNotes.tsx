import React from 'react';
import { View, Text } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

export type GatheringNote = { label: string; text: string };

// "Gathering Notes" card: short practical notes (attire, drinks, dietary…), each with a check.
export default function GatheringNotes({ notes, title }: { notes: GatheringNote[]; title?: string }) {
    return (
        <View style={{ backgroundColor: '#FFF1EC', borderRadius: 16, padding: 14 }}>
            {!!title && (
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#1B1C19', marginBottom: 10 }}>{title}</Text>
            )}
            <View style={{ gap: 10 }}>
                {notes.map((n) => (
                    <View key={n.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <View style={{ marginTop: 2 }}>
                            <CheckCircle2 size={15} color="#006A3C" />
                        </View>
                        <Text style={{ flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 18, color: '#55433C' }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#1B1C19' }}>{n.label}: </Text>
                            {n.text}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
