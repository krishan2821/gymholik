/**
 * Auth API — OTP authentication and session management.
 */
import { apiClient } from './axiosConfig';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';

// ─── Request / Response types ─────────────────────────────────────────────────

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  gymId: string | null;
  role: string;
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
  email?: string | null;
  role: string;
  gymId: string | null;
  gymName: string | null;
  gymCode?: string | null;
  gymType?: string | null;
  gym?: GymSummary | null;
  active: boolean;
  status: string;
  trainerTypes: TrainerTypeInfo[];
}

export interface UpdateMeRequest {
  name?: string;
  phone?: string;
}

export interface SendOtpResponse {
  resendAfterSeconds: number;
  expiresInSeconds: number;
}

export interface VerifyOtpUser {
  id: string;
  name: string;
  role: string;
  gymId: string | null;
  gymName: string | null;
}

export interface GymSummary {
  id: string;
  name: string;
  gymCode?: string;
  gymType?: string;
}

export interface VerifyOtpResponse {
  isNewUser?: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: VerifyOtpUser;
  gym?: GymSummary;
  registrationToken?: string;
}

export interface GymAddressDto {
  line1: string;
  line2?: string;
  state: string;
  district: string;
  pincode: string;
}

export interface CompleteRegistrationRequest {
  gymName: string;
  gymType?: string;
  ownerName: string;
  email?: string;
  legalIdType?: string;
  legalIdNumber?: string;
  address?: GymAddressDto;
  acceptedTerms?: boolean;
  termsVersion?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function sendOtp(phone: string): Promise<ApiEnvelope<SendOtpResponse>> {
  const { data } = await apiClient.post<ApiEnvelope<SendOtpResponse>>(
    '/api/auth/send-otp',
    { phone }
  );
  return data;
}

export async function verifyOtp(
  phone: string,
  otp: string
): Promise<ApiEnvelope<VerifyOtpResponse>> {
  const { data } = await apiClient.post<ApiEnvelope<VerifyOtpResponse>>(
    '/api/auth/verify-otp',
    { phone, otp }
  );
  return data;
}

export async function completeRegistration(
  req: CompleteRegistrationRequest,
  registrationToken: string
): Promise<ApiEnvelope<VerifyOtpResponse>> {
  const { data } = await apiClient.post<ApiEnvelope<VerifyOtpResponse>>(
    '/api/auth/complete-registration',
    req,
    {
      headers: {
        Authorization: `Bearer ${registrationToken}`,
      },
    }
  );
  return data;
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

// ─── React Query Hooks ────────────────────────────────────────────────────────

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
          email: data.email ?? null,
          role: data.role,
          gymId: data.gymId,
          gymName: data.gymName,
          gymCode: data.gymCode || data.gym?.gymCode || null,
          gymType: data.gymType || data.gym?.gymType || null,
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
          email: updated.email ?? null,
          role: updated.role,
          gymId: updated.gymId,
          gymName: updated.gymName,
        });
      }
      queryClient.setQueryData(['me'], updated);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
