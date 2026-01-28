/**
 * useDayChange - Detects when the calendar day changes
 *
 * Triggers callback when:
 * 1. App returns from background and day has changed
 * 2. Midnight passes while app is in foreground
 *
 * Usage:
 *   useDayChange(() => {
 *     // Refresh data for new day
 *     fetchAnalyticsData(true);
 *   });
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Get today's date as YYYY-MM-DD string in local timezone
 */
const getTodayString = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

/**
 * Calculate milliseconds until next midnight
 */
const msUntilMidnight = (): number => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // Next midnight
  return midnight.getTime() - now.getTime();
};

export function useDayChange(onDayChange: () => void): void {
  const lastDateRef = useRef<string>(getTodayString());
  const midnightTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if day has changed and trigger callback
  const checkDayChange = useCallback(() => {
    const currentDate = getTodayString();
    if (currentDate !== lastDateRef.current) {
      console.log(`[DAY_CHANGE] Day changed: ${lastDateRef.current} → ${currentDate}`);
      lastDateRef.current = currentDate;
      onDayChange();
    }
  }, [onDayChange]);

  // Schedule timer for midnight
  const scheduleMidnightCheck = useCallback(() => {
    // Clear any existing timer
    if (midnightTimerRef.current) {
      clearTimeout(midnightTimerRef.current);
    }

    const ms = msUntilMidnight();
    console.log(`[DAY_CHANGE] Scheduling midnight check in ${Math.round(ms / 1000 / 60)} minutes`);

    midnightTimerRef.current = setTimeout(() => {
      checkDayChange();
      // Schedule next midnight check
      scheduleMidnightCheck();
    }, ms + 1000); // Add 1 second buffer
  }, [checkDayChange]);

  // Handle app state changes (background → foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App became active - check if day changed while in background
        checkDayChange();
        // Reschedule midnight timer
        scheduleMidnightCheck();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initial midnight timer
    scheduleMidnightCheck();

    return () => {
      subscription.remove();
      if (midnightTimerRef.current) {
        clearTimeout(midnightTimerRef.current);
      }
    };
  }, [checkDayChange, scheduleMidnightCheck]);
}

export default useDayChange;
