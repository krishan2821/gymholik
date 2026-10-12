import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export async function setStringAsync(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback to expo-clipboard
    }
  }
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}

export const safeSetClipboardString = setStringAsync;
export const setClipboardString = setStringAsync;

export async function getStringAsync(): Promise<string> {
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      }
    } catch {
      // fallback to expo-clipboard
    }
  }
  try {
    return await Clipboard.getStringAsync();
  } catch {
    return '';
  }
}

export default {
  setStringAsync,
  getStringAsync,
};
