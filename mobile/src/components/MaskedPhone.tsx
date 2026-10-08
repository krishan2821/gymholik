import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextStyle, ViewStyle } from 'react-native';
import { Lock } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';

export function isPhoneMasked(phone?: string | null): boolean {
  if (!phone) return false;
  return phone.toUpperCase().includes('X');
}

interface MaskedPhoneProps {
  phone?: string | null;
  style?: ViewStyle;
  textStyle?: TextStyle;
  iconSize?: number;
  iconColor?: string;
  showTooltipOnPress?: boolean;
}

export const MaskedPhone: React.FC<MaskedPhoneProps> = ({
  phone,
  style,
  textStyle,
  iconSize = 13,
  iconColor = theme.colors.textMuted,
  showTooltipOnPress = true,
}) => {
  if (!phone) {
    return null;
  }

  const masked = isPhoneMasked(phone);

  const handlePress = () => {
    if (masked && showTooltipOnPress) {
      Toast.show({
        type: 'info',
        text1: 'Hidden for privacy',
        text2: 'Phone number is masked to protect member privacy.',
        visibilityTime: 2000,
      });
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      disabled={!masked || !showTooltipOnPress}
      activeOpacity={0.7}
      accessibilityRole="text"
      accessibilityLabel={masked ? `${phone}, Hidden for privacy` : phone}
      accessibilityHint={masked ? 'Tap to view privacy notice' : undefined}
    >
      <Text style={[styles.text, textStyle]}>{phone}</Text>
      {masked && (
        <View style={styles.iconWrap}>
          <Lock size={iconSize} color={iconColor} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  iconWrap: {
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
