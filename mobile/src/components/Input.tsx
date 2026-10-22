import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TextInputProps,
  Animated,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  helperText?: string;
  prefix?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
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
      value,
      defaultValue,
      onChangeText,
      onFocus,
      onBlur,
      containerStyle,
      inputStyle,
      placeholder,
      editable = true,
      keyboardType,
      inputMode,
      autoComplete,
      onSubmitEditing,
      onKeyPress,
      ...props
    },
    ref
  ) => {
    const { colors, fonts, spacing, radius } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = !!(value || defaultValue);
    const isFloated = isFocused || hasValue || !!prefix;

    const resolvedInputMode: TextInputProps['inputMode'] =
      inputMode ??
      (keyboardType === 'phone-pad'
        ? 'tel'
        : keyboardType === 'email-address'
        ? 'email'
        : keyboardType === 'numeric' || keyboardType === 'number-pad'
        ? 'numeric'
        : keyboardType === 'decimal-pad'
        ? 'decimal'
        : keyboardType === 'url'
        ? 'url'
        : 'text');

    const resolvedAutoComplete: TextInputProps['autoComplete'] =
      autoComplete ??
      (keyboardType === 'phone-pad'
        ? 'tel'
        : keyboardType === 'email-address'
        ? 'email'
        : props.secureTextEntry
        ? 'current-password'
        : undefined);

    const animatedIsFocused = useRef(
      new Animated.Value(isFloated ? 1 : 0)
    ).current;

    useEffect(() => {
      Animated.timing(animatedIsFocused, {
        toValue: isFloated ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }).start();
    }, [isFloated]);

    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleKeyPress = (e: any) => {
      if (
        Platform.OS === 'web' &&
        (e.nativeEvent?.key === 'Enter' || e.key === 'Enter') &&
        !props.multiline
      ) {
        onSubmitEditing?.(e);
      }
      onKeyPress?.(e);
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
      ? colors.danger
      : isFocused
      ? colors.primary
      : colors.textSecondary;

    const borderColor = error
      ? colors.danger
      : isFocused
      ? colors.primary
      : colors.border;

    const focusShadow = Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      web: {
        boxShadow: `0 0 0 2px ${colors.primary}40`,
      } as any,
    });

    const errorShadow = Platform.select({
      ios: {
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.30,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      web: {
        boxShadow: `0 0 0 2px ${colors.danger}40`,
      } as any,
    });

    return (
      <View style={[{ width: '100%', marginBottom: spacing.md }, containerStyle]}>
        <View
          style={[
            {
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surfaceRaised, // Filled style (surfaceRaised)
              borderRadius: radius.input, // 18 radius
              borderWidth: 1, // 1px border
              borderColor,
              paddingHorizontal: 16,
              position: 'relative',
              overflow: 'hidden',
            },
            isFocused && focusShadow,
            error && errorShadow,
            !editable && {
              opacity: 0.75,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Floating Label */}
          <Animated.Text
            style={[
              {
                position: 'absolute',
                fontFamily: fonts.headingMedium,
                fontWeight: '600',
                zIndex: 1,
                top: labelTop,
                fontSize: labelFontSize,
                color: labelColor,
                left: leftIcon ? 42 : 16,
                pointerEvents: 'none',
              },
            ]}
          >
            {label}
          </Animated.Text>

          {leftIcon && (
            <View style={{ marginRight: 10, justifyContent: 'center', alignItems: 'center' }}>
              {leftIcon}
            </View>
          )}

          {prefix && (
            <View style={{ marginRight: 8, justifyContent: 'center', paddingTop: 12 }}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.text, fontWeight: '700' }}>
                {prefix}
              </Text>
            </View>
          )}

          <TextInput
            ref={ref}
            value={value !== undefined ? (value ?? '') : (defaultValue !== undefined ? undefined : '')}
            defaultValue={defaultValue}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyPress={handleKeyPress}
            onSubmitEditing={onSubmitEditing}
            keyboardType={keyboardType}
            inputMode={resolvedInputMode}
            autoComplete={resolvedAutoComplete}
            editable={editable}
            placeholder={isFloated || !label ? placeholder : ''}
            placeholderTextColor={colors.textSecondary}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
            style={[
              {
                flex: 1,
                minWidth: 0,
                fontFamily: fonts.bodyRegular,
                fontSize: 15,
                color: colors.text,
                minHeight: 52,
                paddingVertical: 8,
                paddingTop: isFloated ? 20 : 0,
              },
              Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
              inputStyle,
            ]}
            {...(Platform.OS === 'web' ? ({ tabIndex: 0 } as any) : {})}
            {...props}
          />

          {rightIcon && (
            <View style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }}>
              {rightIcon}
            </View>
          )}
        </View>

        {error ? (
          <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 11, lineHeight: 15, color: colors.danger, marginTop: 5, marginLeft: 4 }}>
            {error}
          </Text>
        ) : helperText ? (
          <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 11, lineHeight: 15, color: colors.textSecondary, marginTop: 5, marginLeft: 4 }}>
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = 'Input';

export default Input;
