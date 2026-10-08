import { create } from 'zustand';
import { clearTokens, getAccessToken, getUserProfile, saveTokens, saveUserProfile } from '../utils/tokenUtils';
import { queryClient } from '../api/queryClient';

export interface AuthUser {
  userId: string;
  name?: string;
  phone?: string;
  role: string;
  gymId?: string | null;
  gymName?: string | null;
  gymCode?: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  role: string | null;
  userId: string | null;
  gymId: string | null;
  gymCode: string | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setAuthData: (
    accessToken: string,
    refreshToken: string,
    role: string,
    userId: string,
    gymId: string,
    gymCode?: string | null,
    name?: string,
    phone?: string,
    gymName?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// Base64 decoding helper for React Native / Hermes
function base64Decode(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input.replace(/=+$/, '');
  let output = '';
  if (str.length % 4 === 1) {
    throw new Error('Invalid base64 string');
  }
  for (
    let bc = 0, bs = 0, buffer: number, idx = 0;
    (buffer = str.charCodeAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(String.fromCharCode(buffer));
  }
  return output;
}

// Robust Base64URL decoder for JWT without crashing
function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const decoded = typeof atob === 'function' ? atob(base64) : base64Decode(base64);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  role: null,
  userId: null,
  gymId: null,
  gymCode: null,
  isLoading: true,

  setUser: (user) => {
    set({
      user,
      role: user ? user.role : null,
      userId: user ? user.userId : null,
      gymId: user?.gymId !== undefined ? user.gymId : get().gymId,
      gymCode: user?.gymCode !== undefined ? user.gymCode : get().gymCode,
    });
  },

  setAuthData: async (accessToken, refreshToken, role, userId, gymId, gymCode, name, phone, gymName) => {
    await saveTokens(accessToken, refreshToken);
    await saveUserProfile({ userId, gymId, gymCode: gymCode || null, role });
    const userObj: AuthUser = {
      userId,
      role,
      gymId,
      gymCode: gymCode || null,
      name,
      phone,
      gymName,
    };
    set({
      isAuthenticated: true,
      user: userObj,
      role,
      userId,
      gymId,
      gymCode: gymCode || null,
      isLoading: false,
    });
  },

  logout: async () => {
    await clearTokens();
    queryClient.clear();
    set({
      isAuthenticated: false,
      user: null,
      role: null,
      userId: null,
      gymId: null,
      gymCode: null,
      isLoading: false,
    });
  },

  checkAuth: async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        set({
          isAuthenticated: false,
          user: null,
          role: null,
          userId: null,
          gymId: null,
          gymCode: null,
          isLoading: false,
        });
        return;
      }

      // Check stored user profile from SecureStore
      const profile = await getUserProfile();
      if (profile) {
        const userObj: AuthUser = {
          userId: profile.userId,
          role: profile.role,
          gymId: profile.gymId,
          gymCode: profile.gymCode || null,
        };
        set({
          isAuthenticated: true,
          user: userObj,
          role: profile.role,
          userId: profile.userId,
          gymId: profile.gymId,
          gymCode: profile.gymCode || null,
          isLoading: false,
        });
        return;
      }

      // Fallback: decode JWT payload
      const payload = parseJwtPayload(token);
      if (payload) {
        const userObj: AuthUser = {
          userId: payload.sub || '',
          role: payload.role || 'OWNER',
          gymId: payload.gymId || null,
          gymCode: null,
        };
        set({
          isAuthenticated: true,
          user: userObj,
          role: payload.role || null,
          userId: payload.sub || null,
          gymId: payload.gymId || null,
          gymCode: null,
          isLoading: false,
        });
      } else {
        set({ isAuthenticated: false, user: null, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, user: null, isLoading: false });
    }
  },
}));
