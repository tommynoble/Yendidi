import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

// Equal space above and below, so a heading sits evenly between the content before it
// and the cards after it. Change this once to retune every section heading.
export const SECTION_HEADER_SPACING = 8;

type SectionHeaderProps = {
    title: string;
    subtitle?: string;
    /** Optional leading icon, e.g. <Heart size={18} color="#BF592B" /> */
    icon?: React.ReactNode;
    /** Small pill on the right, e.g. "5 Courses". Takes the place of the action link. */
    badge?: string;
    /** Right-aligned link, e.g. "See All". Only shown when onActionPress is also set. */
    actionLabel?: string;
    onActionPress?: () => void;
    /** Set false when the parent already applies the 20px side padding. */
    inset?: boolean;
    /** Override the default top/bottom space (applied equally to both). */
    spacing?: number;
    /** Extra space added below the heading only, on top of `spacing`. */
    extraBottom?: number;
};

export default function SectionHeader({
    title,
    subtitle,
    icon,
    badge,
    actionLabel = 'See All',
    onActionPress,
    inset = true,
    spacing = SECTION_HEADER_SPACING,
    extraBottom = 0,
}: SectionHeaderProps) {
    return (
        <View style={{ paddingHorizontal: inset ? 20 : 0, paddingTop: spacing, paddingBottom: spacing + extraBottom }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                    {icon}
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#231915' }} numberOfLines={1}>{title}</Text>
                </View>
                {!!badge && (
                    <View style={{ backgroundColor: 'rgba(0,106,60,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#006A3C' }} numberOfLines={1}>{badge}</Text>
                    </View>
                )}
                {!badge && onActionPress && (
                    <TouchableOpacity onPress={onActionPress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#BF592B' }}>{actionLabel}</Text>
                    </TouchableOpacity>
                )}
            </View>
            {!!subtitle && (
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: '#56423B', marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>
            )}
        </View>
    );
}
