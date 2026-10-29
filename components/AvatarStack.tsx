import React, { useRef, useState } from 'react';
import { View, Text, Image, Pressable, Animated } from 'react-native';

// No "who bought this" data yet — a deterministic placeholder count/faces per
// listing so the stack looks consistent on re-render instead of random noise.
// DiceBear generates illustrated (not real-photo) avatars from a seed, so this
// doesn't put actual people's likenesses behind fake purchase activity.
const getSeatStack = (id: string, portionsAvailable?: number) => {
  const seed = id ? id.charCodeAt(0) + id.charCodeAt(id.length - 1) * 3 : 0;
  const faces = [0, 1, 2, 3].map(
    (i) => `https://api.dicebear.com/7.x/avataaars/png?size=64&seed=${id || 'x'}-${seed + i}`
  );
  const shown = faces.slice(0, 3);
  const cover = faces[3]; // the next person in line, shown behind the "+N"
  const seatsLeft = portionsAvailable ?? 5;
  const extra = Math.max(3, 14 - seatsLeft * 2);
  return { shown, cover, extra };
};

// Collapsed: only the "+N" chip shows, the faces are tucked behind it.
// Tap the chip: the faces slide out to its left (springy, fading in); tap again to tuck them back.
export default function AvatarStack({ id, portionsAvailable, size = 18 }: { id: string; portionsAvailable?: number; size?: number }) {
  const { shown, cover, extra } = getSeatStack(id, portionsAvailable);
  const step = size * 0.55; // distance between faces once revealed (they overlap slightly)
  const progress = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    Animated.spring(progress, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: next ? 9 : 0,
    }).start();
  };

  const shadow = {
    shadowColor: '#BF592B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  } as const;

  return (
    <View style={{ width: size, height: size }}>
      {shown.map((uri, i) => (
        <Animated.Image
          key={i}
          source={{ uri }}
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: '#F2DFD7',
              borderWidth: 1,
              borderColor: 'rgba(191,89,43,0.35)',
              opacity: progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -(shown.length - i) * step] }) },
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
            },
            shadow,
          ]}
        />
      ))}
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide people who joined' : `Show ${extra} more people who joined`}
        style={[{ width: size, height: size, borderRadius: size / 2 }, shadow]}
      >
        {/* inner view clips the photo to the circle (the shadow lives on the Pressable) */}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(191,89,43,0.35)',
            backgroundColor: '#F2DFD7',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image source={{ uri: cover }} style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(35,25,21,0.55)' }} />
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: size * 0.4, color: 'white' }}>+{extra}</Text>
        </View>
      </Pressable>
    </View>
  );
}
