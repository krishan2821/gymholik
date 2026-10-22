import React from 'react';
import { StyleSheet, View, Platform, ViewProps } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import { useTheme } from '../theme/ThemeContext';

export interface SafeBlurViewProps extends BlurViewProps {
  fallbackColor?: string;
}

export const SafeBlurView: React.FC<SafeBlurViewProps> = ({
  style,
  fallbackColor,
  intensity = 24,
  tint,
  ...rest
}) => {
  const { colors, isDark } = useTheme();
  const effectiveFallback = fallbackColor ?? colors.glassBg;
  const effectiveTint = tint ?? (isDark ? 'dark' : 'light');

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          style,
          {
            backgroundColor: effectiveFallback,
            // @ts-ignore web backdrop-filter
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          },
        ]}
        {...(rest as ViewProps)}
      />
    );
  }

  return <BlurView style={style} intensity={intensity} tint={effectiveTint} {...rest} />;
};

export default SafeBlurView;
