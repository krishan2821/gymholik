import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_PROFILE_KEY = 'userProfile';

const isWeb = Platform.OS === 'web';
const memoryStorage = new Map<string, string>();

const getItem = async (key: string): Promise<string | null> => {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // fallback
    }
    return memoryStorage.get(key) || null;
  }
  return await SecureStore.getItemAsync(key);
};

const setItem = async (key: string, value: string): Promise<void> => {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // fallback
    }
    memoryStorage.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

const deleteItem = async (key: string): Promise<void> => {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // fallback
    }
    memoryStorage.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
};

export interface StoredUserProfile {
  userId: string;
  gymId: string | null;
  role: string;
  name?: string;
  phone?: string;
  gymName?: string | null;
  gymCode?: string | null;
  gymType?: string | null;
}

export const saveTokens = async (accessToken: string, refreshToken: string) => {
  await setItem(ACCESS_TOKEN_KEY, accessToken);
  await setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const saveUserProfile = async (profile: StoredUserProfile) => {
  await setItem(USER_PROFILE_KEY, JSON.stringify(profile));
};

export const getUserProfile = async (): Promise<StoredUserProfile | null> => {
  const data = await getItem(USER_PROFILE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as StoredUserProfile;
  } catch {
    return null;
  }
};

export const getAccessToken = async () => {
  return await getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = async () => {
  return await getItem(REFRESH_TOKEN_KEY);
};

export const clearTokens = async () => {
  await deleteItem(ACCESS_TOKEN_KEY);
  await deleteItem(REFRESH_TOKEN_KEY);
  await deleteItem(USER_PROFILE_KEY);
};
