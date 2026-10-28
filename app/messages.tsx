import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

export default function MessagesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-warm-cream" edges={['top']}>
      <View className="flex-row items-center px-4 py-4 bg-surface border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color="#BF592B" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text-main font-sans-bold ml-2">Messages</Text>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
          <MessageCircle size={32} color="#BF592B" />
        </View>
        <Text className="text-lg font-bold text-text-main font-sans-bold mb-1 text-center">No messages yet</Text>
        <Text className="text-text-sub font-sans text-center">
          Once you place an order, you'll be able to message the cook right here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
