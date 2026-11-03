import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { palette, type } from '@/constants/theme';
import { useCurrentUserId } from '@/lib/useCurrentUserId';
import BusinessOverviewPanel from '@/components/BusinessOverviewPanel';

// The full Business Overview. Opened from the arrow on the Kitchen dashboard; more sections can be added below the panel.
export default function BusinessOverviewScreen() {
  const router = useRouter();
  const me = useCurrentUserId();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }} edges={['top']}>
      <View style={{ backgroundColor: palette.surface, paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Back">
          <ArrowLeft size={24} color={palette.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.section, color: palette.ink }}>Business Overview</Text>
          <Text style={{ ...type.meta, color: palette.muted, marginTop: 1 }}>Track revenue, bookings and host growth</Text>
        </View>
      </View>

      {!me ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
          <BusinessOverviewPanel userId={me} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
