import { NativeModules, Platform } from 'react-native';

const { HealthKitModule } = NativeModules;

export interface SleepSummary {
  date: string;
  totalSleepHours: number;
  totalInBedHours: number;
  deepSleepHours: number;
  remSleepHours: number;
  coreSleepHours: number;
  sleepEfficiency: number;
  bedTime: string | null;
  wakeTime: string | null;
  hasData: boolean;
}

export interface SleepSession {
  startDate: string;
  endDate: string;
  durationSeconds: number;
  durationHours: number;
  stage: 'inBed' | 'core' | 'deep' | 'rem' | 'asleep';
  source: string;
}

export interface HRVReading {
  date: string;
  hrvMs: number;
  source: string;
}

export interface RestingHeartRateReading {
  date: string;
  bpm: number;
  source: string;
}

export interface HealthSummary {
  date: string;
  hasHealthKitAccess: boolean;
  sleep?: SleepSummary;
  steps?: number;
  latestHRV?: HRVReading;
  latestRestingHeartRate?: RestingHeartRateReading;
}

class HealthKitService {
  private isAvailable: boolean;

  constructor() {
    this.isAvailable = Platform.OS === 'ios' && !!HealthKitModule;
  }

  /**
   * Check if HealthKit is available on this device
   */
  isHealthKitAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Request authorization to read health data
   */
  async requestAuthorization(): Promise<boolean> {
    if (!this.isAvailable) {
      console.log('HealthKit not available on this platform');
      return false;
    }

    try {
      const result = await HealthKitModule.requestAuthorization();
      return result.authorized ?? false;
    } catch (error) {
      console.error('HealthKit authorization error:', error);
      return false;
    }
  }

