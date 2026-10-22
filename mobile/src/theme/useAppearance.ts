/**
 * useAppearance.ts — Appearance store (System / Light / Dark).
 *
 * - Reads OS preference with useColorScheme.
 * - Persisted to localStorage on web and expo-file-system-backed storage on
 *   native (simple JSON file). NOT secure storage (appearance pref is not
 *   sensitive).
 * - Exposes the resolved ColorMode for theme consumers.
 */

import { useEffect } from 'react';
import { useColorScheme, Appearance, Platform } from 'react-native';
import { create } from 'zustand';
import { ColorMode } from './palette';

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
// Zustand store
// ─────────────────────────────────────────────────────────────────────────────
interface AppearanceState {
  setting: AppearanceSetting;
  resolvedMode: ColorMode;
  setSetting: (s: AppearanceSetting) => Promise<void>;
  _hydrate: (osMode: ColorMode) => void;
}

function resolveMode(setting: AppearanceSetting, osMode: ColorMode): ColorMode {
  if (setting === 'light') return 'light';
  if (setting === 'dark') return 'dark';
  return osMode;
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  setting: 'system',
  resolvedMode: (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') as ColorMode,

  setSetting: async (s) => {
    const osMode = (Appearance.getColorScheme() ?? 'dark') as ColorMode;
    const resolved = resolveMode(s, osMode);
    set({ setting: s, resolvedMode: resolved });
    await persistWrite(STORAGE_KEY, s);
  },

  _hydrate: (osMode) => {
    const { setting } = get();
    set({ resolvedMode: resolveMode(setting, osMode) });
  },
}));

/** Load persisted setting once, on app start. */
export async function loadAppearanceSetting(): Promise<void> {
  try {
    const stored = await persistRead(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      const osMode = (Appearance.getColorScheme() ?? 'dark') as ColorMode;
      const resolved = resolveMode(stored, osMode);
      useAppearanceStore.setState({ setting: stored, resolvedMode: resolved });
    }
  } catch {
    // ignore
  }
}

/**
 * Hook that keeps resolvedMode in sync with OS preference changes.
 * Call once at the root of the app.
 */
export function useAppearanceSync(): void {
  const osScheme = useColorScheme();
  const _hydrate = useAppearanceStore((s) => s._hydrate);

  useEffect(() => {
    const osMode = (osScheme ?? Appearance.getColorScheme() ?? 'dark') as ColorMode;
    _hydrate(osMode);

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const mode = (colorScheme ?? 'dark') as ColorMode;
      _hydrate(mode);
    });

    return () => {
      subscription?.remove?.();
    };
  }, [osScheme, _hydrate]);
}
