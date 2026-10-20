/**
 * Utility helper to determine whether the Dev OTP autofill chip should be rendered.
 * It must only be rendered in development mode (__DEV__ === true).
 */
export function shouldRenderDevOtp(isDev: boolean): boolean {
  return Boolean(isDev);
}
