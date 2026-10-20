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
import { LinearGradient } from 'expo-linear-gradient';
import { safeImpactAsync, ImpactFeedbackStyle } from '../utils/safeHaptics';
import { theme } from '../theme/theme';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
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
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prefersReducedMotion = usePrefersReducedMotion();

  const handlePressIn = () => {
    if (disabled || loading || prefersReducedMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: Platform.OS !== 'web',
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || loading || prefersReducedMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading || !onPress) return;
    safeImpactAsync(ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const heightBy = {
    sm: 44,
    md: 52,
    lg: 58,
  }[size];

  const fontSizeBy = {
    sm: 14,
    md: 15,
    lg: 17,
  }[size];

  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  const textColor = isPrimary
    ? (disabled ? '#8EB69B' : theme.colors.textOnPrimary) // #8EB69B sage with > 5:1 contrast, #051F20 active
    : isDanger
    ? theme.colors.error
    : isGhost
    ? theme.colors.primary
    : theme.colors.text;

  const renderContent = () => (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? (disabled ? '#8EB69B' : theme.colors.textOnPrimary) : theme.colors.primary}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                fontSize: fontSizeBy,
                color: disabled && !isPrimary ? theme.colors.textDisabled : textColor,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </>
      )}
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.wrapper,
        fullWidth && styles.fullWidth,
        !prefersReducedMotion && { transform: [{ scale: scaleAnim }] },
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
        {...({ dataSet: { interactive: 'button' } } as any)}
        style={({ pressed }) => [
          styles.pressable,
          { minHeight: heightBy },
          Platform.OS === 'web' && (disabled || loading ? styles.webDisabled : styles.webPointer),
          !isPrimary && isSecondary && styles.secondaryBg,
          !isPrimary && isGhost && styles.ghostBg,
          !isPrimary && isDanger && styles.dangerBg,
          disabled && !isPrimary && styles.disabledOpacity,
          pressed && !isPrimary && styles.pressedOpacity,
        ]}
      >
        {isPrimary ? (
          disabled ? (
            <View style={[styles.gradient, styles.primaryDisabled, { minHeight: heightBy }]}>
              {renderContent()}
            </View>
          ) : (
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primarySageEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.gradient, { minHeight: heightBy }]}
            >
              {renderContent()}
            </LinearGradient>
          )
        ) : (
          renderContent()
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  pressable: {
    borderRadius: theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  webPointer: {
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  webDisabled: {
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : {}),
  },
  gradient: {
    width: '100%',
    borderRadius: theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  primaryDisabled: {
    backgroundColor: '#163832',
    borderWidth: 1,
    borderColor: '#235347',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: theme.fonts.headingBold,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  iconLeft: {
    marginRight: theme.spacing.sm,
  },
  iconRight: {
    marginLeft: theme.spacing.sm,
  },
  secondaryBg: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ghostBg: {
    backgroundColor: 'transparent',
  },
  dangerBg: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  disabledOpacity: {
    opacity: 0.5,
  },
  pressedOpacity: {
    opacity: 0.8,
  },
});

export default Button;
