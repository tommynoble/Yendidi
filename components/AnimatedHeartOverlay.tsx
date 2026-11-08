import React from 'react';
import { Animated } from 'react-native';
import { Heart } from 'lucide-react-native';

// Big white heart that pops over a photo when the user likes it. Shared by the event cards.
export const AnimatedHeartOverlay = ({ visible }: { visible: boolean }) => {
  const scale = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      scale.setValue(0.3);
      opacity.setValue(0);
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1.2,
            friction: 4,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.9,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(300),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        opacity,
        transform: [{ scale }],
      }}
      pointerEvents="none"
    >
      <Heart size={48} color="#FFFFFF" fill="#FFFFFF" />
    </Animated.View>
  );
};

export default AnimatedHeartOverlay;
