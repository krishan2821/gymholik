import axios, { AxiosError } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from '../utils/tokenUtils';
import { router } from 'expo-router';

type RegistrationTokenGetter = () => string | null;
type SessionExpiredHandler = () => void | Promise<void>;

let getRegistrationTokenFn: RegistrationTokenGetter | null = null;
let onSessionExpiredFn: SessionExpiredHandler | null = null;

export const setAuthInterceptorsHandlers = (handlers: {
  getRegistrationToken?: RegistrationTokenGetter;
  onSessionExpired?: SessionExpiredHandler;
}) => {
  if (handlers.getRegistrationToken) getRegistrationTokenFn = handlers.getRegistrationToken;
  if (handlers.onSessionExpired) onSessionExpiredFn = handlers.onSessionExpired;
};

// Dynamically resolve base URL:
// - Physical devices (Expo Go): Metro host IP (e.g. http://192.168.31.214:8080)
// - Android Emulator: http://10.0.2.2:8080
// - iOS Simulator / Web: http://localhost:8080
export const resolveBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  if (Platform.OS === 'web') {
    // If an external production URL is specified, use it
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') && !envUrl.startsWith('http://192.168.')) {
      return envUrl;
    }
    // When running web dev on localhost, connect directly to localhost:8080
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return 'http://localhost:8080';
    }
    return envUrl || 'http://localhost:8080';
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
const SENSITIVE_PATTERNS = [
  '/members',
  '/attendance',
  '/notes',
  '/trainer-assignments',
  '/payments',
  '/dues',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
  '/api/auth/complete-registration',
];

const isSensitiveUrl = (url?: string): boolean => {
  if (!url) return false;
  return SENSITIVE_PATTERNS.some((p) => url.includes(p));
};

