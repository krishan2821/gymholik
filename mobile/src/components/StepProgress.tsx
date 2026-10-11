import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { theme } from '../theme/theme';
import { REGISTER } from '../constants/strings';

export interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabel?: string;
  style?: StyleProp<ViewStyle>;
  barHeight?: number;
}

/**
 * StepProgress component:
 * - "Step 2 of 3" text
 * - Animated progress bar in sage (#8EB69B)
 * - Reduce-motion aware
 * - Forest Iron design tokens
 */
export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  totalSteps,
  stepLabel,
  style,
  barHeight = 6,
}) => {
  const [reduceMotion, setReduceMotion] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Safe clamping
  const safeTotal = Math.max(1, totalSteps);
  const safeCurrent = Math.min(Math.max(1, currentStep), safeTotal);
  const progressRatio = safeCurrent / safeTotal; // 0 to 1

  useEffect(() => {
    // Check accessibility reduce-motion setting
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled)
    );

    return () => {
      subscription?.remove?.();
    };
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

  const displayText =
    stepLabel || REGISTER.STEP_OF(safeCurrent, safeTotal);

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 1,
        max: safeTotal,
        now: safeCurrent,
        text: displayText,
      }}
    >
      <View style={styles.textRow}>
        <Text style={styles.stepText}>{displayText}</Text>
        <Text style={styles.percentageText}>
          {Math.round(progressRatio * 100)}%
        </Text>
      </View>

      <View style={[styles.track, { height: barHeight, borderRadius: barHeight / 2 }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: widthInterpolation,
              height: barHeight,
              borderRadius: barHeight / 2,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: theme.spacing.sm,
  },
  textRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs + 2,
  },
  stepText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.text,
    letterSpacing: 0.3,
  },
  percentageText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textMuted,
  },
  track: {
    width: '100%',
    backgroundColor: theme.colors.raised,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  fill: {
    backgroundColor: theme.colors.primary, // Sage
  },
});
