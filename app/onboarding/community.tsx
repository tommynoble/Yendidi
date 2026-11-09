import React from 'react';
import { View, Text, StatusBar, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import OnboardingSlider from '@/components/OnboardingSlider';
import { palette, fonts } from '@/constants/theme';

// Welcome-page claim shown next to the avatars. Placeholder figures: replace with real numbers (or remove) before launch.
const SHARED_TABLES_LABEL = '2,400+ Shared Tables';
const REACH_LABEL = 'Hosted across Accra & Diaspora';

const AVATARS = [
  { initials: 'KW', bg: palette.accent },
  { initials: 'ER', bg: '#84523C' },
  { initials: 'AB', bg: '#2F6B54' },
  { initials: '2.4k', bg: '#231915' },
];

// Top bar of the welcome page: name and tagline.
function WelcomeHeader() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 24, color: '#231915', letterSpacing: -0.4 }}>Yendidii</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: '#7A5C53', letterSpacing: 1.2 }}>GHANA'S HEARTH</Text>
        </View>
      </View>

    </View>
  );
}

export default function OnboardingCommunity() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-brand-canvas" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <WelcomeHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', paddingBottom: 12 }}
      >
      <View>
      {/* Heading */}
      <View style={{ alignItems: 'flex-start', paddingHorizontal: 22, paddingTop: 40, paddingBottom: 8 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 30, color: '#231915', lineHeight: 36, textAlign: 'left', letterSpacing: -0.6, marginBottom: 10 }}>
          Akwaaba
        </Text>

        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14.5, color: '#6B5148', lineHeight: 22, textAlign: 'left', paddingRight: 8 }}>
          Join a communal dinner, discover local culinary masters, and experience the timeless warmth of Ghanaian hospitality.
        </Text>
      </View>

      {/* Hero photo slider */}
      <OnboardingSlider height={260} horizontalMargin={20} />

      {/* Content */}
      <View style={{ alignItems: 'flex-start', marginTop: 16, paddingHorizontal: 22 }}>
          {/* Community proof: host avatars + what the community is */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {AVATARS.map((a, i) => (
                <View
                  key={a.initials}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: a.bg,
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: i === 0 ? 0 : -8,
                    zIndex: AVATARS.length - i,
                  }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: a.initials.length > 2 ? 9 : 11, color: '#FFFFFF' }}>{a.initials}</Text>
                </View>
              ))}
            </View>
            <View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: '#231915' }}>{SHARED_TABLES_LABEL}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: '#7A5C53', marginTop: 1 }}>{REACH_LABEL}</Text>
            </View>
          </View>
      </View>
      </View>

        <View style={{ gap: 12, paddingHorizontal: 20, marginTop: 24 }}>
          <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.9}>
            <LinearGradient
              colors={['#C25327', '#9C3F12']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                height: 56,
                borderRadius: 9999,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                shadowColor: palette.accent,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 14,
                elevation: 5,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: '#FFFFFF' }}>Sign Up</Text>
              <ArrowRight size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <Button
            label="Log In"
            onPress={() => router.push('/login')}
            variant="ghost"
          />

          {/* Browse without an account; anything that needs one (cart, messages) asks to sign in then. */}
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} activeOpacity={0.7} style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: '#7A5C53' }}>
              Curious?{' '}
              <Text style={{ fontFamily: fonts.bold, color: palette.accent }}>Explore as Guest ›</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
