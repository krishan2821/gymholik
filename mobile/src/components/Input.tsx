import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TextInputProps,
  Animated,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { theme } from '../theme/theme';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  helperText?: string;
  prefix?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      prefix,
      leftIcon,
      rightIcon,
      isPassword = false,
      value,
      defaultValue,
      onChangeText,
      onFocus,
      onBlur,
      containerStyle,
      inputStyle,
      placeholder,
      secureTextEntry,
      editable = true,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const hasValue = !!(value || defaultValue);

    // Floating label animation
    const animatedIsFocused = useRef(
      new Animated.Value(hasValue ? 1 : 0)
    ).current;

    useEffect(() => {
      Animated.timing(animatedIsFocused, {
        toValue: isFocused || hasValue ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }).start();
    }, [isFocused, hasValue]);

    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const labelTop = animatedIsFocused.interpolate({
      inputRange: [0, 1],
      outputRange: [18, 6],
    });

    const labelFontSize = animatedIsFocused.interpolate({
      inputRange: [0, 1],
      outputRange: [15, 11],
    });

    const labelColor = error
      ? theme.colors.error
      : isFocused
      ? theme.colors.primary
      : theme.colors.textMuted;

    const borderColor = error
      ? theme.colors.error
      : isFocused
      ? theme.colors.primary
      : theme.colors.border;

    const isActualPassword = isPassword && !isPasswordVisible;

    return (
      <View style={[styles.root, containerStyle]}>
        <View
          style={[
            styles.inputContainer,
            { borderColor },
            isFocused && styles.focusGlow,
            error && styles.errorGlow,
            !editable && styles.disabledContainer,
          ]}
        >
          {/* Animated Floating Label */}
          <Animated.Text
            style={[
              styles.floatingLabel,
              {
                top: labelTop,
                fontSize: labelFontSize,
                color: labelColor,
                left: leftIcon ? 42 : prefix ? 44 : 16,
              },
            ]}
            pointerEvents="none"
          >
            {label}
          </Animated.Text>

          {/* Left Icon */}
          {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

          {/* Optional Prefix (+91, etc.) */}
          {prefix && (
            <View style={styles.prefixContainer}>
              <Text style={styles.prefixText}>{prefix}</Text>
            </View>
          )}

          {/* Main Input */}
          <TextInput
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={isPassword ? isActualPassword : secureTextEntry}
            editable={editable}
            placeholder={isFocused || !label ? placeholder : ''}
            placeholderTextColor="rgba(218, 241, 222, 0.40)"
            cursorColor="#8EB69B"
            selectionColor="#8EB69B"
            style={[
              styles.textInput,
              {
                paddingTop: isFocused || hasValue ? 20 : 0,
              },
              inputStyle,
            ]}
            {...props}
          />

          {/* Password Show/Hide Toggle */}
          {isPassword && (
            <TouchableOpacity
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.rightAction}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            >
              {isPasswordVisible ? (
                <EyeOff size={20} color={theme.colors.primary} />
              ) : (
                <Eye size={20} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>
          )}

          {/* Custom Right Icon */}
          {!isPassword && rightIcon && (
            <View style={styles.rightAction}>{rightIcon}</View>
          )}
        </View>

        {/* Error or Helper Text */}
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : helperText ? (
          <Text style={styles.helperText}>{helperText}</Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  root: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  inputContainer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  focusGlow: {
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  errorGlow: {
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.error,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  disabledContainer: {
    opacity: 0.6,
    backgroundColor: theme.colors.raised,
  },
  floatingLabel: {
    position: 'absolute',
    fontFamily: theme.fonts.headingMedium,
    fontWeight: '500',
    zIndex: 1,
  },
  leftIconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefixContainer: {
    marginRight: 8,
    justifyContent: 'center',
    paddingTop: 10,
  },
  prefixText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '700',
  },
  textInput: {
    flex: 1,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 52,
    paddingVertical: 8,
  },
  rightAction: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 5,
    marginLeft: 4,
  },
  helperText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 5,
    marginLeft: 4,
  },
});

export default Input;
