import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import {
  CheckCircle2,
  Calendar,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Check,
  Info,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { StatusType, getStatusBadgeVariant } from '../utils/statusBadges';

export type { StatusType };
export { getStatusBadgeVariant };
export type BadgeVariant = StatusType;

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant,
  style,
  textStyle,
  size = 'md',
  icon: customIcon,
}) => {
  const { colors, fonts, radius } = useTheme();

  // Normalize variant from prop or label
  const resolvedVariant = variant || getStatusBadgeVariant(label);
  const isSmall = size === 'sm';
  const iconSize = isSmall ? 12 : 14;

  // Resolve chip token colors and icon
  const getBadgeConfig = () => {
    switch (resolvedVariant) {
      case 'active':
        return {
          bg: colors.chipSuccessBg,
          text: colors.chipSuccessText,
          icon: <CheckCircle2 size={iconSize} color={colors.chipSuccessText} />,
        };
      case 'paid':
        return {
          bg: colors.chipSuccessBg,
          text: colors.chipSuccessText,
          icon: <Check size={iconSize} color={colors.chipSuccessText} />,
        };
      case 'success':
        return {
          bg: colors.chipSuccessBg,
          text: colors.chipSuccessText,
          icon: <CheckCircle2 size={iconSize} color={colors.chipSuccessText} />,
        };
      case 'upcoming':
        return {
          bg: colors.chipInfoBg,
          text: colors.chipInfoText,
          icon: <Calendar size={iconSize} color={colors.chipInfoText} />,
        };
      case 'info':
        return {
          bg: colors.chipInfoBg,
          text: colors.chipInfoText,
          icon: <Info size={iconSize} color={colors.chipInfoText} />,
        };
      case 'expiring':
        return {
          bg: colors.chipWarningBg,
          text: colors.chipWarningText,
          icon: <AlertTriangle size={iconSize} color={colors.chipWarningText} />,
        };
      case 'due':
        return {
          bg: colors.chipWarningBg,
          text: colors.chipWarningText,
          icon: <AlertCircle size={iconSize} color={colors.chipWarningText} />,
        };
      case 'warning':
        return {
          bg: colors.chipWarningBg,
          text: colors.chipWarningText,
          icon: <AlertTriangle size={iconSize} color={colors.chipWarningText} />,
        };
      case 'expired':
      case 'danger':
      case 'error':
        return {
          bg: colors.chipDangerBg,
          text: colors.chipDangerText,
          icon: <XCircle size={iconSize} color={colors.chipDangerText} />,
        };
      case 'neutral':
      default:
        return {
          bg: colors.surfaceRaised,
          text: colors.textSecondary,
          icon: <Info size={iconSize} color={colors.textSecondary} />,
        };
    }
  };

  const config = getBadgeConfig();
  const icon = customIcon !== undefined ? customIcon : config.icon;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: colors.border,
          borderRadius: radius.chip,
          paddingVertical: isSmall ? 3 : 5,
          paddingHorizontal: isSmall ? 8 : 12,
        },
        style,
      ]}
    >
      {icon ? <View style={{ marginRight: isSmall ? 4 : 6 }}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          {
            fontFamily: fonts.headingBold,
            color: config.text,
            fontSize: isSmall ? 11 : 12,
          },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default Badge;
