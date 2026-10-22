import React from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { safeSelectionAsync } from '../utils/safeHaptics';
import { useTheme } from '../theme/ThemeContext';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  count?: number;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  variant?: 'primary' | 'primarySoft';
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  count,
  icon,
  style,
  textStyle,
  disabled = false,
  variant = 'primary',
}) => {
  const { colors, fonts, spacing, radius } = useTheme();

  const handlePress = () => {
    if (disabled || !onPress) return;
    safeSelectionAsync().catch(() => {});
    onPress();
  };

  const isPrimary = variant === 'primary';

  const backgroundColor = disabled
    ? colors.surfaceRaised
    : selected
    ? isPrimary
      ? colors.primary
      : colors.primarySoft
    : colors.surfaceRaised;

  const borderColor = disabled
    ? colors.border
    : selected
    ? isPrimary
      ? colors.primary
      : colors.primary
    : colors.border;

  const textColor = disabled
    ? colors.textSecondary
    : selected
    ? isPrimary
      ? colors.textOnPrimary
      : colors.primary
    : colors.textSecondary;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      android_ripple={
        !disabled
          ? {
              color: colors.primarySoft,
              borderless: false,
            }
          : undefined
      }
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        {
          minHeight: 44, // Accessible at 44px
          minWidth: 44,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: radius.chip, // Capsule shape
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          marginRight: spacing.sm,
          backgroundColor,
          borderColor,
          overflow: 'hidden',
          opacity: pressed && Platform.OS !== 'android' ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
      <Text
        style={[
          {
            fontFamily: fonts.headingMedium,
            fontSize: 14,
            fontWeight: '600',
            color: textColor,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
      {typeof count === 'number' && (
        <View
          style={{
            marginLeft: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: radius.full,
            backgroundColor: selected
              ? isPrimary
                ? colors.surfaceRaised
                : colors.surface
              : colors.surface,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              fontFamily: fonts.headingBold,
              color: selected
                ? isPrimary
                  ? colors.text
                  : colors.primary
                : colors.textSecondary,
            }}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export default Chip;
