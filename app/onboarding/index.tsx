import React from 'react';
import { View, Text, Image, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChefHat, Utensils, Heart } from 'lucide-react-native';
import { OnboardingHeader } from '@/components/ui/OnboardingHeader';
import { Button } from '@/components/ui/Button';

export default function OnboardingIntro() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface-lowest" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <OnboardingHeader currentStep={1} totalSteps={3} />

      {/* Hero Image */}
      <View className="mx-5 mt-3 rounded-2xl overflow-hidden" style={{ height: 360 }}>
        <Image
          source={require('@/assets/images/dishes/jollof_rice_chicken.jpg')}
          className="w-full h-full"
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(35, 25, 21, 0.72)']}
          start={{ x: 0.5, y: 0.3 }}
          end={{ x: 0.5, y: 1 }}
          className="absolute inset-0"
        />

        {/* Label badge on image */}
        <View
          className="absolute top-4 left-4 flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
        >
          <ChefHat size={12} color="white" />
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: 'white', letterSpacing: 0.4 }}>
            Home Cooks Near You
          </Text>
        </View>

        {/* Headline on image */}
        <View className="absolute bottom-5 left-5 right-5">
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: 'white', lineHeight: 33, letterSpacing: -0.4 }}>
            Miss the Taste of{'\n'}
            <Text style={{ color: '#FFB598' }}>Home Cooking?</Text>
          </Text>
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 px-5 pt-6 justify-between">
        <View>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#56423B', lineHeight: 22, textAlign: 'center' }}>
            Tired of generic takeout? Connect with local home cooks preparing authentic Ghanaian meals in your neighbourhood.
          </Text>
        </View>

        <View className="gap-4 pb-2">
          <Button
            label="Find Food Nearby"
            onPress={() => router.push('/onboarding/community')}
            showArrow
          />

          {/* Adinkra-style step footer */}
          <View className="items-center gap-3">
            <View className="flex-row items-center gap-4">
              {[ChefHat, Utensils, Heart].map((Icon, i) => (
                <View
                  key={i}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: i === 0 ? '#FFF1EC' : '#F2DFD7',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} color={i === 0 ? '#BF592B' : '#8A7269'} />
                </View>
              ))}
            </View>
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#8A7269', letterSpacing: 0.2 }}>
              Step 1 of 3 · Your Culinary Journey Begins
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
