import { router } from 'expo-router';

/**
 * Safely navigates back if there is a history stack to pop.
 * If cannot go back (e.g. opened directly or deep-linked), navigates to the fallback route.
 * Prevents "The action 'GO_BACK' was not handled by any navigator" errors.
 */
export function safeBack(fallbackRoute: string = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackRoute as any);
  }
}
