import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextStyle, ViewStyle } from 'react-native';
import { Lock } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';

import { isPhoneMasked } from '../utils/formatters';
export { isPhoneMasked };

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
  iconColor,
  showTooltipOnPress = true,
}) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  if (!phone) {
    return null;
  }

  const masked = isPhoneMasked(phone);
  const resolvedIconColor = iconColor ?? colors.textSecondary;

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
          <Lock size={iconSize} color={resolvedIconColor} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    text: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    iconWrap: {
      marginLeft: 5,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default MaskedPhone;
