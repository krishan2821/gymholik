export type Breakpoint = 'phone' | 'tablet' | 'desktop';

export interface BreakpointInfo {
  breakpoint: Breakpoint;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

export const BREAKPOINTS = {
  TABLET: 640,
  DESKTOP: 1024,
} as const;

/**
 * Pure helper to calculate breakpoint classification from width.
 * - Phone: width < 640
 * - Tablet: 640 <= width < 1024
 * - Desktop: width >= 1024
 */
export function resolveBreakpoint(width: number, height: number = 0): BreakpointInfo {
  const isPhone = width < BREAKPOINTS.TABLET;
  const isTablet = width >= BREAKPOINTS.TABLET && width < BREAKPOINTS.DESKTOP;
  const isDesktop = width >= BREAKPOINTS.DESKTOP;

  const breakpoint: Breakpoint = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'phone';

  return {
    breakpoint,
    isPhone,
    isTablet,
    isDesktop,
    width,
    height,
  };
}

export function getBreakpoint(width: number): Breakpoint {
  return resolveBreakpoint(width).breakpoint;
}

