import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { palette } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outlined';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  showArrow?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

const STYLES: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary:  { bg: palette.accent, text: '#FFFFFF' },
  secondary:{ bg: '#F2DFD7', text: palette.accent },
  outlined: { bg: 'transparent', text: palette.accent, border: palette.accent },
  ghost:    { bg: 'transparent', text: '#231915' },
};

export function Button({ label, onPress, variant = 'primary', showArrow, loading, disabled, style }: Props) {
  const s = STYLES[disabled ? 'secondary' : variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        {
          height: 56,
          borderRadius: 9999,
          backgroundColor: s.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: s.border ? 1.5 : 0,
          borderColor: s.border ?? 'transparent',
          shadowColor: variant === 'primary' && !disabled ? palette.accent : 'transparent',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28,
          shadowRadius: 10,
          elevation: variant === 'primary' && !disabled ? 4 : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={s.text} />
      ) : (
        <>
          <Text
            style={{
              fontFamily: 'PlusJakartaSans_600SemiBold',
              fontSize: 16,
              color: s.text,
            }}
          >
            {label}
          </Text>
          {showArrow && <ArrowRight size={18} color={s.text} />}
        </>
      )}
    </TouchableOpacity>
  );
}
