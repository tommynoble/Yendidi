import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingHeader } from '@/components/ui/OnboardingHeader';
import { Button } from '@/components/ui/Button';
import OnboardingSlider from '@/components/OnboardingSlider';
import { palette } from '@/constants/theme';

export default function OnboardingCommunity() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-brand-canvas" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <OnboardingHeader currentStep={1} totalSteps={1} />

      {/* Hero photo slider */}
      <OnboardingSlider height={340} horizontalMargin={20} />

      {/* Content */}
      <View className="flex-1 px-5 pt-5 justify-between">
        <View className="items-center gap-3">
          {/* Cook avatar stack */}
          <View className="flex-row items-center" style={{ gap: -10 }}>
            {[palette.accent, '#84523C', '#006A3C', '#231915'].map((bg, i) => (
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
            Eat, Drink, Socialize
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
              Join the Community
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
