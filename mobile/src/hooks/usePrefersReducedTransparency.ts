import { useState, useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Returns whether the user prefers reduced transparency.
 * On Native: respects device Accessibility reduce transparency setting.
 * On Web: respects CSS media query `(prefers-reduced-transparency: reduce)`.
 */
export function usePrefersReducedTransparency(): boolean {
  const [reducedTransparency, setReducedTransparency] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      try {
        const mediaQuery = window.matchMedia('(prefers-reduced-transparency: reduce)');
        setReducedTransparency(mediaQuery.matches);

        const handler = (event: MediaQueryListEvent) => {
          setReducedTransparency(event.matches);
        };

        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener('change', handler);
          return () => mediaQuery.removeEventListener('change', handler);
        } else if ((mediaQuery as any).addListener) {
          (mediaQuery as any).addListener(handler);
          return () => (mediaQuery as any).removeListener(handler);
        }
      } catch {
        // matchMedia query might fail on older environments
      }
    } else {
      if (typeof AccessibilityInfo.isReduceTransparencyEnabled === 'function') {
        AccessibilityInfo.isReduceTransparencyEnabled()
          .then(setReducedTransparency)
          .catch(() => {});
        const subscription = AccessibilityInfo.addEventListener(
          'reduceTransparencyChanged',
          setReducedTransparency
        );
        return () => {
          subscription?.remove?.();
        };
      }
    }
  }, []);

  return reducedTransparency;
}

export default usePrefersReducedTransparency;
