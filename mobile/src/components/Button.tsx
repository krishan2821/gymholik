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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme/theme';

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

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading || !onPress) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics optional fallback
    }
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
    ? theme.colors.textOnPrimary // #051F20 for contrast
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
          color={isPrimary ? theme.colors.textOnPrimary : theme.colors.primary}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                fontSize: fontSizeBy,
                color: disabled ? theme.colors.textDisabled : textColor,
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
        { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.pressable,
          { minHeight: heightBy },
          !isPrimary && isSecondary && styles.secondaryBg,
          !isPrimary && isGhost && styles.ghostBg,
          !isPrimary && isDanger && styles.dangerBg,
          disabled && styles.disabledOpacity,
          pressed && !isPrimary && styles.pressedOpacity,
        ]}
      >
        {isPrimary ? (
          <LinearGradient
            colors={
              disabled
                ? [theme.colors.raised, theme.colors.raised]
                : [theme.colors.primary, theme.colors.primarySageEnd]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradient, { minHeight: heightBy }]}
          >
            {renderContent()}
          </LinearGradient>
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
  gradient: {
    width: '100%',
    borderRadius: theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
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
