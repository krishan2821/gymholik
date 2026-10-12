import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

export const impactAsync = async (
  style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Light
): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await ExpoHaptics.impactAsync(style);
  } catch {
    // no-op on failure or unsupported device
  }
};

export const notificationAsync = async (
  type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success
): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await ExpoHaptics.notificationAsync(type);
  } catch {
    // no-op
  }
};

export const selectionAsync = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await ExpoHaptics.selectionAsync();
  } catch {
    // no-op
  }
};

export const safeImpactAsync = impactAsync;
export const safeNotificationAsync = notificationAsync;
export const safeSelectionAsync = selectionAsync;
export const Haptics = {
  impactAsync,
  notificationAsync,
  selectionAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};

export default {
  impactAsync,
  notificationAsync,
  selectionAsync,
  safeImpactAsync,
  safeNotificationAsync,
  safeSelectionAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};

