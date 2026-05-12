import React from 'react';
import { View, Text, Image, TouchableOpacity, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { Home, ArrowRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingIntro() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-warm-cream">
            <StatusBar barStyle="dark-content" />

            {/* Kente Strip - Header Accent */}
            <View className="flex-row h-1.5 w-full">
                <View className="bg-kente-red flex-1" />
                <View className="bg-kente-yellow flex-1" />
                <View className="bg-kente-green flex-1" />
                <View className="bg-text-main flex-1" />
            </View>

            {/* Main Image Container */}
            <View className="relative w-full flex-1 rounded-b-[40px] overflow-hidden shadow-sm">
                <Image
                    source={require('@/assets/images/dishes/jollof_rice_chicken.jpg')}
                    className="w-full h-full"
                    resizeMode="cover"
                />
                {/* Overlay Gradient */}
                <LinearGradient
                    colors={['transparent', 'rgba(45, 36, 30, 0.6)']}
                    className="absolute inset-0"
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
            </View>

            {/* Content Area */}
            <View className="px-8 pt-10 pb-12 items-center">
                {/* Badge */}
                <View className="flex-row items-center bg-kente-yellow/20 px-3 py-1 rounded-full mb-6 gap-2">
                    <Home size={14} color="#4E342E" />
                    <Text className="text-earth-brown text-xs font-bold uppercase tracking-wide font-sans-bold">
                        Authentic Taste
                    </Text>
                </View>

                {/* Headline */}
                <Text className="text-3xl text-center text-text-main mb-4 leading-tight font-sans-bold">
                    Miss the Taste of{'\n'}
                    <Text className="text-clay-primary font-sans-bold">Home Cooking?</Text>
                </Text>

                {/* Subheadline */}
                <Text className="text-text-sub text-base text-center leading-relaxed mb-8 font-sans">
                    Tired of generic takeout? Connect with local home cooks preparing authentic Ghanaian meals in your neighborhood.
                </Text>

                {/* Indicators */}
                <View className="flex-row gap-2 mb-10">
                    <View className="w-6 h-1.5 rounded-full bg-clay-primary" />
                    <View className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                </View>

                {/* Next Button */}
                <TouchableOpacity
                    className="w-full h-14 bg-clay-primary rounded-2xl flex-row items-center justify-center gap-2 active:scale-95"
                    onPress={() => router.push('/onboarding/community')}
                    activeOpacity={0.9}
                    style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                >
                    <Text className="text-white text-base font-bold font-sans-bold">Find Food Nearby</Text>
                    <ArrowRight size={18} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );
}
