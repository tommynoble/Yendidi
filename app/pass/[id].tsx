import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, MapPin, Ticket, ExternalLink } from 'lucide-react-native';
import { palette, type, fonts } from '@/constants/theme';
import { getPass } from '@/lib/passes';

const { width } = Dimensions.get('window');
const ICONS = { calendar: Calendar, pin: MapPin, ticket: Ticket } as const;

// Page for an Exclusive YenDidii Pass: photo, what it is, the confirmed details, and one real action when there is an official link.
export default function PassScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const pass = getPass(id);

    if (!pass) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas, padding: 24 }}>
                <Text style={{ ...type.body, color: palette.bodyText, textAlign: 'center', marginBottom: 16 }}>Sorry, we couldn't find that pass.</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ ...type.card, fontFamily: fonts.bold, color: palette.accent }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: palette.canvas }}>
            <TouchableOpacity
                onPress={() => router.back()}
                accessibilityLabel="Go back"
                style={{ position: 'absolute', left: 20, top: insets.top + 8, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
            >
                <ArrowLeft size={20} color="white" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
                <View style={{ width, height: 340, backgroundColor: pass.bgColor ?? '#F2DFD7', alignItems: 'center', justifyContent: 'center' }}>
                    {pass.anchor === 'logo' ? (
                        <Image source={pass.image ?? { uri: pass.imageUrl }} style={{ width: width * 0.7, height: 160 }} resizeMode="contain" />
                    ) : (
                        <Image source={pass.image ?? { uri: pass.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    )}
                </View>

                <View style={{ backgroundColor: palette.canvas, borderTopLeftRadius: 36, borderTopRightRadius: 36, marginTop: -32, paddingHorizontal: 20, paddingTop: 28 }}>
                    <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(194, 83, 39,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, marginBottom: 12 }}>
                        <Text style={{ ...type.micro, fontFamily: fonts.bold, color: palette.accent, letterSpacing: 0.8, textTransform: 'uppercase' }}>{pass.tag}</Text>
                    </View>

                    <Text style={{ ...type.hero, color: palette.ink, lineHeight: 32, marginBottom: 8 }}>{pass.title}</Text>
                    <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.bodyText, marginBottom: 18 }}>{pass.subtitle}</Text>

                    <View style={{ height: 1, backgroundColor: 'rgba(86,66,59,0.15)', marginBottom: 18 }} />

                    {!!pass.details?.length && (
                        <View style={{ gap: 8, marginBottom: 18 }}>
                            {pass.details.map((d) => {
                                const Icon = ICONS[d.icon];
                                return (
                                    <View key={d.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
                                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFDBCE', alignItems: 'center', justifyContent: 'center' }}>
                                            <Icon size={16} color={palette.accent} />
                                        </View>
                                        <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.ink, flex: 1 }}>{d.text}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <Text style={{ ...type.section, color: palette.ink, marginBottom: 6 }}>About this pass</Text>
                    <Text style={{ ...type.body, fontFamily: fonts.medium, color: palette.bodyText, lineHeight: 22, marginBottom: 24 }}>{pass.about}</Text>

                    {pass.link ? (
                        <>
                            <TouchableOpacity
                                onPress={() => Linking.openURL(pass.link!.url)}
                                activeOpacity={0.85}
                                accessibilityRole="link"
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: palette.accent }}
                            >
                                <Text style={{ ...type.body, fontFamily: fonts.bold, color: 'white' }}>{pass.link.label}</Text>
                                <ExternalLink size={16} color="white" />
                            </TouchableOpacity>
                            <Text style={{ ...type.meta, color: palette.bodyText, textAlign: 'center', marginTop: 10 }}>Opens the official ticket page in your browser.</Text>
                        </>
                    ) : (
                        <View style={{ backgroundColor: palette.surface, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(194, 83, 39,0.25)', padding: 14 }}>
                            <Text style={{ ...type.body, fontFamily: fonts.semibold, color: palette.ink }}>More details coming soon</Text>
                            <Text style={{ ...type.meta, color: palette.bodyText, marginTop: 2 }}>We'll add booking details here as soon as they're confirmed.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
