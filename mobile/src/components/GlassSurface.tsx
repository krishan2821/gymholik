import React from 'react';
import { StyleSheet, View, StyleProp, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeContext';
import { useAppearanceStore } from '../theme/useAppearance';
import { usePrefersReducedTransparency } from '../hooks/usePrefersReducedTransparency';
import { canUseGlass } from '../utils/platformCapabilities';

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark';
  borderWidth?: number;
  borderRadius?: number;
  platformOverride?: 'ios26' | 'ios' | 'android' | 'web';
  forceSolid?: boolean;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  style,
  contentStyle,
  intensity = 30,
  tint,
  borderWidth = 1,
  borderRadius,
  platformOverride,
  forceSolid = false,
}) => {
  const { colors, radius } = useTheme();
  const resolvedMode = useAppearanceStore((s) => s.resolvedMode);
  const reducedTransparency = usePrefersReducedTransparency();

  const isGlass = !forceSolid && canUseGlass({ platformOverride, reduceTransparency: reducedTransparency });
  const activeTint = tint || (resolvedMode === 'dark' ? 'dark' : 'light');
  const resolvedRadius = borderRadius !== undefined ? borderRadius : radius.card;

  if (isGlass) {
    return (
      <View
        style={[
          styles.container,
          {
            borderRadius: resolvedRadius,
            borderWidth,
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassTint,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <BlurView
          intensity={intensity}
          tint={activeTint}
          style={StyleSheet.absoluteFill}
        />
        <View style={[{ position: 'relative', zIndex: 1 }, contentStyle]}>
          {children}
        </View>
      </View>
    );
  }

  // Solid tonal fallback (Android, iOS < 26, Web, or Reduced Transparency)
  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: resolvedRadius,
          borderWidth,
          borderColor: colors.border,
          backgroundColor: colors.surfaceRaised,
          overflow: 'hidden',
        },
        Platform.OS === 'android' && { elevation: 4 },
        style,
      ]}
    >
      <View style={[{ position: 'relative', zIndex: 1 }, contentStyle]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
});

export default GlassSurface;
