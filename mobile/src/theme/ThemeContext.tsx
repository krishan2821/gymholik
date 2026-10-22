/**
 * ThemeContext.tsx — Provides the resolved SemanticTokens + layout tokens
 * to the entire component tree.
 *
 * Usage:
 *   const { colors, fonts, spacing, radius, elevation, layout, mode, isDark } = useTheme();
 *   const styles = useStyles(makeStyles);
 */

import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { BRAND } from './palette';
import { useAppearanceStore } from './useAppearance';
import { buildTheme, updateThemePalette, ThemeValue } from './theme';

export type { ThemeValue } from './theme';

const ThemeContext = createContext<ThemeValue | null>(null);

export const ThemeProvider: React.FC<{ mode?: ColorMode; children: React.ReactNode }> = ({
  mode: propMode,
  children,
}) => {
  const storeMode = useAppearanceStore((s) => s.resolvedMode);
  const resolvedMode = propMode ?? storeMode;
  const value = useMemo(() => {
    const th = buildTheme(resolvedMode, BRAND);
    updateThemePalette(th.colors, resolvedMode);
    return th;
  }, [resolvedMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const mode = useAppearanceStore.getState?.()?.resolvedMode ?? 'dark';
    return buildTheme(mode, BRAND);
  }
  return ctx;
}

export function useStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  makeStyles: (theme: ThemeValue) => T
): T {
  const theme = useTheme();
  return useMemo(() => makeStyles(theme), [theme.mode, theme.brand, makeStyles]);
}

export { theme, colors } from './theme';