const devLog = (label: string, payload: any) => {
  if (__DEV__) {
    // Sanitize any payload that might contain member or auth PII data
    if (payload && typeof payload === 'object' && payload.body && isSensitiveUrl(label)) {
      const sanitized = { ...payload, body: '[REDACTED_SENSITIVE_DATA]' };
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
  /** Raw backend errorCode string, e.g. "INVALID_OTP", "RATE_LIMITED" */
  errorCode: string | null;
  /** HTTP status, null for network/timeout errors */
  status: number | null;
  /** Optional retry countdown in seconds returned by rate-limiting endpoints */
  retryAfterSeconds?: number | null;
  /**
   * Field-level errors from 400 validation failures.
   * Key = backend field name, value = first error message.
   */
  fieldErrors: Record<string, string>;
}

export function classifyError(error: unknown): ApiError {
  const base: ApiError = {
    message: '',
    errorCode: null,
    status: null,
    retryAfterSeconds: null,
    fieldErrors: {},
  };

  if (!axios.isAxiosError(error)) {
    devLog('non-axios', error);
    const msg = (error as any)?.message || '';
    if (Platform.OS === 'web' && (msg.includes('Network') || msg.includes('Failed to fetch'))) {
      return {
        ...base,
        errorCode: 'NETWORK_OR_CORS_ERROR',
        message: 'Unable to reach the server. The server may be down or the request was blocked by CORS.',
      };
    }
    return { ...base, message: 'An unexpected error occurred. Please try again.' };
  }

  const axErr = error as AxiosError<any>;
  const response = axErr.response;

  // ── Network / timeout / CORS (no response received) ──────────────────────────────
  if (!response) {
    devLog('network', { message: axErr.message, url: axErr.config?.url });
    if (Platform.OS === 'web') {
      return {
        ...base,
        errorCode: 'NETWORK_OR_CORS_ERROR',
        message: 'Unable to reach the server. The server may be down or the request was blocked by CORS.',
      };
    }
    if (axErr.code === 'ECONNABORTED' || axErr.message?.toLowerCase().includes('timeout')) {
      return {
        ...base,
        errorCode: 'NETWORK_ERROR',
        message: 'Cannot connect to the server. Please check your internet connection and try again.',
      };
    }
    return {
      ...base,
      errorCode: 'NETWORK_ERROR',
      message: 'Cannot connect to the server. Please check your internet connection and try again.',
    };
  }

  const status = response.status;
  const body = response.data ?? {};
  const errorCode: string = body.errorCode ?? body.error ?? '';
  const serverMessage: string = body.message ?? '';
  const retryAfterSeconds: number | null =
    typeof body.retryAfterSeconds === 'number'
      ? body.retryAfterSeconds
      : typeof body?.data?.retryAfterSeconds === 'number'
      ? body.data.retryAfterSeconds
      : null;

  devLog(`${status} ${axErr.config?.url}`, { errorCode, serverMessage, body });

  base.status = status;
  base.errorCode = errorCode || null;
  base.retryAfterSeconds = retryAfterSeconds;

  // ── 400 Bad Request / Validation ──────────────────────────────────────────
  if (status === 400) {
    // Spring's @Valid produces body.error as a map of fieldName → [messages]
    const rawErrors: Record<string, string[]> =
      body.error && typeof body.error === 'object' ? body.error : {};
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

  // ── 401 Unauthorised / Invalid OTP or credentials ─────────────────────────
  if (status === 401) {
    if (errorCode === 'INVALID_OTP') {
      return {
        ...base,
        message: 'Invalid or expired OTP. Please try again or request a new code.',
      };
    }
    if (errorCode === 'REFRESH_TOKEN_NOT_FOUND' || errorCode === 'TOKEN_EXPIRED') {
      return { ...base, message: 'Your session has expired. Please log in again.' };
    }
    return { ...base, message: serverMessage || 'Invalid credentials. Please try again.' };
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
      message: 'Your gym subscription has expired. Please contact your gym owner to renew.',
    };
  }

  // ── 403 Forbidden ─────────────────────────────────────────────────────────
  if (status === 403) {
    if (errorCode === 'ACCOUNT_INACTIVE') {
      return {
        ...base,
        message: 'Your account is inactive. Please contact your gym owner',
      };
    }
    if (errorCode === 'GYM_SUSPENDED') {
      return {
        ...base,
        message: 'This gym account has been suspended. Please contact support for assistance.',
      };
    }
    if (errorCode === 'SUBSCRIPTION_EXPIRED') {
      return {
        ...base,
        message: 'Your gym subscription has expired. Please contact your gym owner to renew.',
      };
    }
    return { ...base, message: 'You do not have permission to perform this action.' };
  }

  // ── 409 Conflict (already registered) ─────────────────────────────────────
  if (
    status === 409 ||
    errorCode === 'PHONE_ALREADY_EXISTS' ||
    errorCode === 'PHONE_ALREADY_REGISTERED'
  ) {
    return {
      ...base,
      errorCode: errorCode || 'PHONE_ALREADY_EXISTS',
      message:
        serverMessage ||
        'This mobile number is already registered. Please sign in with your mobile number.',
    };
  }

  // ── 423 / 429 Rate limited or locked ──────────────────────────────────────
  if (status === 423 || status === 429 || errorCode === 'RATE_LIMITED' || errorCode === 'ACCOUNT_LOCKED') {
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      const mins = Math.floor(retryAfterSeconds / 60);
      const secs = retryAfterSeconds % 60;
      const retryLabel =
        mins > 0
          ? secs > 0
            ? `${mins}m ${secs}s`
            : `${mins} minute${mins === 1 ? '' : 's'}`
          : `${secs} second${secs === 1 ? '' : 's'}`;
      return {
        ...base,
        errorCode: errorCode || 'RATE_LIMITED',
        message: `Too many attempts. Please try again in ${retryLabel}.`,
      };
    }
    return {
      ...base,
      errorCode: errorCode || 'RATE_LIMITED',
      message: serverMessage || 'Too many attempts. Please wait a moment and try again.',
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

// ── Request interceptor: attach access token (and isolate registrationToken) ──
apiClient.interceptors.request.use(
  async (config) => {
    const url = config.url || '';
    const isPublicAuthRoute =
      url.includes('/api/auth/send-otp') ||
      url.includes('/api/auth/verify-otp') ||
      url.includes('/api/auth/refresh');
    const isCompleteRegistrationRoute = url.includes('/api/auth/complete-registration');
    const regToken = getRegistrationTokenFn ? getRegistrationTokenFn() : null;

    if (isPublicAuthRoute) {
      if (config.headers) {
        delete config.headers.Authorization;
      }
      return config;
    }

    // Registration token is ONLY ever allowed on POST /api/auth/complete-registration
    if (isCompleteRegistrationRoute) {
      if (regToken && config.headers && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${regToken}`;
      }
      return config;
    }

    // For all other routes, never attach the registrationToken
    if (regToken && config.headers?.Authorization === `Bearer ${regToken}`) {
      delete config.headers.Authorization;
    }

    const token = await getAccessToken();
    if (token && token !== regToken && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers) {
      delete config.headers.Authorization;
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

    // Auth endpoints should never trigger automatic navigation or token refresh
    const isAuthRoute =
      url.includes('/api/auth/send-otp') ||
      url.includes('/api/auth/verify-otp') ||
      url.includes('/api/auth/complete-registration') ||
      url.includes('/api/auth/refresh');

    // Log the error to console in development only (excluding member/auth PII data)
    if (__DEV__) {
      console.error(
        `[API Error] Status: ${status ?? 'NO_RESPONSE'} | URL: ${url}`,
        {
          status,
          url,
          responseBody: isSensitiveUrl(url) ? '[REDACTED_SENSITIVE_DATA]' : body,
          message: axErr.message,
        }
      );
    }

    // ── Redirect on subscription expiry (402 / 403 SUBSCRIPTION_EXPIRED) ─────
    if (
      !isAuthRoute &&
      (status === 402 || status === 403) &&
      (errorCode === 'SUBSCRIPTION_EXPIRED' || errorCode === 'GYM_TRIAL_EXPIRED')
    ) {
      router.replace('/(tabs)/more/subscription');
      return Promise.reject(error);
    }

    // ── Token refresh on 401 or unauthenticated 403 ─────────────────────────
    const isUnauthenticated =
      status === 401 ||
      (status === 403 && (
        errorCode === 'UNAUTHORIZED' ||
        errorCode === 'ACCESS_DENIED' ||
        errorCode === 'TOKEN_EXPIRED' ||
        errorCode === 'INVALID_TOKEN' ||
        url.includes('/api/auth/me') ||
        (!errorCode && (!body || body === ''))
      ));

    if (
      isUnauthenticated &&
      !originalRequest?._retry &&
      !isAuthRoute &&
      errorCode !== 'INVALID_CREDENTIALS' &&
      errorCode !== 'INVALID_OTP'
    ) {
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
        if (onSessionExpiredFn) {
          try {
            await onSessionExpiredFn();
          } catch {
            // ignore
          }
        }
        router.replace('/(auth)/login');
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
