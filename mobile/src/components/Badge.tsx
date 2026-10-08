import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../theme/theme';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  style,
  textStyle,
  size = 'md',
}) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return {
          bg: 'rgba(142, 182, 155, 0.18)',
          border: 'rgba(142, 182, 155, 0.40)',
          text: theme.colors.primary,
        };
      case 'warning':
        return {
          bg: 'rgba(245, 181, 68, 0.18)',
          border: 'rgba(245, 181, 68, 0.40)',
          text: theme.colors.warning,
        };
      case 'error':
        return {
          bg: 'rgba(255, 107, 107, 0.18)',
          border: 'rgba(255, 107, 107, 0.40)',
          text: theme.colors.error,
        };
      case 'info':
        return {
          bg: 'rgba(142, 182, 155, 0.12)',
          border: theme.colors.border,
          text: theme.colors.text,
        };
      case 'neutral':
      default:
        return {
          bg: theme.colors.raised,
          border: theme.colors.border,
          text: theme.colors.textMuted,
        };
    }
  };

  const colors = getColors();
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 8 : 12,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: isSmall ? 11 : 12,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: theme.radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: theme.fonts.headingSemiBold,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default Badge;
