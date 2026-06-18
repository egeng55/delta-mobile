import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { MenstrualSettings } from './api';
import { createSensitiveKey, getSensitiveJson } from './storage/sensitiveStorage';
import { getSettings, updateSettings } from './menstrualTracking';

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

type SecureStoreMock = typeof SecureStore & {
  __clearStore: () => void;
  setItemAsync: jest.Mock;
};

const secureStore = SecureStore as SecureStoreMock;
const fromMock = supabase.from as jest.Mock;

const userId = 'user-123';
const legacyKey = `menstrual_settings_${userId}`;
const secureKey = createSensitiveKey('menstrual_settings', userId);

const cachedSettings: MenstrualSettings = {
  user_id: userId,
  tracking_enabled: true,
  average_cycle_length: 29,
  average_period_length: 4,
  last_period_start: '2026-06-01',
  notifications_enabled: true,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-02T00:00:00.000Z',
};

function mockNoRemoteSettings(): void {
  const maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  fromMock.mockReturnValue({ select });
}

function mockRemoteUpdate(data: MenstrualSettings): void {
  const single = jest.fn(() => Promise.resolve({ data, error: null }));
  const select = jest.fn(() => ({ single }));
  const upsert = jest.fn(() => ({ select }));
  fromMock.mockReturnValue({ upsert });
}

describe('menstrualTracking sensitive settings storage', () => {
  beforeEach(async () => {
    secureStore.__clearStore();
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('loads legacy AsyncStorage settings and migrates them to SecureStore', async () => {
    mockNoRemoteSettings();
    await AsyncStorage.setItem(legacyKey, JSON.stringify(cachedSettings));

    const settings = await getSettings(userId);

    expect(settings).toEqual(cachedSettings);
    await expect(getSensitiveJson<MenstrualSettings>(secureKey)).resolves.toEqual(cachedSettings);
    await expect(AsyncStorage.getItem(legacyKey)).resolves.toBeNull();
  });

  it('keeps legacy AsyncStorage settings if SecureStore migration fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockNoRemoteSettings();
    await AsyncStorage.setItem(legacyKey, JSON.stringify(cachedSettings));
    secureStore.setItemAsync.mockRejectedValueOnce(new Error('secure write failed'));

    const settings = await getSettings(userId);

    expect(settings).toEqual(cachedSettings);
    await expect(getSensitiveJson<MenstrualSettings>(secureKey)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(legacyKey)).resolves.toBe(JSON.stringify(cachedSettings));

    warnSpy.mockRestore();
  });

  it('caches updated menstrual settings in SecureStore', async () => {
    const updatedSettings: MenstrualSettings = {
      ...cachedSettings,
      tracking_enabled: false,
      updated_at: '2026-06-03T00:00:00.000Z',
    };
    mockRemoteUpdate(updatedSettings);

    const settings = await updateSettings(userId, { tracking_enabled: false });

    expect(settings).toEqual(updatedSettings);
    await expect(getSensitiveJson<MenstrualSettings>(secureKey)).resolves.toEqual(updatedSettings);
    await expect(AsyncStorage.getItem(legacyKey)).resolves.toBeNull();
  });
});
