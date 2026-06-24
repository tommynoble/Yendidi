import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, ActivityIndicator } from 'react-native';
import { ChefHat, Flame, Soup, Fish, Utensils } from 'lucide-react-native';

interface ProcessLoaderProps {
  visible: boolean;
  message?: string;
}

const LOADER_ICONS = [ChefHat, Flame, Soup, Fish, Utensils];

export default function ProcessLoader({ visible, message = 'Processing...' }: ProcessLoaderProps) {
  const pulseAnim = useRef(new Animated.Value(0.95)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [loaderIconIndex, setLoaderIconIndex] = useState(0);

  useEffect(() => {
    let interval: any;
    let pulseLoop: any;
    let spinLoop: any;

    if (visible) {
      // Pulse animation loop
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.94,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      // Continuous spin animation loop
      spinLoop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 3500,
          useNativeDriver: true,
        })
      );
      spinLoop.start();

      // Cycle loader icons every 300ms for a lively, smooth food reel
      interval = setInterval(() => {
        setLoaderIconIndex((prev) => (prev + 1) % LOADER_ICONS.length);
      }, 300);
    } else {
      pulseAnim.setValue(0.95);
      spinAnim.setValue(0);
      setLoaderIconIndex(0);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (pulseLoop) pulseLoop.stop();
      if (spinLoop) spinLoop.stop();
    };
  }, [visible]);

  if (!visible) return null;

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(57, 46, 41, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
      }}
    >
      <View className="items-center p-6 rounded-3xl bg-[#BF592B] border border-[#D65A31] shadow-2xl max-w-[70%]">
        <View style={{ justifyContent: 'center', alignItems: 'center', width: 110, height: 110, marginBottom: 4 }}>
          {/* Spinning Dashed Ring */}
          <Animated.View
            style={{
              position: 'absolute',
              width: 90,
              height: 90,
              borderRadius: 45,
              borderWidth: 2,
              borderColor: 'rgba(255, 255, 255, 0.4)',
              borderStyle: 'dashed',
              transform: [{ rotate: spin }],
            }}
          />
          {/* Pulsing Inner Circle */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View className="bg-white rounded-full items-center justify-center border-4 border-white/20 shadow-xl" style={{ width: 76, height: 76, borderRadius: 38, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12 }}>
              {(() => {
                const IconComponent = LOADER_ICONS[loaderIconIndex] || Utensils;
                return <IconComponent size={32} color="#BF592B" />;
              })()}
            </View>
          </Animated.View>
        </View>
        
        <ActivityIndicator size="small" color="#FFFFFF" className="mb-3" />
        
        <Text className="text-2xl font-bold text-white text-center font-serif tracking-wide" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
          YɛnDidii
        </Text>
        <Text className="text-xs text-white/80 text-center font-sans mt-2 px-3 leading-4">
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
