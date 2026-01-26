/**
 * HealthKitContext - Manages Apple Watch/HealthKit integration state
 *
 * Provides:
 * - Authorization status
 * - Health data (sleep, HRV, heart rate, steps, calories burned)
 * - Toggle to enable/disable sync
 * - Last sync timestamp
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import healthKitService, { SleepSummary, HRVReading, RestingHeartRateReading } from '../services/healthKit';
import healthSyncService from '../services/healthSync';
import { useAuth } from './AuthContext';

const HEALTHKIT_ENABLED_KEY = '@delta_healthkit_enabled';

interface HealthData {
  sleep: SleepSummary | null;
  sleepQuality: number;
  hrv: HRVReading | null;
  restingHeartRate: RestingHeartRateReading | null;
  steps: number;
  activeCalories: number;
  lastUpdated: Date | null;
}

interface HealthKitContextType {
  // Status
  isAvailable: boolean;
  isAuthorized: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  lastSyncTime: Date | null;

  // Health data
  healthData: HealthData;
  hasWatchData: boolean;

  // Actions
  requestAuthorization: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  refreshHealthData: () => Promise<void>;
}

const defaultHealthData: HealthData = {
  sleep: null,
  sleepQuality: 0,
  hrv: null,
  restingHeartRate: null,
  steps: 0,
  activeCalories: 0,
  lastUpdated: null,
};

const HealthKitContext = createContext<HealthKitContextType | undefined>(undefined);

export function HealthKitProvider({ children }: { children: ReactNode }): React.ReactElement {
  const { user } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isEnabled, setIsEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [healthData, setHealthData] = useState<HealthData>(defaultHealthData);

  const isAvailable = Platform.OS === 'ios' && healthKitService.isHealthKitAvailable();

  // Check if we have meaningful watch data
  const hasWatchData = isEnabled && isAuthorized && (
    healthData.sleep !== null ||
    healthData.hrv !== null ||
    healthData.restingHeartRate !== null ||
    healthData.steps > 0 ||
    healthData.activeCalories > 0
  );

  // Load saved enabled state on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const [enabledStr, authorized] = await Promise.all([
          AsyncStorage.getItem(HEALTHKIT_ENABLED_KEY),
          isAvailable ? healthKitService.isAuthorized() : Promise.resolve(false),
        ]);

        setIsEnabledState(enabledStr === 'true');
        setIsAuthorized(authorized);

        const syncTime = await healthSyncService.getLastSyncTime();
        setLastSyncTime(syncTime);
      } catch (e) {
        console.log('[HealthKit] Error loading state:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadState();
  }, [isAvailable]);

  // Fetch health data when enabled and authorized
  useEffect(() => {
    if (isEnabled && isAuthorized && !isLoading) {
      refreshHealthData();
    }
  }, [isEnabled, isAuthorized, isLoading]);

  // Auto-sync when enabled
  useEffect(() => {
    if (isEnabled && isAuthorized && user?.id) {
      const checkAndSync = async () => {
        const shouldSync = await healthSyncService.shouldSync();
        if (shouldSync) {
          await healthSyncService.syncHealthData(user.id);
          const syncTime = await healthSyncService.getLastSyncTime();
          setLastSyncTime(syncTime);
        }
      };
      checkAndSync();
    }
  }, [isEnabled, isAuthorized, user?.id]);

  const requestAuthorization = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;

    try {
      const authorized = await healthKitService.requestAuthorization();
      setIsAuthorized(authorized);
      return authorized;
    } catch (e) {
      console.log('[HealthKit] Authorization error:', e);
      return false;
    }
  }, [isAvailable]);

  const setEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    setIsEnabledState(enabled);
    await AsyncStorage.setItem(HEALTHKIT_ENABLED_KEY, enabled.toString());

    if (enabled && !isAuthorized) {
      await requestAuthorization();
    }

    if (enabled && isAuthorized) {
      await refreshHealthData();
    }
  }, [isAuthorized, requestAuthorization]);

  const syncNow = useCallback(async (): Promise<void> => {
    if (!user?.id || !isAuthorized) return;

    setIsLoading(true);
    try {
      await healthSyncService.forceSyncHealthData(user.id);
      const syncTime = await healthSyncService.getLastSyncTime();
      setLastSyncTime(syncTime);
      await refreshHealthData();
    } catch (e) {
      console.log('[HealthKit] Sync error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isAuthorized]);

  const refreshHealthData = useCallback(async (): Promise<void> => {
    if (!isAvailable || !isAuthorized) return;

    try {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const [sleep, hrvReadings, hrReadings, steps] = await Promise.all([
        healthKitService.getSleepSummary(today),
        healthKitService.getHRV(yesterday, today),
        healthKitService.getRestingHeartRate(yesterday, today),
        healthKitService.getStepCount(today),
      ]);

      const sleepQuality = sleep ? healthKitService.calculateSleepQuality(sleep) : 0;

      setHealthData({
        sleep,
        sleepQuality,
        hrv: hrvReadings.length > 0 ? hrvReadings[0] : null,
        restingHeartRate: hrReadings.length > 0 ? hrReadings[0] : null,
        steps,
        activeCalories: 0, // TODO: Add active calories when available
        lastUpdated: new Date(),
      });
    } catch (e) {
      console.log('[HealthKit] Refresh error:', e);
    }
  }, [isAvailable, isAuthorized]);

  return (
    <HealthKitContext.Provider
      value={{
        isAvailable,
        isAuthorized,
        isEnabled,
        isLoading,
        lastSyncTime,
        healthData,
        hasWatchData,
        requestAuthorization,
        setEnabled,
        syncNow,
        refreshHealthData,
      }}
    >
      {children}
    </HealthKitContext.Provider>
  );
}

export function useHealthKit(): HealthKitContextType {
  const context = useContext(HealthKitContext);
  if (context === undefined) {
    throw new Error('useHealthKit must be used within a HealthKitProvider');
  }
  return context;
}

export default HealthKitContext;
