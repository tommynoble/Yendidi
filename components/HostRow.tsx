import React from 'react';
import { View, Text, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Location pin from Icon.svg (native 10x12).
function LocationPinIcon({ height }: { height: number }) {
    return (
        <Svg width={(height * 10) / 12} height={height} viewBox="0 0 10 12" fill="none">
            <Path
                d="M4.66667 5.83333C4.9875 5.83333 5.26215 5.7191 5.49062 5.49062C5.7191 5.26215 5.83333 4.9875 5.83333 4.66667C5.83333 4.34583 5.7191 4.07118 5.49062 3.84271C5.26215 3.61424 4.9875 3.5 4.66667 3.5C4.34583 3.5 4.07118 3.61424 3.84271 3.84271C3.61424 4.07118 3.5 4.34583 3.5 4.66667C3.5 4.9875 3.61424 5.26215 3.84271 5.49062C4.07118 5.7191 4.34583 5.83333 4.66667 5.83333V5.83333M4.66667 10.1208C5.85278 9.03194 6.73264 8.04271 7.30625 7.15312C7.87986 6.26354 8.16667 5.47361 8.16667 4.78333C8.16667 3.72361 7.82882 2.8559 7.15312 2.18021C6.47743 1.50451 5.64861 1.16667 4.66667 1.16667C3.68472 1.16667 2.8559 1.50451 2.18021 2.18021C1.50451 2.8559 1.16667 3.72361 1.16667 4.78333C1.16667 5.47361 1.45347 6.26354 2.02708 7.15312C2.60069 8.04271 3.48056 9.03194 4.66667 10.1208V10.1208M4.66667 11.6667C3.10139 10.3347 1.93229 9.09757 1.15937 7.95521C0.386458 6.81285 0 5.75556 0 4.78333C0 3.325 0.469097 2.16319 1.40729 1.29792C2.34549 0.432639 3.43194 0 4.66667 0C5.90139 0 6.98785 0.432639 7.92604 1.29792C8.86424 2.16319 9.33333 3.325 9.33333 4.78333C9.33333 5.75556 8.94688 6.81285 8.17396 7.95521C7.40104 9.09757 6.23194 10.3347 4.66667 11.6667V11.6667M4.66667 4.66667V4.66667"
                fill="#944421"
            />
        </Svg>
    );
}

type HostRowProps = {
    name?: string;
    avatarUrl?: string | null;
    location?: string | null;
    /** Smaller version for narrow cards. */
    compact?: boolean;
    /** Set false to hide the cook's avatar. */
    showAvatar?: boolean;
    /** Set false to hide the cook's name. */
    showName?: boolean;
};

// Cook avatar + name + pin/location, from the Container.svg spec. Each part can be switched off,
// so the same component renders just the location line (showAvatar={false} showName={false}).
export default function HostRow({ name = '', avatarUrl, location, compact = false, showAvatar = true, showName = true }: HostRowProps) {
    const avatarSize = compact ? 24 : 30;
    const nameSize = compact ? 10.5 : 12;
    const locationSize = compact ? 8 : 9;

    const locationLine = !!location && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <LocationPinIcon height={compact ? 9 : 10} />
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: locationSize, lineHeight: 12, color: '#55433C', flexShrink: 1 }} numberOfLines={1}>{location}</Text>
        </View>
    );

    if (!showAvatar && !showName) return locationLine || null;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 8 : 10 }}>
            {showAvatar && (avatarUrl ? (
                <Image
                    source={{ uri: avatarUrl }}
                    style={{ width: avatarSize, height: avatarSize, borderRadius: 9999, borderWidth: 2, borderColor: '#FFDBCE', backgroundColor: '#F2DFD7' }}
                />
            ) : (
                <View style={{ width: avatarSize, height: avatarSize, borderRadius: 9999, borderWidth: 2, borderColor: '#FFDBCE', backgroundColor: '#FFDBCE', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: nameSize, color: '#944421' }}>{name.charAt(0).toUpperCase()}</Text>
                </View>
            ))}
            <View style={{ flex: 1 }}>
                {showName && (
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: nameSize, lineHeight: compact ? 14 : 16, color: '#1B1C19' }} numberOfLines={1}>{name}</Text>
                )}
                {locationLine}
            </View>
        </View>
    );
}
