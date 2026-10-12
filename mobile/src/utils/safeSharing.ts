import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

export async function isAvailableAsync(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }
  try {
    return await Sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

export const safeIsAvailableAsync = isAvailableAsync;

export async function shareAsync(
  url: string,
  options?: Sharing.SharingOptions
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      try {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = (options?.dialogTitle ? options.dialogTitle.replace(/\s+/g, '_') : 'download');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        window.open(url, '_blank');
      }
    }
    return;
  }

  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(url, options);
  }
}

export const safeShareAsync = shareAsync;

export default {
  isAvailableAsync,
  shareAsync,
  safeIsAvailableAsync,
  safeShareAsync,
};
