import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { ShoppingCart, ChevronRight } from 'lucide-react-native';

interface CartToastProps {
    visible: boolean;
    message: string;
    onPress: () => void;
    onHide: () => void;
    bottomOffset?: number;
}

const AUTO_DISMISS_MS = 2200;

export default function CartToast({ visible, message, onPress, onHide, bottomOffset = 24 }: CartToastProps) {
    const translateY = useRef(new Animated.Value(40)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
            ]).start();

            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => hide(), AUTO_DISMISS_MS);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [visible, message]);

    const hide = () => {
        Animated.parallel([
            Animated.timing(translateY, { toValue: 40, duration: 180, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => onHide());
    };

    const handlePress = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        Animated.parallel([
            Animated.timing(translateY, { toValue: 40, duration: 150, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start(() => {
            onHide();
            onPress();
        });
    };

    if (!visible) return null;

    return (
        <Animated.View
            pointerEvents="box-none"
            style={{
                position: 'absolute',
                left: 20,
                right: 20,
                bottom: bottomOffset,
                zIndex: 200,
                transform: [{ translateY }],
                opacity,
            }}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={handlePress}
                className="bg-white rounded-2xl flex-row items-center gap-3 p-3 pr-4"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }}
            >
                <View className="w-10 h-10 rounded-full bg-clay-primary/10 items-center justify-center">
                    <ShoppingCart size={18} color="#BF592B" />
                </View>
                <Text className="flex-1 text-sm text-text-main font-sans-semibold" numberOfLines={2}>
                    {message}
                </Text>
                <View className="flex-row items-center gap-0.5">
                    <Text className="text-xs text-clay-primary font-sans-bold">View Cart</Text>
                    <ChevronRight size={14} color="#BF592B" />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}
