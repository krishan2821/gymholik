import { useState, useEffect } from 'react';
import { useWindowDimensions, Platform } from 'react-native';
import {
  resolveBreakpoint,
  Breakpoint,
  BreakpointInfo,
  BREAKPOINTS,
} from '../utils/breakpoints';

export type { Breakpoint, BreakpointInfo };
export { BREAKPOINTS, resolveBreakpoint };

/**
 * Returns current responsive breakpoint and helper flags.
 * Breakpoints:
 * - phone: width < 640
 * - tablet: 640 <= width < 1024
 * - desktop: width >= 1024
 *
 * Automatically updates on window resize via `useWindowDimensions()` and `window.resize` on web.
 */
export function useBreakpoint(): BreakpointInfo {
  const dims = useWindowDimensions();
  const [webWidth, setWebWidth] = useState<number>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return dims.width;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onResize = () => {
      setWebWidth(window.innerWidth);
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const width =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? webWidth || dims.width
      : dims.width;
  return resolveBreakpoint(width, dims.height);
}

export default useBreakpoint;
