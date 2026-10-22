/**
 * palette.ts — Brand colour palettes for Gymholik.
 *
 * ONE constant controls the active brand:
 *   export const BRAND: 'cobalt' | 'ember' = 'cobalt';
 *
 * Each brand defines light and dark mode semantic tokens.
 * No raw hex values leak outside this file and tokens.ts.
 */

export type Brand = 'cobalt' | 'ember';
export type ColorMode = 'light' | 'dark';

/** Change this to switch the whole app between brands. */
export const BRAND: Brand = 'cobalt';

export interface SemanticTokens {
  // Backgrounds
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;

  // Text
  text: string;
  textSecondary: string;
  textOnPrimary: string;

  // Brand
  primary: string;
  primaryPressed: string;
  primarySoft: string; // tinted chip / pill background

  // Status
  success: string;
  warning: string;
  danger: string;

  // Status chip backgrounds
  chipSuccessBg: string;
  chipSuccessText: string;
  chipWarningBg: string;
  chipWarningText: string;
  chipDangerBg: string;
  chipDangerText: string;
  chipInfoBg: string;
  chipInfoText: string;

  // Glass / Overlay
  glassTint: string;
  glassFallback: string;
  glassBorder: string;
  scrim: string;
  shadow: string;
  qrForeground: string;
  qrBackground: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COBALT
// ─────────────────────────────────────────────────────────────────────────────
const cobaltDark: SemanticTokens = {
  bg: '#0B1020',
  surface: '#121A2E',
  surfaceRaised: '#1B2640',
  border: 'rgba(255,255,255,0.10)',

  text: '#EEF2FF',
  textSecondary: 'rgba(238,242,255,0.70)',
  textOnPrimary: '#06122B',

  primary: '#6C9BFF',
  primaryPressed: '#4F80F0',
  primarySoft: 'rgba(108,155,255,0.18)',

  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FF6B7A',

  chipSuccessBg: 'rgba(52,211,153,0.18)',
  chipSuccessText: '#34D399',
  chipWarningBg: 'rgba(251,191,36,0.18)',
  chipWarningText: '#FBBF24',
  chipDangerBg: 'rgba(255,107,122,0.18)',
  chipDangerText: '#FF6B7A',
  chipInfoBg: 'rgba(108,155,255,0.18)',
  chipInfoText: '#6C9BFF',

  glassTint: 'rgba(18,26,46,0.50)',
  glassFallback: 'rgba(18,26,46,0.85)',
  glassBorder: 'rgba(255,255,255,0.10)',
  scrim: 'rgba(6,10,24,0.70)',
  shadow: '#000000',
  qrForeground: '#000000',
  qrBackground: '#FFFFFF',
};

const cobaltLight: SemanticTokens = {
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceRaised: '#EBEFF8',
  border: 'rgba(11,16,32,0.10)',

  text: '#0B1020',
  textSecondary: '#414B66',
  textOnPrimary: '#FFFFFF',

  primary: '#1D4ED8',
  primaryPressed: '#1640C2',
  primarySoft: 'rgba(29,78,216,0.10)',

  success: '#137A4B',
  warning: '#8A5A00',
  danger: '#C0262D',

  chipSuccessBg: '#DDF6E8',
  chipSuccessText: '#0F6B40',
  chipWarningBg: '#FFF3D6',
  chipWarningText: '#7A4E00',
  chipDangerBg: '#FFE5E5',
  chipDangerText: '#B3201F',
  chipInfoBg: 'rgba(29,78,216,0.10)',
  chipInfoText: '#1D4ED8',

  glassTint: 'rgba(255,255,255,0.60)',
  glassFallback: 'rgba(255,255,255,0.90)',
  glassBorder: 'rgba(11,16,32,0.10)',
  scrim: 'rgba(11,16,32,0.50)',
  shadow: '#0B1020',
  qrForeground: '#000000',
  qrBackground: '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────────────────────
// EMBER
// ─────────────────────────────────────────────────────────────────────────────
const emberDark: SemanticTokens = {
  bg: '#14100E',
  surface: '#1D1816',
  surfaceRaised: '#2A221F',
  border: 'rgba(255,255,255,0.10)',

  text: '#FFF3EC',
  textSecondary: 'rgba(255,243,236,0.70)',
  textOnPrimary: '#1A0B04',

  primary: '#FF7A45',
  primaryPressed: '#F06030',
  primarySoft: 'rgba(255,122,69,0.18)',

  // Same status colours as cobalt dark
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FF6B7A',

  chipSuccessBg: 'rgba(52,211,153,0.18)',
  chipSuccessText: '#34D399',
  chipWarningBg: 'rgba(251,191,36,0.18)',
  chipWarningText: '#FBBF24',
  chipDangerBg: 'rgba(255,107,122,0.18)',
  chipDangerText: '#FF6B7A',
  chipInfoBg: 'rgba(255,122,69,0.18)',
  chipInfoText: '#FF7A45',

  glassTint: 'rgba(29,24,22,0.50)',
  glassFallback: 'rgba(29,24,22,0.85)',
  glassBorder: 'rgba(255,255,255,0.10)',
  scrim: 'rgba(20,16,14,0.70)',
  shadow: '#000000',
  qrForeground: '#000000',
  qrBackground: '#FFFFFF',
};

const emberLight: SemanticTokens = {
  bg: '#FBF6F2',
  surface: '#FFFFFF',
  surfaceRaised: '#F5EDE8',
  border: 'rgba(28,20,17,0.10)',

  text: '#1C1411',
  textSecondary: '#5C4035',
  textOnPrimary: '#FFFFFF',

  primary: '#B93A0B',
  primaryPressed: '#9C2F08',
  primarySoft: 'rgba(185,58,11,0.10)',

  // Same status colours as cobalt light
  success: '#137A4B',
  warning: '#8A5A00',
  danger: '#C0262D',

  chipSuccessBg: '#DDF6E8',
  chipSuccessText: '#0F6B40',
  chipWarningBg: '#FFF3D6',
  chipWarningText: '#7A4E00',
  chipDangerBg: '#FFE5E5',
  chipDangerText: '#B3201F',
  chipInfoBg: 'rgba(185,58,11,0.10)',
  chipInfoText: '#B93A0B',

  glassTint: 'rgba(255,255,255,0.60)',
  glassFallback: 'rgba(255,255,255,0.90)',
  glassBorder: 'rgba(28,20,17,0.10)',
  scrim: 'rgba(28,20,17,0.50)',
  shadow: '#1C1411',
  qrForeground: '#000000',
  qrBackground: '#FFFFFF',
};

export const PALETTES: Record<Brand, Record<ColorMode, SemanticTokens>> = {
  cobalt: { dark: cobaltDark, light: cobaltLight },
  ember: { dark: emberDark, light: emberLight },
};

/** Returns the token set for the given brand + mode. */
export function getPalette(brand: Brand, mode: ColorMode): SemanticTokens {
  return PALETTES[brand][mode];
}

/** Pre-rendered soft gradient WebP per brand and mode. */
export function getBgAsset(brand: Brand, mode: ColorMode): any {
  if (brand === 'ember' && mode === 'light') {
    return require('../../assets/images/bg-ember-light.webp');
  }
  if (brand === 'ember') {
    return require('../../assets/images/bg-ember-dark.webp');
  }
  if (mode === 'light') {
    return require('../../assets/images/bg-cobalt-light.webp');
  }
  return require('../../assets/images/bg-cobalt-dark.webp');
}
