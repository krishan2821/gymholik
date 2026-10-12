import { useState, useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Returns whether the user prefers reduced motion.
 * On Web: respects CSS media query `(prefers-reduced-motion: reduce)`.
 * On Native: respects device Accessibility reduce motion setting.
 */
export function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);

      const handler = (event: MediaQueryListEvent) => {
        setReducedMotion(event.matches);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
      } else if ((mediaQuery as any).addListener) {
        (mediaQuery as any).addListener(handler);
        return () => (mediaQuery as any).removeListener(handler);
      }
    } else {
      AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => {});
      const subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        setReducedMotion
      );
      return () => {
        subscription?.remove?.();
      };
    }
  }, []);

  return reducedMotion;
}

export default usePrefersReducedMotion;
