import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Animated,
  ViewStyle,
  StyleProp,
  DimensionValue,
} from 'react-native';
import { theme } from '../theme/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = theme.radius.sm,
  style,
}) => {
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCircle: React.FC<{ size?: number; style?: StyleProp<ViewStyle> }> = ({
  size = 48,
  style,
}) => <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
});

export default Skeleton;
