/**
 * ThemeContext.tsx — Single Source of Appearance & Theme Provider.
 *
 * OWNS:
 * - Stored user preference ('system' | 'light' | 'dark')
 * - OS color scheme synchronization via Appearance listener
 * - Resolved mode ('light' | 'dark') with no default dark fallback
 * - Theme tokens, styles hook (useStyles), and ThemeContext
 *
 * All Appearance.* and useColorScheme logic in the application is centralized
 * exclusively in this file.
 */

import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { Appearance, Platform, StyleSheet } from 'react-native';
import { create } from 'zustand';
import { BRAND, ColorMode, SemanticTokens } from './palette';
import { buildTheme, updateThemePalette, ThemeValue } from './theme';

export type { ThemeValue } from './theme';
export type AppearanceSetting = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'gymholik_appearance';

// ─────────────────────────────────────────────────────────────────────────────
// Thin, cross-platform key-value storage (non-secure)
// ─────────────────────────────────────────────────────────────────────────────
async function persistRead(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem(key)
        : null;
    }
    const fs: any = await import('expo-file-system/legacy');
    const docDir = fs.documentDirectory;
    if (!docDir) return null;
    const path = `${docDir}${key}.json`;
    const info = await fs.getInfoAsync(path);
    if (!info.exists) return null;
    const val = await fs.readAsStringAsync(path);
    return val ? val.trim() : null;
  } catch {
    return null;
  }
}

async function persistWrite(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }
    const fs: any = await import('expo-file-system/legacy');
    const docDir = fs.documentDirectory;
    if (!docDir) return;
    const path = `${docDir}${key}.json`;
    await fs.writeAsStringAsync(path, value.trim());
  } catch {
    // non-critical
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Appearance State & Resolution (Single Source of Truth)
// ─────────────────────────────────────────────────────────────────────────────
function resolveMode(setting: AppearanceSetting, osMode?: ColorMode): ColorMode {
  if (setting === 'light') return 'light';
  if (setting === 'dark') return 'dark';
  if (osMode) return osMode;
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

interface AppearanceStoreState {
  setting: AppearanceSetting;
  resolvedMode: ColorMode;
  isHydrated: boolean;
  setSetting: (s: AppearanceSetting) => Promise<void>;
  _onOsChange: (osMode: ColorMode) => void;
  _setHydrated: (setting: AppearanceSetting, mode: ColorMode) => void;
}

const initialOsMode: ColorMode =
  Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

export const useAppearanceStore = create<AppearanceStoreState>((set, get) => ({
  setting: 'system',
  resolvedMode: initialOsMode,
  isHydrated: false,

  setSetting: async (s) => {
    const currentOs: ColorMode =
      Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
    const resolved = resolveMode(s, currentOs);
    set({ setting: s, resolvedMode: resolved });
    await persistWrite(STORAGE_KEY, s);
  },

  _onOsChange: (osMode) => {
    const { setting } = get();
    if (setting === 'system') {
      set({ resolvedMode: osMode });
    }
  },

  _setHydrated: (setting, mode) => {
    set({ setting, resolvedMode: mode, isHydrated: true });
  },
}));

/** Load persisted setting on app cold start. */
export async function loadAppearanceSetting(): Promise<ColorMode> {
  try {
    const stored = await persistRead(STORAGE_KEY);
    const osMode: ColorMode =
      Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      const resolved = resolveMode(stored as AppearanceSetting, osMode);
      useAppearanceStore.getState()._setHydrated(stored as AppearanceSetting, resolved);
      return resolved;
    }
    // No stored setting -> default to 'system' resolved to current OS mode
    useAppearanceStore.getState()._setHydrated('system', osMode);
    return osMode;
  } catch {
    const osMode: ColorMode =
      Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
    useAppearanceStore.getState()._setHydrated('system', osMode);
    return osMode;
  }
}

/** Legacy hook placeholder; synchronization is handled directly by ThemeProvider. */
export function useAppearanceSync(): void {
  // Appearance listener is attached inside ThemeProvider
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Context & Provider
// ─────────────────────────────────────────────────────────────────────────────
export interface FullThemeValue extends ThemeValue {
  setting: AppearanceSetting;
  setSetting: (s: AppearanceSetting) => Promise<void>;
  isHydrated: boolean;
}

const ThemeContext = createContext<FullThemeValue | null>(null);

export const ThemeProvider: React.FC<{ mode?: ColorMode; children: React.ReactNode }> = ({
  mode: propMode,
  children,
}) => {
  const storeMode = useAppearanceStore((s) => s.resolvedMode);
  const setting = useAppearanceStore((s) => s.setting);
  const setSetting = useAppearanceStore((s) => s.setSetting);
  const isHydrated = useAppearanceStore((s) => s.isHydrated);

  const resolvedMode = propMode ?? storeMode;

  // Single OS Appearance change listener in the entire app
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const mode: ColorMode = colorScheme === 'dark' ? 'dark' : 'light';
      useAppearanceStore.getState()._onOsChange(mode);
    });

    return () => {
      subscription?.remove?.();
    };
  }, []);

  // Hydrate stored preference on mount if not already done
  useEffect(() => {
    if (!isHydrated) {
      loadAppearanceSetting();
    }
  }, [isHydrated]);

  const value: FullThemeValue = useMemo(() => {
    const th = buildTheme(resolvedMode, BRAND);
    updateThemePalette(th.colors, resolvedMode);
    return {
      ...th,
      setting,
      setSetting,
      isHydrated,
    };
  }, [resolvedMode, setting, setSetting, isHydrated]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): FullThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const state = useAppearanceStore.getState?.();
    const mode = state?.resolvedMode ?? initialOsMode;
    const th = buildTheme(mode, BRAND);
    return {
      ...th,
      setting: state?.setting ?? 'system',
      setSetting: state?.setSetting ?? (async () => {}),
      isHydrated: state?.isHydrated ?? true,
    };
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
