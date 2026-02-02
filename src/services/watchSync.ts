import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// Types for Watch sync messages
export interface WatchWorkout {
  id: string;
  name: string;
  exercises: WatchExercise[];
  estimatedDuration: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
}

export interface WatchExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  weightUnit?: string;
  isCompleted: boolean;
  completedAt?: string;
}

export interface WatchDailyLog {
  date: string;
  energyLevel?: number;
  stressLevel?: number;
  sleepQuality?: number;
  notes?: string;
  lastUpdated?: string;
}

export interface ComplicationData {
  wellnessScore?: number;
  nextWorkoutName?: string;
  nextWorkoutTime?: string;
  streakDays: number;
  cycleDay?: number;
}

export type WatchMessageType =
  | 'request_sync'
  | 'exercise_completed'
  | 'workout_status_changed'
  | 'voice_log_submitted'
  | 'health_data_captured'
  | 'workout_started_from_watch'
  | 'workout_ended_from_watch';

export interface WatchMessage {
  type: WatchMessageType;
  timestamp: number;
  data: {
    exerciseId?: string;
    workoutId?: string;
    workoutStatus?: string;
    voiceLogText?: string;
    averageHeartRate?: number;
    totalCalories?: number;
    workoutDuration?: number;
  };
}

interface WatchSyncManagerInterface {
  activateSession(): void;
  isWatchPaired(): Promise<boolean>;
  isWatchReachable(): Promise<boolean>;
  sendMessageToWatch(message: Record<string, any>): Promise<{ queued?: boolean }>;
  syncUserAuthenticated(userId: string | null, isAuthenticated: boolean): void;
  syncWorkout(workoutData: WatchWorkout): void;
  syncDailyLog(dailyLogData: WatchDailyLog): void;
  syncWellnessScore(score: number): void;
  syncMenstrualPhase(phase: string | null, cycleDay: number): void;
  notifyWorkoutStarted(workoutId: string): void;
  notifyWorkoutEnded(workoutId: string): void;
  updateComplication(complicationData: ComplicationData): void;
}

// Only available on iOS
const WatchSyncManagerModule: WatchSyncManagerInterface | null =
  Platform.OS === 'ios' ? NativeModules.WatchSyncManager : null;

// Event emitter for watch messages
let eventEmitter: NativeEventEmitter | null = null;

if (WatchSyncManagerModule) {
  eventEmitter = new NativeEventEmitter(NativeModules.WatchSyncManager);
}

// Watch sync service
class WatchSyncService {
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private subscriptions: Array<{ remove: () => void }> = [];
  private isInitialized = false;

  /**
   * Initialize the watch sync service
   */
  initialize(): void {
    if (!WatchSyncManagerModule || this.isInitialized) return;

    WatchSyncManagerModule.activateSession();

    // Set up event listeners
    const sub1 = eventEmitter?.addListener('onWatchMessage', (message: WatchMessage) => {
      this.emit('message', message);
      this.handleWatchMessage(message);
    });
    if (sub1) this.subscriptions.push(sub1);

    const sub2 = eventEmitter?.addListener('onWatchReachabilityChanged', (data: { isReachable: boolean }) => {
      this.emit('reachabilityChanged', data.isReachable);
    });
    if (sub2) this.subscriptions.push(sub2);

    const sub3 = eventEmitter?.addListener('onWatchSessionStateChanged', (data: any) => {
      this.emit('sessionStateChanged', data);
    });
    if (sub3) this.subscriptions.push(sub3);

    this.isInitialized = true;
  }

  /**
   * Clean up all native event listeners
   */
  cleanup(): void {
    this.subscriptions.forEach(sub => sub.remove());
    this.subscriptions = [];
    this.isInitialized = false;
  }

  /**
   * Check if watch is paired
   */
  async isWatchPaired(): Promise<boolean> {
    if (!WatchSyncManagerModule) return false;
    return WatchSyncManagerModule.isWatchPaired();
  }

  /**
   * Check if watch is reachable
   */
  async isWatchReachable(): Promise<boolean> {
    if (!WatchSyncManagerModule) return false;
    return WatchSyncManagerModule.isWatchReachable();
  }

  /**
   * Sync authentication state to watch
   */
  syncAuth(userId: string | null, isAuthenticated: boolean): void {
    if (!WatchSyncManagerModule) return;
    WatchSyncManagerModule.syncUserAuthenticated(userId, isAuthenticated);
  }

  /**
   * Sync today's workout to watch
   */
  syncWorkout(workout: WatchWorkout): void {
    if (!WatchSyncManagerModule) return;
    WatchSyncManagerModule.syncWorkout(workout);
  }

  /**
   * Sync daily log to watch
   */
  syncDailyLog(dailyLog: WatchDailyLog): void {
    if (!WatchSyncManagerModule) return;
    WatchSyncManagerModule.syncDailyLog(dailyLog);
  }

  /**
   * Sync wellness score to watch
   */
  syncWellnessScore(score: number): void {
    if (!WatchSyncManagerModule) return;
    WatchSyncManagerModule.syncWellnessScore(score);
  }

  /**
   * Sync menstrual phase to watch
   */
  syncMenstrualPhase(phase: string | null, cycleDay: number): void {
    if (!WatchSyncManagerModule) return;
    WatchSyncManagerModule.syncMenstrualPhase(phase, cycleDay);
  }

  /**
   * Notify watch that workout started on phone
   */
  notifyWorkoutStarted(workoutId: string): void {
    if (!WatchSyncManagerModule) return;
    WatchSyncManagerModule.notifyWorkoutStarted(workoutId);
  }

  /**
   * Notify watch that workout ended on phone
   */
  notifyWorkoutEnded(workoutId: string): void {
    if (!WatchSyncManagerModule) return;
    WatchSyncManagerModule.notifyWorkoutEnded(workoutId);
  }

  /**
   * Update watch face complication
   */
  updateComplication(data: ComplicationData): void {
    if (!WatchSyncManagerModule) return;
    WatchSyncManagerModule.updateComplication(data);
  }

  /**
   * Send a custom message to watch
   */
  async sendMessage(message: Record<string, any>): Promise<boolean> {
    if (!WatchSyncManagerModule) return false;
    const result = await WatchSyncManagerModule.sendMessageToWatch(message);
    return !result.queued;
  }

  /**
   * Add event listener
   */
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Handle incoming watch messages
   */
  private handleWatchMessage(message: WatchMessage): void {
    switch (message.type) {
      case 'request_sync':
        this.emit('syncRequested', null);
        break;

      case 'exercise_completed':
        this.emit('exerciseCompleted', {
          exerciseId: message.data.exerciseId,
          workoutId: message.data.workoutId,
        });
        break;

      case 'workout_started_from_watch':
        this.emit('workoutStartedFromWatch', {
          workoutId: message.data.workoutId,
        });
        break;

      case 'workout_ended_from_watch':
        this.emit('workoutEndedFromWatch', {
          workoutId: message.data.workoutId,
          healthData: {
            averageHeartRate: message.data.averageHeartRate,
            totalCalories: message.data.totalCalories,
            duration: message.data.workoutDuration,
          },
        });
        break;

      case 'voice_log_submitted':
        this.emit('voiceLogSubmitted', {
          text: message.data.voiceLogText,
        });
        break;

      case 'health_data_captured':
        this.emit('healthDataCaptured', {
          averageHeartRate: message.data.averageHeartRate,
          totalCalories: message.data.totalCalories,
          duration: message.data.workoutDuration,
        });
        break;
    }
  }
}

// Export singleton instance
export const watchSync = new WatchSyncService();

// Export types
export type { WatchSyncService };
