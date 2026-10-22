import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { safeSelectionAsync } from '../utils/safeHaptics';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { getPlatformSpring } from '../utils/platformCapabilities';

export interface SegmentedControlOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps {
  options: (string | SegmentedControlOption)[];
  selectedIndex?: number;
  value?: string;
  onChange?: (index: number, value: string) => void;
  variant?: 'primary' | 'primarySoft';
  style?: StyleProp<ViewStyle>;
  platformOverride?: 'ios' | 'android';
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  selectedIndex: propIndex,
  value: propValue,
  onChange,
  variant = 'primarySoft',
  style,
  platformOverride,
}) => {
  const { colors, fonts, radius } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isAndroid = platformOverride ? platformOverride === 'android' : Platform.OS === 'android';

  const normalizedOptions: SegmentedControlOption[] = options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const resolveIndex = (): number => {
    if (propIndex !== undefined) return propIndex;
    if (propValue !== undefined) {
      const idx = normalizedOptions.findIndex((o) => o.value === propValue);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  };

  const [currentIndex, setCurrentIndex] = useState<number>(resolveIndex());
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const activeIndex = propIndex !== undefined ? propIndex : currentIndex;
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    const target = resolveIndex();
    setCurrentIndex(target);
    if (prefersReducedMotion) {
      slideAnim.setValue(target);
    } else {
      Animated.spring(slideAnim, {
        toValue: target,
        useNativeDriver: Platform.OS !== 'web',
        ...getPlatformSpring(isAndroid ? 'android' : 'ios'),
      }).start();
    }
  }, [propIndex, propValue, prefersReducedMotion]);

  const handleSelect = (index: number) => {
    if (index === activeIndex) return;
    safeSelectionAsync().catch(() => {});
    setCurrentIndex(index);

    if (prefersReducedMotion) {
      slideAnim.setValue(index);
    } else {
      Animated.spring(slideAnim, {
        toValue: index,
        useNativeDriver: Platform.OS !== 'web',
        ...getPlatformSpring(isAndroid ? 'android' : 'ios'),
      }).start();
    }

    onChange?.(index, normalizedOptions[index].value);
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const count = normalizedOptions.length || 1;
  const padding = 4;
  const effectiveWidth = Math.max(0, containerWidth - padding * 2);
  const pillWidth = effectiveWidth / count;

  const translateX = slideAnim.interpolate({
    inputRange: normalizedOptions.map((_, i) => i),
    outputRange: normalizedOptions.map((_, i) => i * pillWidth),
  });

  const isPrimary = variant === 'primary';
  const pillBg = isPrimary ? colors.primary : colors.surface;
  const activeTextColor = isPrimary ? colors.textOnPrimary : colors.primary;

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          borderRadius: radius.chip,
        },
        style,
      ]}
    >
      {/* Sliding Selection Pill */}
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.selectionPill,
            {
              width: pillWidth,
              backgroundColor: pillBg,
              borderRadius: radius.chip,
              transform: [{ translateX }],
            },
            Platform.OS === 'ios' && {
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
            },
            Platform.OS === 'android' && {
              elevation: 2,
            },
          ]}
        />
      )}

      {/* Segments */}
      <View style={styles.segmentsRow}>
        {normalizedOptions.map((opt, index) => {
          const isSelected = index === activeIndex;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => handleSelect(index)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              style={styles.segmentBtn}
            >
              {opt.icon && (
                <View style={{ marginRight: 6 }}>{opt.icon}</View>
              )}
              <Text
                style={[
                  styles.segmentText,
                  {
                    fontFamily: isSelected ? fonts.headingBold : fonts.headingMedium,
                    color: isSelected ? activeTextColor : colors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48, // Accessible > 44px
    borderWidth: 1,
    padding: 4,
    position: 'relative',
    justifyContent: 'center',
    width: '100%',
  },
  selectionPill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    zIndex: 1,
  },
  segmentsRow: {
    flexDirection: 'row',
    height: '100%',
    zIndex: 2,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 44, // Accessible touch target
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SegmentedControl;
