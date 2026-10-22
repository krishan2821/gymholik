import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  AccessibilityInfo,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { REGISTER } from '../constants/strings';

export interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabel?: string;
  style?: StyleProp<ViewStyle>;
  barHeight?: number;
}

export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  totalSteps,
  stepLabel,
  style,
  barHeight = 6,
}) => {
  const { colors, fonts, spacing } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const safeTotal = Math.max(1, totalSteps);
  const safeCurrent = Math.min(Math.max(1, currentStep), safeTotal);
  const progressRatio = safeCurrent / safeTotal;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled)
    );
    return () => { subscription?.remove?.(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      progressAnim.setValue(progressRatio);
    } else {
      Animated.timing(progressAnim, {
        toValue: progressRatio,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progressRatio, reduceMotion, progressAnim]);

  const widthInterpolation = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const displayText = stepLabel || REGISTER.STEP_OF(safeCurrent, safeTotal);

  return (
    <View
      style={[{ width: '100%', marginVertical: spacing.sm }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: safeTotal, now: safeCurrent, text: displayText }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs + 2 }}>
        <Text style={{ fontFamily: fonts.headingMedium, fontSize: 13, lineHeight: 18, color: colors.text, letterSpacing: 0.3 }}>
          {displayText}
        </Text>
        <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
          {Math.round(progressRatio * 100)}%
        </Text>
      </View>

      <View
        style={{
          width: '100%',
          height: barHeight,
          borderRadius: barHeight / 2,
          backgroundColor: colors.surfaceRaised,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Animated.View
          style={{
            width: widthInterpolation,
            height: barHeight,
            borderRadius: barHeight / 2,
            backgroundColor: colors.primary,
          }}
        />
      </View>
    </View>
  );
};

export default StepProgress;
