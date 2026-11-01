import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { palette } from '@/constants/theme';

export default function MessagesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-1 bg-warm-cream">

        {/* Header — same layout as Notifications */}
        <View className="bg-surface px-6 py-4 flex-row items-center gap-4 border-b border-gray-100">
          <TouchableOpacity onPress={() => router.back()} className="p-1">
            <ArrowLeft size={24} color={palette.ink} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-text-main font-sans-bold">Messages</Text>
          </View>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
            <MessageCircle size={32} color={palette.accent} />
          </View>
          <Text className="text-lg font-bold text-text-main font-sans-bold mb-1 text-center">No messages yet</Text>
          <Text className="text-text-sub font-sans text-center">
            Once you place an order, you'll be able to message the cook right here.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
