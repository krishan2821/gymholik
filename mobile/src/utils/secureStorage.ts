import { Platform } from 'react-native';
import * as ExpoSecureStore from 'expo-secure-store';

/**
 * Universal Secure Storage abstraction.
 *
 * - Native (iOS / Android): Delegates to hardware-backed expo-secure-store (Keychain / Keystore).
 * - Web: Delegates to window.sessionStorage.
 *
 * NOTE: sessionStorage is used here for dev and demo on web (tokens must not survive a closed tab).
 * In production, httpOnly cookies are the plan.
 */

export async function getItemAsync(
  key: string,
  options?: ExpoSecureStore.SecureStoreOptions
): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(key);
    }
    return null;
  }
  return await ExpoSecureStore.getItemAsync(key, options);
}

export async function setItemAsync(
  key: string,
  value: string,
  options?: ExpoSecureStore.SecureStoreOptions
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
    }
    return;
  }
  await ExpoSecureStore.setItemAsync(key, value, options);
}

export async function deleteItemAsync(
  key: string,
  options?: ExpoSecureStore.SecureStoreOptions
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
    return;
  }
  await ExpoSecureStore.deleteItemAsync(key, options);
}

export default {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
};
