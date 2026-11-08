import React from 'react';
import { View, Text } from 'react-native';
import { palette, type, fonts } from '@/constants/theme';

export type Course = {
    title: string;
    /** small label above the title, e.g. "Starter" */
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
                        backgroundColor: palette.surface,
                        // the highlighted course keeps an accent outline so it still stands out
                        borderWidth: 1,
                        borderColor: c.highlight ? 'rgba(194, 83, 39,0.45)' : 'transparent',
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
                        <Text style={{ ...type.micro, fontFamily: fonts.bold, color: c.highlight ? 'white' : '#944421' }}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        {!!c.tag && (
                            <Text style={{ ...type.micro, color: c.highlight ? '#944421' : palette.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 }} numberOfLines={1}>
                                {c.tag}
                            </Text>
                        )}
                        <Text style={{ fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: c.highlight ? '#944421' : palette.ink }}>
                            {c.title}
                        </Text>
                        {!!c.description && (
                            <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.bodyText, marginTop: 4 }}>
                                {c.description}
                            </Text>
                        )}
                        {!!c.chips?.length && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                {c.chips.map((chip) => (
                                    <View key={chip} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999, backgroundColor: palette.surface, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.35)' }}>
                                        <Text style={{ ...type.micro, fontFamily: fonts.medium, color: palette.bodyText }}>{chip}</Text>
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
