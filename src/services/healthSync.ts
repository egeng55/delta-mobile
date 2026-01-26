/**
 * Health Data Sync Service
 *
 * Syncs HealthKit data (Apple Watch) to the Delta backend for
 * cross-domain reasoning and insights.
 *
 * Data flow:
 * Apple Watch → iPhone HealthKit → This service → Backend API → Supabase
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import healthKitService, { SleepSummary, HRVReading, RestingHeartRateReading } from './healthKit';
import { API_BASE_URL } from '../config/constants';

const LAST_SYNC_KEY = '@delta_health_last_sync';
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface BiometricSyncPayload {
  user_id: string;
  date: string;
  source: 'healthkit' | 'manual';
  sleep?: {
    hours: number;
    quality: number; // 1-5 derived from sleep quality score
    bed_time: string | null;
    wake_time: string | null;
    deep_hours: number;
    rem_hours: number;
    efficiency: number;
  };
  hrv?: {
    value_ms: number;
    timestamp: string;
  };
  resting_hr?: {
    bpm: number;
    timestamp: string;
  };
  steps?: number;
}

class HealthSyncService {
  private isSyncing = false;

  /**
   * Check if we should sync (based on last sync time)
   */
  async shouldSync(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;

    try {
      const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (!lastSync) return true;

      const lastSyncTime = parseInt(lastSync, 10);
      return Date.now() - lastSyncTime > SYNC_INTERVAL_MS;
    } catch {
      return true;
    }
  }

  /**
   * Sync HealthKit data to backend
   */
  async syncHealthData(userId: string): Promise<{ synced: boolean; error?: string }> {
    if (Platform.OS !== 'ios') {
      return { synced: false, error: 'HealthKit only available on iOS' };
    }

    if (this.isSyncing) {
      return { synced: false, error: 'Sync already in progress' };
    }

    this.isSyncing = true;

    try {
      // Check authorization
      const authorized = await healthKitService.isAuthorized();
      if (!authorized) {
        return { synced: false, error: 'HealthKit not authorized' };
      }

      // Get today's date and yesterday (for sleep)
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const todayStr = today.toISOString().split('T')[0];

      // Fetch all health data
      const [sleepSummary, hrvReadings, hrReadings, steps] = await Promise.all([
        healthKitService.getSleepSummary(today),
        healthKitService.getHRV(yesterday, today),
        healthKitService.getRestingHeartRate(yesterday, today),
        healthKitService.getStepCount(today),
      ]);

      // Build payload
      const payload: BiometricSyncPayload = {
        user_id: userId,
        date: todayStr,
        source: 'healthkit',
      };

      // Add sleep data if available
      if (sleepSummary?.hasData) {
        const qualityScore = healthKitService.calculateSleepQuality(sleepSummary);
        // Convert 0-100 score to 1-5 rating
        const quality = Math.max(1, Math.min(5, Math.round(qualityScore / 20)));

        payload.sleep = {
          hours: sleepSummary.totalSleepHours,
          quality,
          bed_time: sleepSummary.bedTime,
          wake_time: sleepSummary.wakeTime,
          deep_hours: sleepSummary.deepSleepHours,
          rem_hours: sleepSummary.remSleepHours,
          efficiency: sleepSummary.sleepEfficiency,
        };
      }

      // Add HRV (most recent reading)
      if (hrvReadings.length > 0) {
        const latest = hrvReadings[0];
        payload.hrv = {
          value_ms: latest.hrvMs,
          timestamp: latest.date,
        };
      }

      // Add resting heart rate (most recent reading)
      if (hrReadings.length > 0) {
        const latest = hrReadings[0];
        payload.resting_hr = {
          bpm: latest.bpm,
          timestamp: latest.date,
        };
      }

      // Add steps
      if (steps > 0) {
        payload.steps = steps;
      }

      // Send to backend
      const response = await fetch(`${API_BASE_URL}/health-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        return { synced: false, error };
      }

      // Update last sync time
      await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

      return { synced: true };
    } catch (error) {
      return { synced: false, error: String(error) };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Force immediate sync (ignores interval)
   */
  async forceSyncHealthData(userId: string): Promise<{ synced: boolean; error?: string }> {
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
    return this.syncHealthData(userId);
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<Date | null> {
    try {
      const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (!lastSync) return null;
      return new Date(parseInt(lastSync, 10));
    } catch {
      return null;
    }
  }
}

export const healthSyncService = new HealthSyncService();
export default healthSyncService;
