import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Returns time-of-day greeting based on device local hour (0-23):
 * - 05:00 to 11:59: "Good morning"
 * - 12:00 to 16:59: "Good afternoon"
 * - 17:00 to 20:59: "Good evening"
 * - 21:00 to 04:59: "Hello"
 *
 * Never parses 12-hour strings and never uses UTC.
 */
export function getGreetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  }
  if (hour >= 17 && hour < 21) {
    return 'Good evening';
  }
  return 'Hello';
}

export function getGreetingForDate(date: Date = new Date()): string {
  return getGreetingForHour(date.getHours());
}

/**
 * Hook that returns the greeting for the current local time of day.
 * Recomputed:
 * 1. On screen mount
 * 2. On AppState becoming active
 * 3. Every 60 seconds (1 minute) while mounted
 */
export function useGreeting(): string {
  const [greeting, setGreeting] = useState<string>(() => getGreetingForDate());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshGreeting = useCallback(() => {
    const current = getGreetingForDate();
    setGreeting((prev) => (prev !== current ? current : prev));
  }, []);

  useEffect(() => {
    refreshGreeting();

    // 1. AppState listener: update when app comes to foreground
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshGreeting();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // 2. Timer: recompute every minute (60,000 ms) while mounted
    timerRef.current = setInterval(refreshGreeting, 60000);

    return () => {
      subscription.remove();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [refreshGreeting]);

  return greeting;
}
