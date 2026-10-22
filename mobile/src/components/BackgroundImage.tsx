import React from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

export interface BackgroundImageProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * BackgroundImage — renders smooth native 3-stop LinearGradient
 * dynamically matching the active brand and resolved mode without banding.
 */
export const BackgroundImage: React.FC<BackgroundImageProps> = ({
  style,
  children,
}) => {
  const { colors, layout } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          maxWidth: layout.maxWidth.column,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[colors.bg, colors.surfaceRaised, colors.bg]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    width: '100%',
    alignSelf: 'center',
  },
});

export default BackgroundImage;
