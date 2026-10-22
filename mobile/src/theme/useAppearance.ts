/**
 * useAppearance.ts — Re-exports appearance store and helpers from ThemeContext.
 * Appearance logic and OS listeners are centralized exclusively in the single provider: ThemeContext.tsx.
 */

export type { AppearanceSetting } from './ThemeContext';
export {
  useAppearanceStore,
  loadAppearanceSetting,
  useAppearanceSync,
} from './ThemeContext';
