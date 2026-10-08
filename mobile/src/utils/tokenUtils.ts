import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

const USER_PROFILE_KEY = 'userProfile';

export interface StoredUserProfile {
  userId: string;
  gymId: string | null;
  gymCode?: string | null;
  role: string;
}

export const saveTokens = async (accessToken: string, refreshToken: string) => {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
};

export const saveUserProfile = async (profile: StoredUserProfile) => {
  await SecureStore.setItemAsync(USER_PROFILE_KEY, JSON.stringify(profile));
};

export const getUserProfile = async (): Promise<StoredUserProfile | null> => {
  const data = await SecureStore.getItemAsync(USER_PROFILE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as StoredUserProfile;
  } catch {
    return null;
  }
};

export const getAccessToken = async () => {
  return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = async () => {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_PROFILE_KEY);
};
