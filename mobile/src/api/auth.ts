/**
 * Auth API — field names match the backend DTOs exactly:
 *   LoginRequest        → phone, password, gymCode
 *   RegisterGymRequest  → gymName, ownerName, ownerPhone, password, city?
 *   TokenResponse       → accessToken, refreshToken, tokenType, expiresIn, userId, gymId, role
 *   GymResponse         → gymId, gymName, gymCode, ownerName, ownerPhone, trialEndsAt
 *
 * NOTE: gymPhone has been removed. The owner's mobile number (ownerPhone)
 * is now used as both the login credential and the gym's contact number.
 */
import { apiClient } from './axiosConfig';

// ─── Request / Response types ─────────────────────────────────────────────────

export interface LoginRequest {
  phone: string;
  password: string;
  /** Required for OWNER/STAFF. Leave undefined for SUPER_ADMIN. */
  gymCode?: string;
}

export interface RegisterGymRequest {
  gymName: string;
  ownerName: string;
  /** The owner's mobile number — also used as the gym contact number. */
  ownerPhone: string;
  password: string;
  /** Optional city / area for the gym. */
  city?: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  gymId: string | null;
  gymCode?: string | null;
  role: string;
}

export interface GymResponse {
  gymId: string;
  gymName: string;
  gymCode: string;
  ownerName: string;
  ownerPhone: string;
  trialEndsAt: string;
}

export interface TrainerTypeInfo {
  id: string;
  name: string;
  active: boolean;
}

export interface MeResponse {
  id: string;
  userId: string;
  name: string;
  phone: string;
  role: string;
  gymId: string | null;
  gymName: string | null;
  gymCode: string | null;
  active: boolean;
  status: string;
  trainerTypes: TrainerTypeInfo[];
}

export interface UpdateMeRequest {
  name?: string;
  phone?: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function loginUser(req: LoginRequest): Promise<TokenResponse> {
  const { data } = await apiClient.post<{ success: boolean; data: TokenResponse }>(
    '/api/auth/login',
    req
  );
  return data.data;
}

export async function registerGym(req: RegisterGymRequest): Promise<GymResponse> {
  const { data } = await apiClient.post<{ success: boolean; data: GymResponse }>(
    '/api/auth/register-gym',
    req
  );
  return data.data;
}

export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<{ success: boolean; data: TokenResponse }>(
    '/api/auth/refresh',
    { refreshToken }
  );
  return data.data;
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await apiClient.get<{ success: boolean; data: MeResponse }>(
    '/api/auth/me'
  );
  return data.data;
}

export async function updateMe(req: UpdateMeRequest): Promise<MeResponse> {
  const { data } = await apiClient.put<{ success: boolean; data: MeResponse }>(
    '/api/auth/me',
    req
  );
  return data.data;
}

/**
 * Convenience: register a gym then immediately sign the owner in.
 * Returns both the GymResponse (contains gymCode) and a TokenResponse so
 * the caller can hydrate the auth store and navigate to the dashboard.
 */
export async function registerAndLogin(
  req: RegisterGymRequest
): Promise<{ gym: GymResponse; tokens: TokenResponse }> {
  const gym = await registerGym(req);
  const tokens = await loginUser({
    phone: req.ownerPhone,
    password: req.password,
    gymCode: gym.gymCode,
  });
  return { gym, tokens };
}

// ─── React Query Hooks ────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const data = await getMe();
      if (data) {
        setUser({
          userId: data.userId || data.id,
          name: data.name,
          phone: data.phone,
          role: data.role,
          gymId: data.gymId,
          gymName: data.gymName,
          gymCode: data.gymCode,
        });
      }
      return data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdateCurrentUser() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: updateMe,
    onSuccess: (updated) => {
      if (updated) {
        setUser({
          userId: updated.userId || updated.id,
          name: updated.name,
          phone: updated.phone,
          role: updated.role,
          gymId: updated.gymId,
          gymName: updated.gymName,
          gymCode: updated.gymCode,
        });
      }
      queryClient.setQueryData(['me'], updated);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
