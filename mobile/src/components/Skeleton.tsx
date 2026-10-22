import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  ViewStyle,
  StyleProp,
  DimensionValue,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius,
  style,
}) => {
  const { colors, radius } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const resolvedRadius = borderRadius !== undefined ? borderRadius : radius.sm;

  // Animated translation for shimmer sweep
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prefersReducedMotion) {
      shimmerAnim.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    animation.start();
    return () => animation.stop();
  }, [prefersReducedMotion, shimmerAnim]);

  // Interpolate shimmer translateX
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, 300],
  });

  return (
    <View
      style={[
        styles.skeletonContainer,
        {
          width,
          height,
          borderRadius: resolvedRadius,
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {!prefersReducedMotion && (
        <Animated.View
          style={[
            styles.shimmerSweep,
            {
              backgroundColor: colors.primarySoft,
              transform: [{ translateX: shimmerTranslate }],
            },
          ]}
        />
      )}
    </View>
  );
};

export const SkeletonCircle: React.FC<{ size?: number; style?: StyleProp<ViewStyle> }> = ({
  size = 48,
  style,
}) => <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;

const styles = StyleSheet.create({
  skeletonContainer: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '60%',
    opacity: 0.35,
  },
});

export default Skeleton;
