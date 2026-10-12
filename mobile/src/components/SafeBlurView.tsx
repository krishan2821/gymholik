import React from 'react';
import { StyleSheet, View, Platform, ViewProps } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import { theme } from '../theme/theme';

export interface SafeBlurViewProps extends BlurViewProps {
  fallbackColor?: string;
}

export const SafeBlurView: React.FC<SafeBlurViewProps> = ({
  style,
  fallbackColor = theme.colors.glassBg,
  intensity = 24,
  tint = 'dark',
  ...rest
}) => {
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          style,
          {
            backgroundColor: fallbackColor,
            // @ts-ignore web backdrop-filter
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          },
        ]}
        {...(rest as ViewProps)}
      />
    );
  }

  return <BlurView style={style} intensity={intensity} tint={tint} {...rest} />;
};

export default SafeBlurView;
