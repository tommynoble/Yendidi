import React from 'react';
import { View, Text } from 'react-native';

type Props = {
  currentStep: number;
  totalSteps?: number;
};

export function OnboardingHeader({ currentStep, totalSteps = 3 }: Props) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_700Bold',
          fontSize: 20,
          color: '#231915',
          letterSpacing: -0.4,
        }}
      >
        Yendidii
      </Text>
      <View className="flex-row items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={{
              width: i === currentStep - 1 ? 20 : 8,
              height: 4,
              borderRadius: 9999,
              backgroundColor: i === currentStep - 1 ? '#BF592B' : '#DDC1B6',
            }}
          />
        ))}
      </View>
    </View>
  );
}
