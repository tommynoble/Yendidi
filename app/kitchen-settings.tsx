import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Navigation, Camera, User, Phone, Mail, Pencil, BadgeCheck, ShieldCheck, Star, Asterisk, Save, ExternalLink, CircleHelp, X, Plus, Wheat, Soup, Utensils, Flame, Apple } from 'lucide-react-native';
import KitchenPotIcon from '@/components/KitchenPotIcon';
import ForkKnifeIcon from '@/components/ForkKnifeIcon';
import ServiceZone from '@/components/ServiceZone';
import HostHatIcon from '@/components/HostHatIcon';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { palette, fonts } from '@/constants/theme';

// `value` is what is stored on the profile (unchanged); icons match the category pills on the eater home screen.
const SPECIALTIES = [
    { value: 'Rice Dishes 🍚', label: 'Rice Dishes', Icon: Wheat },
    { value: 'Soups & Stews 🍲', label: 'Soups & Stews', Icon: Soup },
    { value: 'Swallows & Solids 🥣', label: 'Swallows & Solids', Icon: Utensils },
    { value: 'Grills & Sides 🍢', label: 'Grills & Sides', Icon: Flame },
    { value: 'Snacks & Drinks 🍹', label: 'Snacks & Drinks', Icon: Apple },
];

const BIO_LIMIT = 300;
const MAX_PHOTOS = 6;
const photoBorder = 'rgba(194, 83, 39, 0.45)';
const fieldBorder = 'rgba(194, 83, 39, 0.14)';
const dividerColor = 'rgba(194, 83, 39, 0.18)';
const iconMuted = '#8A7269';
const pageBg = palette.canvas;
const fieldFill = '#FFF8F5';

