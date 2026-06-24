import React from 'react';
import { View, Text, Image, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingHeader } from '@/components/ui/OnboardingHeader';
import { Button } from '@/components/ui/Button';

export default function OnboardingCommunity() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface-lowest" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <OnboardingHeader currentStep={2} totalSteps={3} />

      {/* Hero Image */}
      <View className="mx-5 mt-3 rounded-2xl overflow-hidden" style={{ height: 340 }}>
        <Image
          source={require('@/assets/images/dishes/waakye_special.jpg')}
          className="w-full h-full"
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(35, 25, 21, 0.55)']}
          start={{ x: 0.5, y: 0.4 }}
          end={{ x: 0.5, y: 1 }}
          className="absolute inset-0"
        />

        {/* Floating review card */}
        <View
          className="absolute top-5 right-4 p-3 rounded-2xl max-w-[170px]"
          style={{
            backgroundColor: 'rgba(255,255,255,0.96)',
            transform: [{ rotate: '3deg' }],
            shadowColor: '#231915',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          <View className="flex-row items-center gap-0.5 mb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} size={11} color="#BF592B" fill="#BF592B" />
            ))}
          </View>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: '#231915', fontStyle: 'italic', lineHeight: 14 }}>
            "Felt just like eating at my grandmother's house!"
          </Text>
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 px-5 pt-5 justify-between">
        <View className="items-center gap-3">
          {/* Cook avatar stack */}
          <View className="flex-row items-center" style={{ gap: -10 }}>
            {['#BF592B', '#84523C', '#006A3C', '#231915'].map((bg, i) => (
              <View
                key={i}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: bg,
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: i === 0 ? 0 : -10,
                  zIndex: 4 - i,
                }}
              >
                {i === 3 && (
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 9, color: 'white' }}>+2K</Text>
                )}
              </View>
            ))}
          </View>

          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: '#231915', lineHeight: 31, textAlign: 'center', letterSpacing: -0.3 }}>
            More Than Just{'\n'}a Plate of Food
          </Text>

          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#56423B', lineHeight: 22, textAlign: 'center' }}>
            Join a table, meet new friends, and experience the true warmth of Ghanaian hospitality.
          </Text>
        </View>

        <View className="gap-3 pb-2">
          <Button
            label="Sign Up"
            onPress={() => router.push('/login')}
            showArrow
          />
          <Button
            label="Log In"
            onPress={() => router.push('/login')}
            variant="ghost"
          />

          {/* Step footer */}
          <View className="items-center">
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#8A7269', letterSpacing: 0.2 }}>
              Step 2 of 3 · Join the Community
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
