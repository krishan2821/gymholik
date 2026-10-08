import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  count?: number;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
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
}) => {
  const handlePress = () => {
    if (disabled || !onPress) return;
    try {
      Haptics.selectionAsync();
    } catch {
      // Haptic optional
    }
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text
        style={[
          styles.text,
          selected ? styles.textSelected : styles.textUnselected,
          textStyle,
        ]}
      >
        {label}
      </Text>
      {typeof count === 'number' && (
        <View
          style={[
            styles.countBadge,
            selected ? styles.countBadgeSelected : styles.countBadgeUnselected,
          ]}
        >
          <Text
            style={[
              styles.countText,
              selected ? styles.countTextSelected : styles.countTextUnselected,
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    minHeight: 44, // 44px tap target requirement
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: theme.spacing.sm,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipUnselected: {
    backgroundColor: theme.colors.raised,
    borderColor: theme.colors.border,
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    marginRight: 6,
  },
  text: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 14,
    fontWeight: '500',
  },
  textSelected: {
    color: theme.colors.textOnPrimary, // #051F20 contrast
    fontWeight: '700',
  },
  textUnselected: {
    color: theme.colors.text,
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  countBadgeSelected: {
    backgroundColor: theme.colors.background,
  },
  countBadgeUnselected: {
    backgroundColor: theme.colors.surface,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: theme.fonts.headingBold,
  },
  countTextSelected: {
    color: theme.colors.primary,
  },
  countTextUnselected: {
    color: theme.colors.textMuted,
  },
});

export default Chip;
