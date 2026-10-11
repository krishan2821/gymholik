import { create } from 'zustand';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
  saveUserProfile,
} from '../utils/tokenUtils';
import { queryClient } from '../api/queryClient';
import { apiClient, setAuthInterceptorsHandlers } from '../api/axiosConfig';

export interface AuthUser {
  userId: string;
  name?: string;
  phone?: string;
  email?: string | null;
  role: string;
  gymId?: string | null;
  gymName?: string | null;
  gymCode?: string | null;
  gymType?: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  role: string | null;
  userId: string | null;
  gymId: string | null;
  isLoading: boolean;
  /** In-memory ONLY registration token (scope REGISTER). Never persisted to disk. */
  registrationToken: string | null;
  /** In-memory ONLY verified phone number for pending owner registration. */
  registrationPhone: string | null;
  setUser: (user: AuthUser | null) => void;
  setRegistrationSession: (token: string, phone: string) => void;
  clearRegistrationSession: () => void;
  setAuthData: (
    accessToken: string,
    refreshToken: string,
    role: string,
    userId: string,
    gymId: string,
    name?: string,
    phone?: string,
    gymName?: string | null,
    gymCode?: string | null,
    gymType?: string | null
  ) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  role: null,
  userId: null,
  gymId: null,
  isLoading: true,
  registrationToken: null,
  registrationPhone: null,

  setUser: (user) => {
    set({
      user,
      role: user ? user.role : null,
      userId: user ? user.userId : null,
      gymId: user?.gymId !== undefined ? user.gymId ?? null : get().gymId,
    });
  },

  setRegistrationSession: (token, phone) => {
    set({
      registrationToken: token,
      registrationPhone: phone,
    });
  },

  clearRegistrationSession: () => {
    set({
      registrationToken: null,
      registrationPhone: null,
    });
  },

  setAuthData: async (
    accessToken,
    refreshToken,
    role,
    userId,
    gymId,
    name,
    phone,
    gymName,
    gymCode,
    gymType
  ) => {
    await saveTokens(accessToken, refreshToken);
    await saveUserProfile({
      userId,
      gymId: gymId || null,
      role,
      name,
      phone,
      gymName: gymName || null,
      gymCode: gymCode || null,
      gymType: gymType || null,
    });
    const userObj: AuthUser = {
      userId,
      role,
      gymId: gymId || null,
      name,
      phone,
      gymName: gymName || null,
      gymCode: gymCode || null,
      gymType: gymType || null,
    };
    set({
      isAuthenticated: true,
      user: userObj,
      role,
      userId,
      gymId: gymId || null,
      registrationToken: null,
      registrationPhone: null,
      isLoading: false,
    });
  },

  logout: async () => {
    await clearTokens();
    if (apiClient?.defaults?.headers?.common) {
      delete apiClient.defaults.headers.common.Authorization;
    }
    queryClient.clear();
    set({
      isAuthenticated: false,
      user: null,
      role: null,
      userId: null,
      gymId: null,
      registrationToken: null,
      registrationPhone: null,
      isLoading: false,
    });
  },

  checkAuth: async () => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        getAccessToken(),
        getRefreshToken(),
      ]);

      if (!accessToken && !refreshToken) {
        await clearTokens();
        set({
          isAuthenticated: false,
          user: null,
          role: null,
          userId: null,
          gymId: null,
          registrationToken: null,
          registrationPhone: null,
          isLoading: false,
        });
        return;
      }

      // Call GET /api/auth/me to validate the session and fetch the authoritative user & role.
      // On 401, the apiClient response interceptor refreshes the token once via POST /api/auth/refresh
      // and retries GET /api/auth/me. If refresh fails, it clears storage.
      const response = await apiClient.get('/api/auth/me');
      const me = response.data?.data;

      if (!me || !me.role) {
        throw new Error('Invalid /me response');
      }

      const resolvedUserId: string = me.userId || me.id;
      const resolvedGymId: string | null = me.gymId ?? null;
      const resolvedRole: string = me.role;

      const resolvedGymCode = me.gymCode || me.gym?.gymCode || null;
      const resolvedGymType = me.gymType || me.gym?.gymType || null;

      const userObj: AuthUser = {
        userId: resolvedUserId,
        name: me.name,
        phone: me.phone,
        email: me.email ?? null,
        role: resolvedRole,
        gymId: resolvedGymId,
        gymName: me.gymName ?? null,
        gymCode: resolvedGymCode,
        gymType: resolvedGymType,
      };

      await saveUserProfile({
        userId: resolvedUserId,
        gymId: resolvedGymId,
        role: resolvedRole,
        name: me.name,
        phone: me.phone,
        gymName: me.gymName ?? null,
        gymCode: resolvedGymCode,
        gymType: resolvedGymType,
      });

      set({
        isAuthenticated: true,
        user: userObj,
        role: resolvedRole,
        userId: resolvedUserId,
        gymId: resolvedGymId,
        isLoading: false,
      });
    } catch {
      await clearTokens();
      if (apiClient?.defaults?.headers?.common) {
        delete apiClient.defaults.headers.common.Authorization;
      }
      queryClient.clear();
      set({
        isAuthenticated: false,
        user: null,
        role: null,
        userId: null,
        gymId: null,
        registrationToken: null,
        registrationPhone: null,
        isLoading: false,
      });
    }
  },
}));

setAuthInterceptorsHandlers({
  getRegistrationToken: () => useAuthStore.getState().registrationToken,
  onSessionExpired: () => useAuthStore.getState().logout(),
});
