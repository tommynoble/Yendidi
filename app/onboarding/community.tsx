import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function OnboardingCommunity() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-warm-cream">
            {/* Kente Strip */}
            <View className="flex-row h-1.5 w-full">
                <View className="bg-kente-red flex-1" />
                <View className="bg-kente-yellow flex-1" />
                <View className="bg-kente-green flex-1" />
                <View className="bg-text-main flex-1" />
            </View>

            {/* Main Image Wrapper */}
            <View className="flex-1 relative overflow-hidden">
                <Image
                    source={require('@/assets/images/dishes/waakye_special.jpg')}
                    className="w-full h-full"
                    resizeMode="cover"
                />

                {/* Floating Review Card */}
                <View className="absolute top-12 right-6 bg-white/95 backdrop-blur-sm p-3 rounded-2xl shadow-lg max-w-[180px]" style={{ transform: [{ rotate: '3deg' }] }}>
                    <View className="flex-row items-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} size={12} color="#FFCD00" fill="#FFCD00" />
                        ))}
                    </View>
                    <Text className="text-[10px] text-text-main italic leading-tight font-sans">
                        "Felt just like eating at my grandmother's house!"
                    </Text>
                </View>

                {/* Gradient Mask */}
                <LinearGradient
                    colors={['#FAF9F6', 'transparent', 'transparent']}
                    start={{ x: 0.5, y: 1 }}
                    end={{ x: 0.5, y: 0.5 }} // Adjusting to replicate "from warm-cream via-transparent to-transparent" but upwards? 
                    // The HTML says `bg-gradient-to-t from-[var(--warm-cream)] via-transparent to-transparent`. 
                    // So bottom is warm-cream.
                    locations={[0, 0.5, 1]}
                    className="absolute inset-0"
                />
                {/* Wait, the HTML gradient usually masks the bottom to blend with content area. */}
                <LinearGradient
                    colors={['transparent', '#FAF9F6']}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 0.5, y: 1 }}
                    className="absolute inset-0"
                />
            </View>

            {/* Content Area */}
            <View className="px-8 pb-12 pt-4 items-center relative z-10 bg-warm-cream">
                {/* Icon Group */}
                <View className="flex-row items-center justify-center -space-x-3 mb-6">
                    <Image source={{ uri: 'https://media.screensdesign.com/gasset/78511591-ac38-4b2d-89cc-5bcb9626ebcb.png' }} className="w-10 h-10 rounded-full border-2 border-warm-cream" />
                    <Image source={{ uri: 'https://media.screensdesign.com/gasset/b28757d3-7a87-4a0e-8552-349fa8083b45.png' }} className="w-10 h-10 rounded-full border-2 border-warm-cream" />
                    <Image source={{ uri: 'https://media.screensdesign.com/gasset/3e479937-8f02-40fc-93ec-0c6ca8c63a20.png' }} className="w-10 h-10 rounded-full border-2 border-warm-cream" />
                    <View className="w-10 h-10 rounded-full border-2 border-warm-cream bg-text-main items-center justify-center">
                        <Text className="text-white text-xs font-bold font-sans-bold">+2K</Text>
                    </View>
                </View>

                {/* Headline */}
                <Text className="text-2xl font-bold text-text-main mb-4 leading-tight text-center font-sans-bold">
                    More Than Just{'\n'}a Plate of Food
                </Text>

                {/* Subheadline */}
                <Text className="text-text-sub text-base leading-relaxed mb-8 text-center font-sans">
                    Join a table, meet new friends, and experience the true warmth of Ghanaian hospitality.
                </Text>

                {/* Indicators */}
                <View className="flex-row gap-2 mb-10">
                    <View className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    <View className="w-6 h-1.5 rounded-full bg-clay-primary" />
                </View>

                {/* Next Button */}
                <View className="flex-col gap-3 w-full">
                    <TouchableOpacity
                        className="w-full h-14 bg-clay-primary rounded-2xl items-center justify-center active:scale-95"
                        onPress={() => router.push('/login')}
                        style={{ shadowColor: '#D65A31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                    >
                        <Text className="text-white font-bold text-base font-sans-bold">Sign Up</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="w-full h-14 items-center justify-center active:opacity-70"
                        onPress={() => router.push('/login')}
                    >
                        <Text className="text-text-main font-semibold text-base font-sans-semibold">Log In</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
