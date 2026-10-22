/**
 * tokens.ts — Shape, spacing, typography, and elevation tokens.
 *
 * These are brand-agnostic; they never contain raw colour hex.
 */

// Safe Platform check that works in React Native runtime, Web, and Node test runner
const isWeb = typeof window !== 'undefined' || (typeof navigator !== 'undefined' && (navigator as any).product !== 'ReactNative');
const isNode = typeof process !== 'undefined' && process.release?.name === 'node';
const currentOS = isNode ? 'ios' : isWeb ? 'web' : 'ios';

const Platform = {
  OS: currentOS,
  select: <T>(obj: { ios?: T; android?: T; web?: T; default?: T }): T | undefined => {
    return (obj as any)[currentOS] ?? obj.default ?? obj.ios ?? obj.android ?? obj.web;
  },
};

type TextStyle = Record<string, any>;

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
// ─────────────────────────────────────────────────────────────────────────────
export const fonts = {
  // Manrope — headings and numbers
  headingBold: 'Manrope_800ExtraBold',
  headingSemiBold: 'Manrope_700Bold',
  headingMedium: 'Manrope_600SemiBold',
  headingRegular: 'Manrope_500Medium',
  // Inter — body copy
  bodyBold: 'Inter_700Bold',
  bodySemiBold: 'Inter_600SemiBold',
  bodyMedium: 'Inter_500Medium',
  bodyRegular: 'Inter_400Regular',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Type scale — sizes preserved from original design, fonts swapped to Manrope/Inter
// Colours are injected by the theme context, NOT hard-coded here.
// ─────────────────────────────────────────────────────────────────────────────
export const typeScale = {
  display: {
    fontFamily: fonts.headingBold,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800' as const,
  },
  h1: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800' as const,
  },
  h2: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700' as const,
  },
  h3: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700' as const,
  },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  caption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  small: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400' as const,
  },
  /** Tabular numerals for money amounts — uses Manrope with font-variant-numeric */
  numberBig: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800' as const,
    ...(Platform.OS === 'web'
      ? ({ fontVariantNumeric: 'tabular-nums' } as any)
      : {}),
  },
  numberMedium: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700' as const,
    ...(Platform.OS === 'web'
      ? ({ fontVariantNumeric: 'tabular-nums' } as any)
      : {}),
  },
  button: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800' as const,
  },
} satisfies Record<string, TextStyle>;

// ─────────────────────────────────────────────────────────────────────────────
// Spacing scale — 4 to 40
// ─────────────────────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Radius tokens
// ─────────────────────────────────────────────────────────────────────────────
export const radius = {
  card: 24,    // cards
  input: 18,   // inputs / search bars
  chip: 9999,  // chips — capsule
  button: 9999,// buttons — capsule
  sheet: 28,   // bottom sheets / drawers
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Elevation — iOS/web use shadow; Android uses tonal elevation.
// Higher elevation numbers map to lighter surfaceRaised tint on dark mode.
// ─────────────────────────────────────────────────────────────────────────────
export const elevation = {
  /** Subtle card shadow */
  card: Platform.select({
    ios: {
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    },
    web: {
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    },
    default: { elevation: 2 },
  }) as object,

  /** Modal / sheet shadow */
  modal: Platform.select({
    ios: {
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.20,
      shadowRadius: 24,
    },
    web: {
      boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
    },
    default: { elevation: 8 },
  }) as object,

  /** Floating tab bar / FAB shadow */
  floating: Platform.select({
    ios: {
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
    },
    web: {
      boxShadow: '0 6px 14px rgba(0,0,0,0.28)',
    },
    default: { elevation: 10 },
  }) as object,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Layout helpers
// ─────────────────────────────────────────────────────────────────────────────
export const layout = {
  maxWidth: {
    column: 480,
    form: 420,
    content: 480,
    desktopContent: 1100,
    modal: 560,
  },
  sidebarWidth: 240,
  breakpoints: {
    phone: 640,
    tablet: 1024,
  },
} as const;
