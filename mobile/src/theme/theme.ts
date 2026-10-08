import { Platform, TextStyle } from 'react-native';

export const colors = {
  // Backgrounds & Surfaces
  background: '#051F20',
  surface: '#0B2B26',
  card: '#0B2B26',
  raised: '#163832',
  accentDark: '#235347',
  border: '#235347',
  borderLight: 'rgba(218, 241, 222, 0.12)',

  // Brand / Interactive
  primary: '#8EB69B',
  primaryLight: '#A7C7B1',
  primaryDark: '#235347',
  primarySageEnd: '#DAF1DE',

  // Text
  text: '#DAF1DE',
  textMuted: 'rgba(218, 241, 222, 0.65)',
  textSecondary: 'rgba(218, 241, 222, 0.65)',
  textDisabled: 'rgba(218, 241, 222, 0.35)',
  textOnPrimary: '#051F20',

  // Status
  warning: '#F5B544',
  error: '#FF6B6B',
  success: '#8EB69B',
  info: '#8EB69B',

  // Glassmorphism
  glassBg: 'rgba(11, 43, 38, 0.70)',
  glassBorder: 'rgba(218, 241, 222, 0.12)',
  glassGlow: 'rgba(142, 182, 155, 0.15)',

  // Overlays
  overlayStart: 'rgba(5, 31, 32, 0.70)',
  overlayEnd: 'rgba(5, 31, 32, 0.95)',
} as const;

export const fonts = {
  headingBold: 'SpaceGrotesk_700Bold',
  headingSemiBold: 'SpaceGrotesk_600SemiBold',
  headingMedium: 'SpaceGrotesk_500Medium',
  headingRegular: 'SpaceGrotesk_400Regular',
  bodyBold: 'Inter_700Bold',
  bodySemiBold: 'Inter_600SemiBold',
  bodyMedium: 'Inter_500Medium',
  bodyRegular: 'Inter_400Regular',
} as const;

export const typography = {
  display: {
    fontFamily: fonts.headingBold,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700' as const,
    color: colors.text,
  },
  h1: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700' as const,
    color: colors.text,
  },
  h2: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600' as const,
    color: colors.text,
  },
  h3: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
    color: colors.text,
  },
  bodyMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
    color: colors.text,
  },
  caption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    color: colors.textMuted,
  },
  small: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400' as const,
    color: colors.textMuted,
  },
  numberBig: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700' as const,
    color: colors.text,
  },
  button: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700' as const,
  },
} satisfies Record<string, TextStyle>;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  glass: 24,
  full: 9999,
} as const;

export const gradients = {
  primarySage: ['#8EB69B', '#A7C7B1', '#B9D7C2'] as const,
  primaryButton: ['#8EB69B', '#9EC3AB', '#B4D5BF'] as const,
  heroOverlay: ['rgba(5, 31, 32, 0.70)', 'rgba(5, 31, 32, 0.95)'] as const,
  cardShimmer: ['#0B2B26', '#163832', '#0B2B26'] as const,
} as const;

export const shadows = {
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  glass: {
    shadowColor: '#8EB69B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  glow: {
    shadowColor: '#8EB69B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
} as const;

export const theme = {
  name: 'Forest Iron',
  colors,
  fonts,
  typography,
  spacing,
  radius,
  gradients,
  shadows,
};

export default theme;
