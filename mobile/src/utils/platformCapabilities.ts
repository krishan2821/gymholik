import { Platform } from 'react-native';
import { springConfigs, getPlatformSpring, canUseGlassRule } from './platformRules';

export { springConfigs, getPlatformSpring, canUseGlassRule };

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

/**
 * Returns the major version of iOS if running on iOS, otherwise 0.
 */
export function getIOSMajorVersion(): number {
  if (!isIOS) return 0;
  const major = parseInt(String(Platform.Version), 10);
  return Number.isNaN(major) ? 0 : major;
}

/**
 * Detects iOS 26 or greater.
 */
export function isIOS26(): boolean {
  return isIOS && getIOSMajorVersion() >= 26;
}

/**
 * Determines whether glass/blur effects should be rendered.
 * Glass is strictly allowed on iOS 26 only, and NEVER on Android or when reduce-transparency is enabled.
 */
export function canUseGlass(options?: {
  platformOverride?: 'ios26' | 'ios' | 'android' | 'web';
  reduceTransparency?: boolean;
}): boolean {
  return canUseGlassRule({
    platformOS: Platform.OS,
    osVersion: getIOSMajorVersion(),
    platformOverride: options?.platformOverride,
    reduceTransparency: options?.reduceTransparency,
  });
}