export default function KitchenSettingsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const kitchenNameRef = useRef<TextInput>(null);

    const [userId, setUserId] = useState<string | null>(null);
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [email, setEmail] = useState('');
    const [rating, setRating] = useState<number | null>(null);
    const [reviewCount, setReviewCount] = useState(0);
    const [idVerified, setIdVerified] = useState(false);
    const [idVerifiedAt, setIdVerifiedAt] = useState<string | null>(null);
    const [addressConfirmed, setAddressConfirmed] = useState(false);

    const [kitchenName, setKitchenName] = useState('');
    const [bio, setBio] = useState('');
    const [kitchenStory, setKitchenStory] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [kitchenAssistant, setKitchenAssistant] = useState('');

    const [location, setLocation] = useState('');
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [serviceRadius, setServiceRadius] = useState(5);
    const [locationDescription, setLocationDescription] = useState('');
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [exampleDishes, setExampleDishes] = useState<string[]>([]);
    const [photos, setPhotos] = useState<string[]>([]);
    // false until the kitchen-photos database update (supabase/migrations/20261108130000) has been run: then only one photo works
    const [photosReady, setPhotosReady] = useState(true);
    const { width: screenWidth } = useWindowDimensions();
    const [imageUploading, setImageUploading] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);
            setEmail(user.email || '');
            setPhoneVerified(!!user.phone_confirmed_at);

            const { data } = await supabase
                .from('profiles')
                .select('full_name, phone, latitude, longitude, rating, id_verified, id_verified_at, address_confirmed, kitchen_name, bio, location, location_description, specialties, kitchen_image_url, example_dishes')
                .eq('id', user.id)
                .single();

            if (data) {
                setFullName(data.full_name || '');
                setPhone(data.phone || user.phone || '');
                setRating(typeof data.rating === 'number' ? data.rating : data.rating ? Number(data.rating) : null);
                setIdVerified(!!data.id_verified);
                setIdVerifiedAt(data.id_verified_at || null);
                setAddressConfirmed(!!data.address_confirmed);
                setKitchenName(data.kitchen_name || '');
                setBio(data.bio || '');
                setLocation(data.location || '');
                setCoords(data.latitude != null && data.longitude != null ? { lat: Number(data.latitude), lng: Number(data.longitude) } : null);
                setLocationDescription(data.location_description || '');
                setSpecialties(data.specialties || []);
                setExampleDishes(
                    data.example_dishes
                        ? data.example_dishes.split(',').map((d: string) => d.trim()).filter(Boolean)
                        : []
                );
                setPhotos(data.kitchen_image_url ? [data.kitchen_image_url] : []);
            }

            const { count } = await supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('cook_id', user.id);
            setReviewCount(count || 0);

            const { data: photoRow, error: photoErr } = await supabase.from('profiles').select('kitchen_photos').eq('id', user.id).single();
            if (photoErr) setPhotosReady(false);
            else if (photoRow?.kitchen_photos?.length) setPhotos(photoRow.kitchen_photos);

            // Needs the service-radius database update; until it has been run the default stays.
            const { data: radiusRow } = await supabase.from('profiles').select('service_radius_km').eq('id', user.id).single();
            if (radiusRow?.service_radius_km != null) setServiceRadius(Number(radiusRow.service_radius_km));

            // The story and private contacts need the newer database columns; if they are missing, the rest still works.
            const { data: storyRow, error: storyErr } = await supabase.from('profiles').select('kitchen_story').eq('id', user.id).single();
            const { data: contactRow, error: contactErr } = await supabase.from('host_contacts').select('emergency_contact, kitchen_assistant').eq('user_id', user.id).maybeSingle();
            if (!storyErr && !contactErr) {
                setKitchenStory(storyRow?.kitchen_story || '');
                setEmergencyContact(contactRow?.emergency_contact || '');
                setKitchenAssistant(contactRow?.kitchen_assistant || '');
            }
        } catch (e) {
            console.error('Error loading kitchen profile:', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSpecialty = (specialty: string) => {
        if (specialties.includes(specialty)) {
            setSpecialties(prev => prev.filter(s => s !== specialty));
        } else {
            setSpecialties(prev => [...prev, specialty]);
        }
    };

    const persistPhotos = async (userId: string, next: string[]) => {
        const update: Record<string, any> = { kitchen_image_url: next[0] || null };
        if (photosReady) update.kitchen_photos = next;
        const { error } = await supabase.from('profiles').update(update).eq('id', userId);
        if (error) throw error;
        setPhotos(next);
    };

    const pickKitchenPhotos = async () => {
        const room = photosReady ? MAX_PHOTOS - photos.length : 1;
        if (room <= 0) {
            Alert.alert('Photo limit', `You can add up to ${MAX_PHOTOS} kitchen photos.`);
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: room > 1,
            selectionLimit: room,
            orderedSelection: true,
            quality: 0.8,
            base64: true,
        });
        if (result.canceled) return;
        const assets = result.assets.filter(a => a.base64);
        if (!assets.length) return;

        setImageUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not logged in');

            const urls: string[] = [];
            for (const [i, asset] of assets.entries()) {
                const filePath = `${user.id}/kitchen_${Date.now()}_${i}.jpg`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, decode(asset.base64 as string), { contentType: 'image/jpeg', upsert: true });
                if (uploadError) throw uploadError;
                urls.push(supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl);
            }

            await persistPhotos(user.id, photosReady ? [...photos, ...urls] : urls.slice(0, 1));
        } catch (err: any) {
            Alert.alert('Upload Failed', err.message);
        } finally {
            setImageUploading(false);
        }
    };

    const removePhoto = (url: string) => {
        Alert.alert('Remove photo?', 'This photo will no longer show on your kitchen profile.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error('Not logged in');
                        await persistPhotos(user.id, photos.filter(u => u !== url));
                    } catch (err: any) {
                        Alert.alert('Error', err.message);
                    }
                },
            },
        ]);
    };

    const handleSave = async () => {
        if (!kitchenName.trim()) {
            Alert.alert('Required', 'Kitchen name is required.');
            return;
        }
        if (!phoneVerified && phone.trim() && phone.replace(/\D/g, '').length < 9) {
            Alert.alert('Check your number', 'Please enter a full phone number.');
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('profiles')
                .update({
                    ...(phoneVerified ? {} : { phone: phone.trim() || null }),
                    kitchen_name: kitchenName.trim(),
                    bio: bio.trim(),
                    location_description: locationDescription.trim() || null,
                    specialties,
                })
                .eq('id', user.id);

            if (error) throw error;

            // Story and private contacts are saved on their own, so one failing (for example before the database update
            // has been run) never blocks the rest.
            const failed: string[] = [];
            const { error: storyError } = await supabase.from('profiles').update({ kitchen_story: kitchenStory.trim() || null }).eq('id', user.id);
            if (storyError) failed.push('kitchen story');
            const { error: radiusError } = await supabase.from('profiles').update({ service_radius_km: serviceRadius }).eq('id', user.id);
            if (radiusError) failed.push('service radius');
            const { error: contactError } = await supabase.from('host_contacts').upsert(
                {
                    user_id: user.id,
                    emergency_contact: emergencyContact.trim() || null,
                    kitchen_assistant: kitchenAssistant.trim() || null,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            );
            if (contactError) failed.push('emergency and assistant contacts');

            if (failed.length) {
                console.error('Kitchen settings extras failed:', storyError?.message, contactError?.message);
                Alert.alert('Partly saved', `Your kitchen details were saved, but your ${failed.join(' and ')} could not be.\n\n${[storyError?.message, radiusError?.message, contactError?.message].filter(Boolean).join('\n')}`);
            } else {
                // Stay on this page, showing what was saved.
                setKitchenName(kitchenName.trim());
                setBio(bio.trim());
                setKitchenStory(kitchenStory.trim());
                setEmergencyContact(emergencyContact.trim());
                setKitchenAssistant(kitchenAssistant.trim());
                setLocationDescription(locationDescription.trim());
                setJustSaved(true);
                setTimeout(() => setJustSaved(false), 2500);
            }
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-warm-cream items-center justify-center" edges={['top']}>
                <ActivityIndicator size="large" color="#D65A31" />
            </SafeAreaView>
        );
    }

    const labelStyle = { fontFamily: fonts.bold, fontSize: 15, color: palette.ink };
    const helperStyle = { fontFamily: fonts.regular, fontSize: 12, color: palette.muted, marginTop: 6, marginLeft: 4 };
    const fieldBox = {
        minHeight: 50, borderRadius: 12, backgroundColor: fieldFill, borderWidth: 1, borderColor: fieldBorder,
        paddingHorizontal: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    };
    const fieldText = { fontFamily: fonts.regular, fontSize: 15, color: palette.ink, flex: 1 };
    const areaBox = { ...fieldBox, alignItems: 'flex-start' as const, paddingVertical: 12 };
    const areaText = { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: palette.ink, flex: 1, textAlignVertical: 'top' as const };
    const PHOTO = Math.floor((screenWidth - 32 - 20) / 3);
    const idDate = idVerifiedAt ? new Date(idVerifiedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

    return (
        <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
            <View style={{ flex: 1, backgroundColor: pageBg }}>
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between bg-surface border-b border-gray-100">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
                        <ArrowLeft size={24} color="#2D241E" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-text-main font-sans-bold">Kitchen Settings</Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving} className="px-4 py-2 bg-clay-primary rounded-xl">
                        {saving ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Text className="text-white font-bold font-sans-bold text-sm">{justSaved ? 'Saved ✓' : 'Save'}</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* Kitchen identity, same row as the host payout page */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFDBCD', alignItems: 'center', justifyContent: 'center' }}>
                            <KitchenPotIcon size={22} color="#9C3F12" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1, color: palette.muted, textTransform: 'uppercase' }}>Kitchen host</Text>
                            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 18, color: palette.ink }}>{kitchenName.trim() || 'Your kitchen'}</Text>
                        </View>
                    </View>

                    {/* Profile card */}
                    <View style={{ borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: fieldBorder, shadowColor: palette.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3, marginBottom: 14 }}>
                        <View style={{ borderRadius: 16, overflow: 'hidden', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View pointerEvents="none" style={{ position: 'absolute', top: -52, right: -44, width: 168, height: 168, borderRadius: 84, backgroundColor: palette.accent, opacity: 0.09 }} />
                            {/* The kitchen's picture: its cover photo. The personal profile photo lives on the Profile page. */}
                            <TouchableOpacity onPress={pickKitchenPhotos} disabled={imageUploading} activeOpacity={0.85} accessibilityLabel="Add kitchen photos">
                                <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#FFEDE5', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4 }}>
                                    {imageUploading ? (
                                        <ActivityIndicator size="small" color={palette.accent} />
                                    ) : photos[0] ? (
                                        <Image source={{ uri: photos[0] }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <KitchenPotIcon size={28} color={palette.accent} />
                                    )}
                                </View>
                                <View style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#9C3F12', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                                    <Camera size={14} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: palette.ink }}>{kitchenName.trim() || 'Your kitchen'}</Text>
                                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#006A3C', borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 }}>
                                    <BadgeCheck size={14} color="#FFFFFF" />
                                    <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: '#FFFFFF' }}>Verified Host</Text>
                                </View>
                                {!!fullName.trim() && (
                                    <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 14, color: palette.muted, marginTop: 4 }}>Hosted by {fullName.trim()}</Text>
                                )}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                    {rating ? (
                                        <>
                                            <Star size={14} color="#F59E0B" fill="#F59E0B" />
                                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.accent }}>{rating.toFixed(2).replace(/\.?0+$/, '')}</Text>
                                            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: palette.muted }}>· {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</Text>
                                        </>
                                    ) : (
                                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: palette.muted }}>New host · no reviews yet</Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Identity verification (read-only: only the server can mark a host verified) */}
                    <View style={{ borderRadius: 12, backgroundColor: fieldFill, borderWidth: 1, borderColor: fieldBorder, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFDBCD', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldCheck size={22} color={idVerified ? '#006A3C' : '#341103'} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: '#9C3F12', textTransform: 'uppercase' }}>Identity verification</Text>
                                {idVerified && <ShieldCheck size={12} color="#006A3C" />}
                            </View>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: palette.ink, marginTop: 2 }}>{idVerified ? 'ID verified' : 'ID not verified yet'}</Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: "#56423B", marginTop: 1 }}>
                                {idVerified
                                    ? `${idDate ? `Verified on ${idDate}. ` : ''}${addressConfirmed ? 'Your address is confirmed too.' : 'Guests can see your ID check is done.'}`
                                    : 'A completed ID check helps guests trust your table.'}
                            </Text>
                        </View>
                    </View>

                    {/* Full legal name */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={[labelStyle, { marginBottom: 8 }]}>Full Legal Name</Text>
                        <TouchableOpacity onPress={() => router.push('/personal-information')} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Edit in Personal Information" style={fieldBox}>
                            <User size={20} color={iconMuted} />
                            <Text numberOfLines={1} style={fieldText}>{fullName || 'Not set'}</Text>
                            <Pencil size={16} color={iconMuted} />
                        </TouchableOpacity>
                        <Text style={helperStyle}>Your personal name, shared with your guest profile. Tap to edit it in Personal Information.</Text>
                    </View>

                    {/* Display / kitchen name */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={[labelStyle, { marginBottom: 8 }]}>Display / Kitchen Name</Text>
                        <View style={fieldBox}>
                            <TextInput ref={kitchenNameRef} placeholder="e.g. Auntie Ama's Specialties" placeholderTextColor="#9CA3AF" style={[fieldText, { height: 48 }]} value={kitchenName} onChangeText={setKitchenName} />
                            <KitchenPotIcon size={22} color={iconMuted} />
                        </View>
                    </View>

                    {/* Host bio */}
                    <View style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={labelStyle}>Host Bio</Text>
                            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: palette.muted }}>{bio.length} / {BIO_LIMIT}</Text>
                        </View>
                        <View style={[areaBox, { minHeight: 110 }]}>
                            <TextInput placeholder="Tell eaters about your cooking style..." placeholderTextColor="#9CA3AF" style={areaText} multiline maxLength={BIO_LIMIT} value={bio} onChangeText={setBio} />
                        </View>
                    </View>

                    {/* Kitchen story */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={[labelStyle, { marginBottom: 8 }]}>Kitchen Story & Culinary Heritage</Text>
                        <View style={[areaBox, { minHeight: 130 }]}>
                            <TextInput placeholder="Where does your cooking come from?" placeholderTextColor="#9CA3AF" style={areaText} multiline value={kitchenStory} onChangeText={setKitchenStory} />
                        </View>
                        <Text style={helperStyle}>Featured on your guest booking discovery card.</Text>
                    </View>

                    {/* Kitchen photos */}
                    <View style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Camera size={18} color={palette.accent} />
                            <Text style={labelStyle}>Kitchen Photos</Text>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {photos.map((url, i) => (
                                <View key={url} style={{ width: PHOTO, height: PHOTO, borderRadius: 12, borderWidth: 1.5, borderColor: photoBorder, overflow: 'hidden', backgroundColor: fieldFill }}>
                                    <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
                                    {i === 0 && photos.length > 1 && (
                                        <View style={{ position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(61,37,30,0.7)', borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 }}>
                                            <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: '#FFFFFF' }}>Cover</Text>
                                        </View>
                                    )}
                                    <TouchableOpacity onPress={() => removePhoto(url)} accessibilityLabel="Remove photo" hitSlop={6} style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                                        <X size={13} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {(photosReady ? photos.length < MAX_PHOTOS : true) && (
                                <TouchableOpacity onPress={pickKitchenPhotos} disabled={imageUploading} activeOpacity={0.8} accessibilityLabel="Add kitchen photos" style={{ width: PHOTO, height: PHOTO, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: photoBorder, backgroundColor: fieldFill, alignItems: 'center', justifyContent: 'center' }}>
                                    {imageUploading ? (
                                        <ActivityIndicator size="small" color={palette.accent} />
                                    ) : (
                                        <>
                                            <Plus size={24} color={palette.accent} />
                                            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: palette.muted, marginTop: 2 }}>{photos.length ? (photosReady ? 'Add' : 'Replace') : 'Add photos'}</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                        {photosReady && <Text style={helperStyle}>Add up to {MAX_PHOTOS} photos. The first one is your cover.</Text>}
                    </View>

                    {/* Specialties */}
                    <View style={{ marginBottom: 28 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <ForkKnifeIcon size={18} color={palette.accent} strokeWidth={2.2} />
                            <Text style={labelStyle}>Specialties</Text>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                            {SPECIALTIES.map(({ value, label, Icon }) => {
                                const isSelected = specialties.includes(value);
                                return (
                                    <TouchableOpacity
                                        key={value}
                                        onPress={() => toggleSpecialty(value)}
                                        activeOpacity={0.75}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999, backgroundColor: isSelected ? palette.accent : fieldFill, borderWidth: 1.5, borderColor: isSelected ? palette.accent : '#DDC1B6' }}
                                    >
                                        <Icon size={14} color={isSelected ? 'white' : palette.accent} />
                                        <Text style={{ fontFamily: isSelected ? fonts.semibold : fonts.medium, fontSize: 13, color: isSelected ? 'white' : palette.muted }}>{label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Location */}
                    <View style={{ marginBottom: 26 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <MapPin size={18} color={palette.accent} />
                            <Text style={labelStyle}>Location</Text>
                        </View>
                        <View style={{ borderRadius: 12, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', padding: 14, marginBottom: 14 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <Navigation size={14} color="#007A33" />
                                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#007A33' }}>GPS Verified</Text>
                            </View>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: palette.ink }}>{location || 'Not set'}</Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.muted, marginTop: 4 }}>Location is GPS-locked and cannot be changed manually</Text>
                        </View>
                        <Text style={[labelStyle, { marginBottom: 8 }]}>Nearby Landmark</Text>
                        <View style={[areaBox, { minHeight: 84 }]}>
                            <TextInput placeholder="e.g. By the big mango tree, opposite Shell station..." placeholderTextColor="#9CA3AF" style={areaText} multiline value={locationDescription} onChangeText={setLocationDescription} />
                        </View>
                        <Text style={helperStyle}>Help eaters find you — describe what's near your kitchen.</Text>
                    </View>

                    {/* Service zone */}
                    <View style={{ marginBottom: 26 }}>
                        <ServiceZone latitude={coords?.lat ?? null} longitude={coords?.lng ?? null} locationLabel={location} radiusKm={serviceRadius} onChange={setServiceRadius} />
                    </View>

                    <View style={{ height: 1, backgroundColor: dividerColor, marginBottom: 26 }} />

                    {/* Phone (read-only) */}
                    <View style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={labelStyle}>Phone Number</Text>
                            {phoneVerified && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <ShieldCheck size={16} color="#006A3C" />
                                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: '#006A3C' }}>Verified</Text>
                                </View>
                            )}
                        </View>
                        <View style={fieldBox}>
                            <Phone size={20} color={iconMuted} />
                            {phoneVerified ? (
                                <Text style={fieldText}>{phone}</Text>
                            ) : (
                                <TextInput
                                    placeholder="e.g. 024 123 4567"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="phone-pad"
                                    autoComplete="tel"
                                    maxLength={20}
                                    style={[fieldText, { height: 48 }]}
                                    value={phone}
                                    onChangeText={t => setPhone(t.replace(/[^0-9+\s-]/g, ''))}
                                />
                            )}
                            {phoneVerified && (
                                <View style={{ backgroundColor: '#6FF2A8', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#00522B' }}>SMS Active</Text>
                                </View>
                            )}
                        </View>
                        <Text style={helperStyle}>{phoneVerified ? 'To change your phone number, please contact support.' : 'Add your mobile number.'}</Text>
                    </View>

                    {/* Email (read-only) */}
                    {!!email && (
                        <View style={{ marginBottom: 26 }}>
                            <Text style={[labelStyle, { marginBottom: 8 }]}>Email Address</Text>
                            <View style={fieldBox}>
                                <Mail size={20} color={iconMuted} />
                                <Text numberOfLines={1} style={fieldText}>{email}</Text>
                            </View>
                        </View>
                    )}

                    <View style={{ height: 1, backgroundColor: dividerColor, marginBottom: 26 }} />

                    {/* Operational & safety contacts (private to the host) */}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: palette.ink }}>Operational & Safety Contacts</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: palette.muted, marginTop: 4, marginBottom: 12 }}>
                        Designated liaisons during live kitchen dining services.
                    </Text>

                    <View style={{ marginBottom: 24 }}>
                        <Text style={[labelStyle, { marginBottom: 8 }]}>Emergency Contact</Text>
                        <View style={fieldBox}>
                            <Asterisk size={20} color={iconMuted} />
                            <TextInput placeholder="Name, phone number and relationship" placeholderTextColor="#9CA3AF" style={[fieldText, { height: 48 }]} value={emergencyContact} onChangeText={setEmergencyContact} />
                        </View>
                    </View>

                    <View style={{ marginBottom: 28 }}>
                        <Text style={[labelStyle, { marginBottom: 8 }]}>Kitchen Assistant / Sous Host</Text>
                        <View style={fieldBox}>
                            <HostHatIcon size={22} color={iconMuted} strokeWidth={1.6} />
                            <TextInput placeholder="Name, phone number and role" placeholderTextColor="#9CA3AF" style={[fieldText, { height: 48 }]} value={kitchenAssistant} onChangeText={setKitchenAssistant} />
                        </View>
                        <Text style={helperStyle}>Only you can see these contacts. Guests never do.</Text>
                    </View>

                    {/* Save */}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Save changes"
                        style={{ height: 52, borderRadius: 8, backgroundColor: palette.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: palette.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 4, opacity: saving ? 0.7 : 1 }}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Save size={20} color="#FFFFFF" />
                                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' }}>{justSaved ? 'Saved ✓' : 'Save Changes'}</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* View public profile */}
                    <TouchableOpacity
                        onPress={() => userId && router.push(`/cook/${userId}`)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="View public kitchen profile"
                        style={{ marginTop: 12, height: 44, borderRadius: 8, backgroundColor: '#FEEAE2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                        <ExternalLink size={18} color="#794833" />
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: '#794833' }}>View Public Kitchen Profile</Text>
                    </TouchableOpacity>
                </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </SafeAreaView>
    );
}
