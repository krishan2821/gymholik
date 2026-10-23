/**
 * theme.ts — Design token system and theme snapshot.
 *
 * This file is purely brand & layout tokens; it does NOT import react-native
 * at the top level, allowing unit tests (Node.js/tsx) to import theme tokens
 * without React Native environment mocks.
 */

import { BRAND, getPalette, getBgAsset, PALETTES, SemanticTokens } from './palette';
import { fonts, typeScale, spacing, radius, elevation, layout } from './tokens';

export type { Brand, ColorMode, SemanticTokens } from './palette';
export { BRAND, getPalette, getBgAsset, PALETTES };
export { fonts, typeScale, spacing, radius, elevation, layout };

export function createThemeColors(palette: SemanticTokens) {
  return {
    ...palette,
    background: palette.bg,
    card: palette.surface,
    raised: palette.surfaceRaised,
    error: palette.danger,
    textMuted: palette.textSecondary,
    borderLight: palette.border,
    primaryLight: palette.primary,
    primaryDark: palette.primaryPressed,
    primarySageEnd: palette.primaryPressed,
    coral: palette.danger,
    amber: palette.warning,
    glassBg: palette.glassTint,
    glassGlow: palette.primarySoft,
    cyan: palette.primary,
    cyanBg: palette.primarySoft,
    cyanBorder: palette.border,
    overlayEnd: palette.scrim,
    overlayStart: palette.scrim,
  };
}

export type ThemeColors = ReturnType<typeof createThemeColors>;

export interface ThemeValue {
  mode: ColorMode;
  isDark: boolean;
  colors: ThemeColors;
  fonts: typeof fonts;
  typeScale: typeof typeScale;
  spacing: typeof spacing;
  radius: typeof radius & { glass: number; xl: number };
  elevation: typeof elevation;
  layout: typeof layout;
  brand: Brand;
  typography: {
    display: any;
    h1: any;
    h2: any;
    h3: any;
    body: any;
    bodyMedium: any;
    caption: any;
    small: any;
    numberBig: any;
    button: any;
  };
  gradients: {
    primaryButton: [string, string];
    heroOverlay: [string, string];
    cardShimmer: [string, string, string];
  };
  shadows: {
    soft: any;
    glass: any;
    glow: any;
  };
}

export function buildTheme(mode: ColorMode, brand: Brand = BRAND): ThemeValue {
  const palette = getPalette(brand, mode);
  const themeColors = createThemeColors(palette);
  const isDark = mode === 'dark';

  return {
    mode,
    isDark,
    colors: themeColors,
    fonts,
    typeScale,
    spacing,
    radius: {
      ...radius,
      glass: radius.card,
      xl: radius.card,
    },
    elevation,
    layout,
    brand,
    typography: {
      display: { ...typeScale.display, color: themeColors.text },
      h1: { ...typeScale.h1, color: themeColors.text },
      h2: { ...typeScale.h2, color: themeColors.text },
      h3: { ...typeScale.h3, color: themeColors.text },
      body: { ...typeScale.body, color: themeColors.text },
      bodyMedium: { ...typeScale.bodyMedium, color: themeColors.text },
      caption: { ...typeScale.caption, color: themeColors.textSecondary },
      small: { ...typeScale.small, color: themeColors.textSecondary },
      numberBig: { ...typeScale.numberBig, color: themeColors.text },
      button: { ...typeScale.button },
    },
    gradients: {
      primaryButton: [themeColors.primary, themeColors.primaryPressed] as [string, string],
      heroOverlay: [themeColors.scrim, themeColors.scrim] as [string, string],
      cardShimmer: [themeColors.surface, themeColors.surfaceRaised, themeColors.surface] as [string, string, string],
    },
    shadows: {
      soft: {
        shadowColor: themeColors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
      glass: {
        shadowColor: themeColors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.08 : 0.05,
        shadowRadius: 12,
        elevation: 4,
      },
      glow: {
        shadowColor: themeColors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isDark ? 0.20 : 0.12,
        shadowRadius: 10,
        elevation: 5,
      },
    },
  };
}

const _defaultColors = PALETTES[BRAND].dark;

export const colors = createThemeColors(_defaultColors);

export function updateThemePalette(newPalette: SemanticTokens, mode: ColorMode) {
  Object.assign(colors, createThemeColors(newPalette));

  theme.name = `${BRAND.charAt(0).toUpperCase() + BRAND.slice(1)} ${mode === 'dark' ? 'Dark' : 'Light'}`;
  if (theme.typography) {
    theme.typography.display.color = newPalette.text;
    theme.typography.h1.color = newPalette.text;
    theme.typography.h2.color = newPalette.text;
    theme.typography.h3.color = newPalette.text;
    theme.typography.body.color = newPalette.text;
    theme.typography.bodyMedium.color = newPalette.text;
    theme.typography.caption.color = newPalette.textSecondary;
    theme.typography.small.color = newPalette.textSecondary;
    theme.typography.numberBig.color = newPalette.text;
  }
  if (theme.gradients) {
    theme.gradients.primaryButton = [newPalette.primary, newPalette.primaryPressed];
    theme.gradients.heroOverlay = [newPalette.scrim, newPalette.scrim];
    theme.gradients.cardShimmer = [newPalette.surface, newPalette.surfaceRaised, newPalette.surface];
  }
  if (theme.shadows) {
    theme.shadows.soft.shadowColor = newPalette.shadow;
    theme.shadows.glass.shadowColor = newPalette.primary;
    theme.shadows.glow.shadowColor = newPalette.primary;
  }
}

export const theme = {
  name: `${BRAND.charAt(0).toUpperCase() + BRAND.slice(1)} Dark`,
  colors,
  fonts,
  typography: {
    display: { ...typeScale.display, color: _defaultColors.text },
    h1: { ...typeScale.h1, color: _defaultColors.text },
    h2: { ...typeScale.h2, color: _defaultColors.text },
    h3: { ...typeScale.h3, color: _defaultColors.text },
    body: { ...typeScale.body, color: _defaultColors.text },
    bodyMedium: { ...typeScale.bodyMedium, color: _defaultColors.text },
    caption: { ...typeScale.caption, color: _defaultColors.textSecondary },
    small: { ...typeScale.small, color: _defaultColors.textSecondary },
    numberBig: { ...typeScale.numberBig, color: _defaultColors.text },
    button: { ...typeScale.button },
  },
  spacing,
  radius: {
    ...radius,
    glass: radius.card,
    xl: radius.card,
  },
  gradients: {
    primaryButton: [_defaultColors.primary, _defaultColors.primaryPressed] as [string, string],
    heroOverlay: [_defaultColors.scrim, _defaultColors.scrim] as [string, string],
    cardShimmer: [_defaultColors.surface, _defaultColors.surfaceRaised, _defaultColors.surface] as [string, string, string],
  },
  shadows: {
    soft: {
      shadowColor: _defaultColors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 3,
    },
    glass: {
      shadowColor: _defaultColors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    glow: {
      shadowColor: _defaultColors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.20,
      shadowRadius: 10,
      elevation: 5,
    },
  },
  layout,
};

/**
 * Returns gradient colors for top status bar scrim:
 * Screen background color at 0.95 opacity fading to 0 over inset + 24px.
 */
export function getTopScrimColors(color: string): [string, string] {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  return [`rgba(${r}, ${g}, ${b}, 0.95)`, `rgba(${r}, ${g}, ${b}, 0)`];
}

export default theme;
