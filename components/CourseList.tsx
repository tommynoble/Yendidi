import React from 'react';
import { View, Text } from 'react-native';

export type Course = {
    title: string;
    /** short label on the right, e.g. "Starters" */
    tag?: string;
    description?: string;
    /** small pills under the description (ingredients, categories…) */
    chips?: string[];
    /** the featured course: tinted card, dark number badge, brown title */
    highlight?: boolean;
};

// Numbered course list ("The Hearth Feast").
export default function CourseList({ courses }: { courses: Course[] }) {
    return (
        <View style={{ gap: 8 }}>
            {courses.map((c, i) => (
                <View
                    key={`${c.title}-${i}`}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 14,
                        borderRadius: 16,
                        backgroundColor: c.highlight ? 'rgba(191,89,43,0.10)' : '#FFF1EC',
                    }}
                >
                    <View
                        style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: c.highlight ? '#944421' : '#FFDBCE',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 1,
                        }}
                    >
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: c.highlight ? 'white' : '#944421' }}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <Text
                                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: c.highlight ? '#944421' : '#1B1C19', flexShrink: 1 }}
                                numberOfLines={1}
                            >
                                {c.title}
                            </Text>
                            {!!c.tag && (
                                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: c.highlight ? '#944421' : '#88726B' }} numberOfLines={1}>
                                    {c.tag}
                                </Text>
                            )}
                        </View>
                        {!!c.description && (
                            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 18, color: '#55433C', marginTop: 4 }}>
                                {c.description}
                            </Text>
                        )}
                        {!!c.chips?.length && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                {c.chips.map((chip) => (
                                    <View key={chip} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(191,89,43,0.2)' }}>
                                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: '#55433C' }}>{chip}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            ))}
        </View>
    );
}
