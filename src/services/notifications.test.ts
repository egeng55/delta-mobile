import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: {
    MAX: 'max',
    HIGH: 'high',
  },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    DATE: 'date',
  },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  addNotificationResponseReceivedListener: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
}));

import {
  NOTIFICATION_SETTINGS_LEGACY_KEY,
  NOTIFICATION_SETTINGS_SECURE_KEY,
  getSettings,
  normalizeNotificationSettings,
  saveSettings,
} from './notifications';
import { getSensitiveJson } from './storage/sensitiveStorage';

type SecureStoreMock = typeof SecureStore & {
  __clearStore: () => void;
  setItemAsync: jest.Mock;
  getItemAsync: jest.Mock;
};

const secureStore = SecureStore as SecureStoreMock;
const notifications = Notifications as typeof Notifications & {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  cancelAllScheduledNotificationsAsync: jest.Mock;
};

const defaults = {
  enabled: true,
  dailyReminder: false,
  dailyReminderTime: '09:00',
  workoutReminders: true,
  periodReminders: true,
};

describe('notification preference storage', () => {
  beforeEach(async () => {
    secureStore.__clearStore();
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('returns defaults without requesting permissions or sending notifications', async () => {
    await expect(getSettings()).resolves.toEqual(defaults);

    expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('migrates legacy AsyncStorage settings to SecureStore', async () => {
    const legacySettings = {
      enabled: false,
      dailyReminder: true,
      dailyReminderTime: '20:30',
      workoutReminders: false,
      periodReminders: false,
    };
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_LEGACY_KEY, JSON.stringify(legacySettings));

    await expect(getSettings()).resolves.toEqual(legacySettings);
    await expect(getSensitiveJson(NOTIFICATION_SETTINGS_SECURE_KEY)).resolves.toEqual(legacySettings);
    await expect(AsyncStorage.getItem(NOTIFICATION_SETTINGS_LEGACY_KEY)).resolves.toBeNull();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('keeps the legacy value if SecureStore migration fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const legacySettings = {
      ...defaults,
      dailyReminderTime: '07:45',
    };
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_LEGACY_KEY, JSON.stringify(legacySettings));
    secureStore.setItemAsync.mockRejectedValueOnce(new Error('secure write failed'));

    await expect(getSettings()).resolves.toEqual(legacySettings);
    await expect(getSensitiveJson(NOTIFICATION_SETTINGS_SECURE_KEY)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(NOTIFICATION_SETTINGS_LEGACY_KEY)).resolves.toBe(JSON.stringify(legacySettings));

    warnSpy.mockRestore();
  });

  it('stores small notification preferences in SecureStore and removes legacy storage', async () => {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_LEGACY_KEY, JSON.stringify({ enabled: true }));

    const updated = await saveSettings({
      enabled: false,
      dailyReminder: false,
      periodReminders: false,
    });

    expect(updated).toEqual({
      ...defaults,
      enabled: false,
      periodReminders: false,
    });
    await expect(getSensitiveJson(NOTIFICATION_SETTINGS_SECURE_KEY)).resolves.toEqual(updated);
    await expect(AsyncStorage.getItem(NOTIFICATION_SETTINGS_LEGACY_KEY)).resolves.toBeNull();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cleans malformed secure or legacy settings safely', async () => {
    await SecureStore.setItemAsync(NOTIFICATION_SETTINGS_SECURE_KEY, '{not-json');
    await expect(getSettings()).resolves.toEqual(defaults);
    await expect(SecureStore.getItemAsync(NOTIFICATION_SETTINGS_SECURE_KEY)).resolves.toBeNull();

    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_LEGACY_KEY, '{not-json');
    await expect(getSettings()).resolves.toEqual(defaults);
    await expect(AsyncStorage.getItem(NOTIFICATION_SETTINGS_LEGACY_KEY)).resolves.toBeNull();
  });

  it('normalizes malformed preference fields and drops extras', () => {
    expect(normalizeNotificationSettings({
      enabled: 'yes',
      dailyReminder: true,
      dailyReminderTime: 'bad-time',
      workoutReminders: false,
      periodReminders: 'true',
      pushToken: 'should-not-persist',
    })).toEqual({
      ...defaults,
      dailyReminder: true,
      workoutReminders: false,
    });
  });
});
