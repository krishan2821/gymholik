import { Linking, Platform } from 'react-native';

export async function openURL(url: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
    return false;
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export const safeOpenURL = openURL;

export async function openWhatsApp(phone: string, message?: string): Promise<boolean> {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
  const url = message
    ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${formattedPhone}`;

  return openURL(url);
}

export async function openPhone(phone: string): Promise<boolean> {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const url = `tel:${cleanPhone}`;
  return openURL(url);
}

export async function openSettings(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

export default {
  openURL,
  openWhatsApp,
  openPhone,
  openSettings,
  canOpenURL: Linking.canOpenURL,
};
