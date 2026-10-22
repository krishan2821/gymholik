import React, { useState, useEffect, useRef } from 'react';
import { Text, TextProps, StyleProp, TextStyle, Platform } from 'react-native';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface CountUpProps extends Omit<TextProps, 'children'> {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  duration = 800,
  formatter,
  prefix = '',
  suffix = '',
  style,
  ...rest
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(prefersReducedMotion ? value : 0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    const startTime = Date.now();
    const startVal = displayValue;
    const diff = value - startVal;

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + diff * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        if (Platform.OS === 'web' && typeof requestAnimationFrame === 'function') {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          animFrameRef.current = setTimeout(tick, 16) as any;
        }
      } else {
        setDisplayValue(value);
      }
    };

    tick();

    return () => {
      if (animFrameRef.current) {
        if (Platform.OS === 'web' && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(animFrameRef.current);
        } else {
          clearTimeout(animFrameRef.current as any);
        }
      }
    };
  }, [value, duration, prefersReducedMotion]);

  const formatted = formatter ? formatter(displayValue) : displayValue.toLocaleString();

  return (
    <Text
      style={[
        {
          fontVariant: ['tabular-nums'],
        },
        style,
      ]}
      {...rest}
    >
      {prefix}
      {formatted}
      {suffix}
    </Text>
  );
};

export default CountUp;
