import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { palette, type, fonts } from '@/constants/theme';

// Equal space above and below, so a heading sits evenly between the content before it
// and the cards after it. Change this once to retune every section heading.
export const SECTION_HEADER_SPACING = 8;

type SectionHeaderProps = {
    title: string;
    subtitle?: string;
    /** Optional leading icon, e.g. <Heart size={18} color={palette.accent} /> */
    icon?: React.ReactNode;
    /** Small pill on the right, e.g. "5 Courses". Takes the place of the action link. */
    badge?: string;
    /** Right-aligned link, e.g. "See All". Only shown when onActionPress is also set. */
    actionLabel?: string;
    onActionPress?: () => void;
    /** Small icon after the action link, e.g. a chevron for an expand/collapse toggle. */
    actionIcon?: React.ReactNode;
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
    actionIcon,
    inset = true,
    spacing = SECTION_HEADER_SPACING,
    extraBottom = 0,
}: SectionHeaderProps) {
    return (
        <View style={{ paddingHorizontal: inset ? 20 : 0, paddingTop: spacing, paddingBottom: spacing + extraBottom }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                    {icon}
                    <Text style={{ ...type.section, color: palette.ink }} numberOfLines={1}>{title}</Text>
                </View>
                {!!badge && (
                    <View style={{ backgroundColor: 'rgba(0,106,60,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
                        <Text style={{ ...type.micro, color: '#006A3C' }} numberOfLines={1}>{badge}</Text>
                    </View>
                )}
                {!badge && onActionPress && (
                    <TouchableOpacity onPress={onActionPress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ ...type.micro, color: palette.accent }}>{actionLabel}</Text>
                        {actionIcon}
                    </TouchableOpacity>
                )}
            </View>
            {!!subtitle && (
                <Text style={{ ...type.meta, fontFamily: fonts.regular, color: palette.muted, marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>
            )}
        </View>
    );
}
