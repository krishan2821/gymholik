import axios, { AxiosError } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from '../utils/tokenUtils';
import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';

// Dynamically resolve base URL:
// - Physical devices (Expo Go): Metro host IP (e.g. http://192.168.31.214:8080)
// - Android Emulator: http://10.0.2.2:8080
// - iOS Simulator / Web: http://localhost:8080
export const resolveBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // Detect Metro dev host IP automatically
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8080`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8080';
  }

  return envUrl || 'http://localhost:8080';
};

export const BASE_URL = resolveBaseUrl();

// ─── Helper: dev-only structured logging (never log member/PII data) ────────
const SENSITIVE_PATTERNS = ['/members', '/attendance', '/notes', '/trainer-assignments', '/payments', '/dues', '/auth'];

const isSensitiveUrl = (url?: string): boolean => {
  if (!url) return false;
  return SENSITIVE_PATTERNS.some((p) => url.includes(p));
};

const devLog = (label: string, payload: any) => {
  if (__DEV__) {
    // Sanitize any payload that might contain member data
    if (payload && typeof payload === 'object' && payload.body && isSensitiveUrl(label)) {
      const sanitized = { ...payload, body: '[REDACTED_MEMBER_DATA]' };
      console.error(`[API ${label}]`, sanitized);
    } else {
      console.error(`[API ${label}]`, payload);
    }
  }
};

// ─── Classify an Axios error into a user-facing English message ───────────────
export interface ApiError {
  /** Human-readable message safe to show in the UI */
  message: string;
  /** Raw backend errorCode string, e.g. "INVALID_CREDENTIALS" */
  errorCode: string | null;
  /** HTTP status, null for network/timeout errors */
  status: number | null;
  /**
   * Field-level errors from 400 validation failures.
   * Key = backend field name, value = first error message.
   */
  fieldErrors: Record<string, string>;
}

export function classifyError(error: unknown): ApiError {
  const base: ApiError = { message: '', errorCode: null, status: null, fieldErrors: {} };

  if (!axios.isAxiosError(error)) {
    devLog('non-axios', error);
    return { ...base, message: 'An unexpected error occurred. Please try again.' };
  }

  const axErr = error as AxiosError<any>;
  const response = axErr.response;

  // ── Network / timeout (no response received) ──────────────────────────────
  if (!response) {
    devLog('network', { message: axErr.message, url: axErr.config?.url });
    if (axErr.code === 'ECONNABORTED' || axErr.message.toLowerCase().includes('timeout')) {
      return { ...base, message: 'Request timed out. Check your internet connection and try again.' };
    }
    return { ...base, message: 'Cannot reach the server. Check your internet connection.' };
  }

  const status = response.status;
  const body = response.data ?? {};
  const errorCode: string = body.errorCode ?? body.error ?? '';
  const serverMessage: string = body.message ?? '';

  devLog(`${status} ${axErr.config?.url}`, { errorCode, serverMessage, body });

  base.status = status;
  base.errorCode = errorCode || null;

  // ── 400 Bad Request / Validation ──────────────────────────────────────────
  if (status === 400) {
    // Spring's @Valid produces body.error as a map of fieldName → [messages]
    const rawErrors: Record<string, string[]> = body.error ?? {};
    const fieldErrors: Record<string, string> = {};
    Object.entries(rawErrors).forEach(([field, msgs]) => {
      fieldErrors[field] = Array.isArray(msgs) ? msgs[0] : String(msgs);
    });
    return {
      ...base,
      message: serverMessage || 'Please check the information you entered.',
      fieldErrors,
    };
  }

  // ── 401 Unauthorised / Invalid credentials ────────────────────────────────
  if (status === 401) {
    if (errorCode === 'REFRESH_TOKEN_NOT_FOUND' || errorCode === 'TOKEN_EXPIRED') {
      return { ...base, message: 'Your session has expired. Please log in again.' };
    }
    return { ...base, message: 'Invalid phone number or password. Please try again.' };
  }

  // ── 402 Payment Required (subscription / trial) ───────────────────────────
  if (status === 402) {
    if (errorCode === 'GYM_TRIAL_EXPIRED') {
      return {
        ...base,
        message: 'Your 14-day trial has ended. Please upgrade your plan to continue.',
      };
    }
    return {
      ...base,
      message: 'Your gym subscription has expired. Please contact the gym owner.',
    };
  }

  // ── 403 Forbidden ─────────────────────────────────────────────────────────
  if (status === 403) {
    if (errorCode === 'GYM_SUSPENDED') {
      return { ...base, message: 'This gym account has been suspended. Contact support.' };
    }
    if (errorCode === 'SUBSCRIPTION_EXPIRED') {
      return { ...base, message: 'Gym subscription expired. Please contact the gym owner.' };
    }
    return { ...base, message: 'You do not have permission to perform this action.' };
  }

  // ── 423 / 429 Account locked ──────────────────────────────────────────────
  if (status === 423 || status === 429 || errorCode === 'ACCOUNT_LOCKED') {
    return {
      ...base,
      message: 'Too many failed attempts. Your account is temporarily locked. Try again in 15 minutes.',
    };
  }

  // ── 5xx Server errors ─────────────────────────────────────────────────────
  if (status >= 500) {
    return { ...base, message: 'A server error occurred. Please try again later.' };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return { ...base, message: serverMessage || 'Something went wrong. Please try again.' };
}

// ─── Axios client ─────────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach access token ──────────────────────────────────
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: refresh token + subscription redirect ───────────────
let isRefreshing = false;
let failedQueue: { resolve: (t: string) => void; reject: (e: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const axErr = error as AxiosError<any>;
    const originalRequest = axErr.config as any;
    const status = axErr.response?.status;
    const url = originalRequest?.url || '';
    const body = axErr.response?.data;
    const errorCode: string = body?.errorCode ?? body?.error ?? '';

    // Log the error to console in development only (excluding member data)
    if (__DEV__) {
      console.error(
        `[API Error] Status: ${status ?? 'NO_RESPONSE'} | URL: ${url}`,
        {
          status,
          url,
          responseBody: isSensitiveUrl(url) ? '[REDACTED_MEMBER_DATA]' : body,
          message: axErr.message,
        }
      );
    }

    // ── Redirect on subscription expiry (402 / 403 SUBSCRIPTION_EXPIRED) ─────
    if (
      (status === 402 || status === 403) &&
      (errorCode === 'SUBSCRIPTION_EXPIRED' || errorCode === 'GYM_TRIAL_EXPIRED')
    ) {
      router.replace('/(tabs)/more/subscription');
      return Promise.reject(error);
    }

    // Auth endpoints (/login, /register-gym, /refresh) should never attempt token refresh
    const isAuthRoute =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register-gym') ||
      url.includes('/api/auth/refresh');

    // ── Token refresh on 401 or unauthenticated 403 ─────────────────────────
    const isUnauthenticated =
      status === 401 ||
      (status === 403 && (errorCode === 'UNAUTHORIZED' || (!errorCode && (!body || body === ''))));

    if (isUnauthenticated && !originalRequest?._retry && !isAuthRoute && errorCode !== 'INVALID_CREDENTIALS') {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken: string = data.data.accessToken;
        const newRefreshToken: string = data.data.refreshToken;

        await saveTokens(newAccessToken, newRefreshToken);

        apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        await clearTokens();
        useAuthStore.getState().logout();
        router.replace('/(auth)/login');
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
