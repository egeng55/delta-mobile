/**
 * Notification Service - Handles local push notifications.
 *
 * Features:
 * - Daily check-in reminders
 * - Workout reminders
 * - Period tracking reminders
 * - Custom scheduled notifications
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const PUSH_TOKEN_KEY = 'expo_push_token';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationSettings {
  enabled: boolean;
  dailyReminder: boolean;
  dailyReminderTime: string; // HH:mm format
  workoutReminders: boolean;
  periodReminders: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  dailyReminder: false,
  dailyReminderTime: '09:00',
  workoutReminders: true,
  periodReminders: true,
};

/**
 * Request notification permissions.
 */
export async function requestPermissions(): Promise<boolean> {
  if (Device.isDevice !== true) {
    console.log('Notifications only work on physical devices');
    return false;
  }

  const existingPermissions = await Notifications.getPermissionsAsync() as any;
  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted') {
    const newPermissions = await Notifications.requestPermissionsAsync() as any;
    finalStatus = newPermissions.status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push notification permissions');
    return false;
  }

  // Android requires a channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });

    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });
  }

  return true;
}

/**
 * Get notification settings.
 */
export async function getSettings(): Promise<NotificationSettings> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored !== null) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Return defaults
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save notification settings.
 */
export async function saveSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  try {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));

    // Update scheduled notifications based on new settings
    if (updated.dailyReminder === true) {
      await scheduleDailyReminder(updated.dailyReminderTime);
    } else {
      await cancelDailyReminder();
    }
  } catch {
    // Silent fail
  }
  return updated;
}

/**
 * Schedule a daily check-in reminder.
 */
export async function scheduleDailyReminder(time: string = '09:00'): Promise<string | null> {
  const hasPermission = await requestPermissions();
  if (hasPermission !== true) return null;

  // Cancel existing daily reminder
  await cancelDailyReminder();

  const [hours, minutes] = time.split(':').map(Number);

  const trigger: Notifications.NotificationTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: hours,
    minute: minutes,
  };

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Check in with Delta',
        body: 'How are you feeling today? Log your wellness to track your progress.',
        data: { type: 'daily_reminder' },
        sound: 'default',
      },
      trigger,
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Cancel daily reminder.
 */
export async function cancelDailyReminder(): Promise<void> {
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of notifications) {
    if (notification.content.data?.type === 'daily_reminder') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

/**
 * Schedule a workout reminder.
 */
export async function scheduleWorkoutReminder(
  workoutName: string,
  scheduledTime: Date
): Promise<string | null> {
  const hasPermission = await requestPermissions();
  if (hasPermission !== true) return null;

  // Schedule 30 minutes before workout
  const reminderTime = new Date(scheduledTime.getTime() - 30 * 60 * 1000);

  if (reminderTime.getTime() <= Date.now()) {
    return null; // Don't schedule if time has passed
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Workout Reminder',
        body: `${workoutName} is scheduled in 30 minutes. Get ready!`,
        data: { type: 'workout_reminder', workoutName },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Schedule a period reminder.
 */
export async function schedulePeriodReminder(
  expectedDate: Date,
  daysBefore: number = 2
): Promise<string | null> {
  const hasPermission = await requestPermissions();
  if (hasPermission !== true) return null;

  // Schedule reminder days before expected period
  const reminderTime = new Date(expectedDate);
  reminderTime.setDate(reminderTime.getDate() - daysBefore);
  reminderTime.setHours(9, 0, 0, 0);

  if (reminderTime.getTime() <= Date.now()) {
    return null; // Don't schedule if time has passed
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Period Reminder',
        body: `Your period is expected in ${daysBefore} days. Stay prepared!`,
        data: { type: 'period_reminder', expectedDate: expectedDate.toISOString() },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Cancel a specific notification.
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Silent fail
  }
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Silent fail
  }
}

/**
 * Get all scheduled notifications.
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}

/**
 * Send an immediate local notification.
 */
export async function sendImmediateNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string | null> {
  const hasPermission = await requestPermissions();
  if (hasPermission !== true) return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: 'default',
      },
      trigger: null, // Immediate
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Add notification response listener.
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener.
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}
