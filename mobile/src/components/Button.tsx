import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  Animated,
  Pressable,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { safeImpactAsync, ImpactFeedbackStyle } from '../utils/safeHaptics';
import { useTheme } from '../theme/ThemeContext';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { getPlatformSpring } from '../utils/platformCapabilities';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
  platformOverride?: 'ios' | 'android';
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = true,
  platformOverride,
}) => {
  const { colors, fonts, spacing, radius } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prefersReducedMotion = usePrefersReducedMotion();

  const isAndroid = platformOverride ? platformOverride === 'android' : Platform.OS === 'android';
  const isIOS = platformOverride ? platformOverride === 'ios' : Platform.OS === 'ios';

  const isDestructive = variant === 'destructive' || variant === 'danger';
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';

  const handlePressIn = () => {
    if (disabled || loading || prefersReducedMotion || isAndroid) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: Platform.OS !== 'web',
      ...getPlatformSpring('ios'),
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || loading || prefersReducedMotion || isAndroid) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      ...getPlatformSpring('ios'),
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading || !onPress) return;
    safeImpactAsync(ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const heightBy = { sm: 44, md: 52, lg: 58 }[size];
  const fontSizeBy = { sm: 14, md: 15, lg: 17 }[size];

  // Resolve text color ensuring >= 4.5:1 contrast
  const textColor = disabled
    ? colors.textSecondary
    : isPrimary
    ? colors.textOnPrimary
    : isDestructive
    ? colors.danger
    : isGhost
    ? colors.primary
    : colors.text;

  // Ripple color on Android
  const rippleColor = isPrimary
    ? colors.primaryPressed
    : isDestructive
    ? colors.chipDangerBg
    : colors.primarySoft;

  const spinnerColor = isPrimary
    ? colors.textOnPrimary
    : isDestructive
    ? colors.danger
    : colors.primary;

  const renderContent = () => (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <View style={{ marginRight: spacing.sm }}>{icon}</View>
          )}
          <Text
            style={[
              {
                fontFamily: fonts.headingBold,
                fontWeight: '700',
                fontSize: fontSizeBy,
                letterSpacing: 0.3,
                color: textColor,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <View style={{ marginLeft: spacing.sm }}>{icon}</View>
          )}
        </>
      )}
    </View>
  );

  // Background and borders per variant and state
  const getContainerStyle = (pressed: boolean): ViewStyle => {
    if (disabled) {
      return {
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
      };
    }

    if (isPrimary) {
      return {
        backgroundColor: pressed && !isAndroid ? colors.primaryPressed : colors.primary,
        borderWidth: 0,
      };
    }

    if (isDestructive) {
      return {
        backgroundColor: pressed && !isAndroid ? colors.danger : colors.chipDangerBg,
        borderWidth: 1,
        borderColor: colors.danger,
      };
    }

    if (isSecondary) {
      return {
        backgroundColor: pressed && !isAndroid ? colors.surface : colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
      };
    }

    // Ghost
    return {
      backgroundColor: pressed && !isAndroid ? colors.primarySoft : 'transparent',
      borderWidth: 0,
    };
  };

  const shadowElevation = disabled
    ? {}
    : isPrimary
    ? isIOS
      ? {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.22,
          shadowRadius: 8,
        }
      : isAndroid
      ? { elevation: 3 }
      : ({
          boxShadow: `0 4px 14px ${colors.primary}33`,
        } as any)
    : isSecondary
    ? isAndroid
      ? { elevation: 1 }
      : {}
    : {};

  return (
    <Animated.View
      style={[
        {
          borderRadius: radius.button,
          overflow: 'hidden',
        },
        fullWidth && { width: '100%' },
        !prefersReducedMotion && isIOS && { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
        android_ripple={
          isAndroid && !disabled && !loading
            ? {
                color: rippleColor,
                borderless: false,
                foreground: true,
              }
            : undefined
        }
        {...({ dataSet: { interactive: 'button' } } as any)}
        style={({ pressed }) => [
          {
            borderRadius: radius.button,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            minHeight: heightBy,
          },
          getContainerStyle(pressed),
          shadowElevation,
          Platform.OS === 'web' &&
            (disabled || loading ? { cursor: 'not-allowed' } : { cursor: 'pointer' }),
        ]}
      >
        {renderContent()}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Button;