  /**
   * Check if HealthKit is authorized
   */
  async isAuthorized(): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const result = await HealthKitModule.isAuthorized();
      return result.authorized ?? false;
    } catch (error) {
      console.error('HealthKit authorization check error:', error);
      return false;
    }
  }

  /**
   * Get sleep data for a date range
   */
  async getSleepData(startDate: Date, endDate: Date): Promise<SleepSession[]> {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const result = await HealthKitModule.getSleepData(
        startDate.toISOString(),
        endDate.toISOString()
      );
      return result.sleepSessions ?? [];
    } catch (error) {
      console.error('HealthKit getSleepData error:', error);
      return [];
    }
  }

  /**
   * Get aggregated sleep summary for a specific date
   */
  async getSleepSummary(date: Date): Promise<SleepSummary | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      // Format as YYYY-MM-DD for the native module
      const dateString = date.toISOString().split('T')[0];
      const result = await HealthKitModule.getSleepSummary(dateString);

      if (!result.hasData) {
        return null;
      }

      return result as SleepSummary;
    } catch (error) {
      console.error('HealthKit getSleepSummary error:', error);
      return null;
    }
  }

  /**
   * Get HRV readings for a date range
   */
  async getHRV(startDate: Date, endDate: Date): Promise<HRVReading[]> {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const result = await HealthKitModule.getHRV(
        startDate.toISOString(),
        endDate.toISOString()
      );
      return result.readings ?? [];
    } catch (error) {
      console.error('HealthKit getHRV error:', error);
      return [];
    }
  }

  /**
   * Get resting heart rate readings for a date range
   */
  async getRestingHeartRate(startDate: Date, endDate: Date): Promise<RestingHeartRateReading[]> {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const result = await HealthKitModule.getRestingHeartRate(
        startDate.toISOString(),
        endDate.toISOString()
      );
      return result.readings ?? [];
    } catch (error) {
      console.error('HealthKit getRestingHeartRate error:', error);
      return [];
    }
  }

  /**
   * Get step count for a specific date
   */
  async getStepCount(date: Date): Promise<number> {
    if (!this.isAvailable) {
      return 0;
    }

    try {
      const dateString = date.toISOString().split('T')[0];
      const result = await HealthKitModule.getStepCount(dateString);
      return result.steps ?? 0;
    } catch (error) {
      console.error('HealthKit getStepCount error:', error);
      return 0;
    }
  }

  /**
   * Get a combined health summary for today
   */
  async getTodayHealthSummary(): Promise<HealthSummary | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const result = await HealthKitModule.getTodayHealthSummary();
      return result as HealthSummary;
    } catch (error) {
      console.error('HealthKit getTodayHealthSummary error:', error);
      return null;
    }
  }

  /**
   * Get sleep quality score (0-100) based on sleep metrics
   * This is a derived metric combining duration, efficiency, and stage distribution
   */
  calculateSleepQuality(summary: SleepSummary): number {
    if (!summary.hasData || summary.totalSleepHours === 0) {
      return 0;
    }

    let score = 0;

    // Duration score (0-40 points)
    // Optimal is 7-9 hours
    const durationHours = summary.totalSleepHours;
    if (durationHours >= 7 && durationHours <= 9) {
      score += 40;
    } else if (durationHours >= 6 && durationHours < 7) {
      score += 30;
    } else if (durationHours > 9 && durationHours <= 10) {
      score += 35;
    } else if (durationHours >= 5 && durationHours < 6) {
      score += 20;
    } else if (durationHours > 10) {
      score += 25;
    } else {
      score += Math.max(0, durationHours * 4);
    }

    // Sleep efficiency score (0-30 points)
    // Good efficiency is > 85%
    const efficiency = summary.sleepEfficiency;
    if (efficiency >= 90) {
      score += 30;
    } else if (efficiency >= 85) {
      score += 25;
    } else if (efficiency >= 80) {
      score += 20;
    } else if (efficiency >= 70) {
      score += 15;
    } else {
      score += Math.max(0, efficiency * 0.2);
    }

    // Deep sleep score (0-15 points)
    // Optimal is 15-20% of total sleep
    const deepPercent = (summary.deepSleepHours / summary.totalSleepHours) * 100;
    if (deepPercent >= 15 && deepPercent <= 25) {
      score += 15;
    } else if (deepPercent >= 10 && deepPercent < 15) {
      score += 10;
    } else if (deepPercent > 25 && deepPercent <= 30) {
      score += 12;
    } else {
      score += Math.max(0, deepPercent * 0.5);
    }

    // REM sleep score (0-15 points)
    // Optimal is 20-25% of total sleep
    const remPercent = (summary.remSleepHours / summary.totalSleepHours) * 100;
    if (remPercent >= 20 && remPercent <= 25) {
      score += 15;
    } else if (remPercent >= 15 && remPercent < 20) {
      score += 10;
    } else if (remPercent > 25 && remPercent <= 30) {
      score += 12;
    } else {
      score += Math.max(0, remPercent * 0.5);
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Get HRV quality assessment
   * HRV varies widely by individual, age, and fitness level
   */
  assessHRV(hrvMs: number, age?: number): 'low' | 'normal' | 'good' | 'excellent' {
    // General population averages (adjusted by age if provided)
    let baseline = 50;
    if (age) {
      if (age < 25) baseline = 60;
      else if (age < 35) baseline = 55;
      else if (age < 45) baseline = 45;
      else if (age < 55) baseline = 35;
      else baseline = 30;
    }

    if (hrvMs >= baseline * 1.5) return 'excellent';
    if (hrvMs >= baseline * 1.1) return 'good';
    if (hrvMs >= baseline * 0.7) return 'normal';
    return 'low';
  }

  /**
   * Get resting heart rate assessment
   */
  assessRestingHeartRate(bpm: number): 'athletic' | 'excellent' | 'good' | 'average' | 'elevated' {
    if (bpm < 50) return 'athletic';
    if (bpm < 60) return 'excellent';
    if (bpm < 70) return 'good';
    if (bpm < 80) return 'average';
    return 'elevated';
  }
}

export const healthKitService = new HealthKitService();
export default healthKitService;
