import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addToPendingSync,
  cacheData,
  getCachedData,
  getPendingSync,
  removeFromPendingSync,
} from './offlineCache';
import {
  PENDING_SYNC_STORAGE_KEY,
  PENDING_SYNC_TTL_MS,
} from './storage/pendingSyncStorage';
import {
  OFFLINE_HEALTH_CACHE_TTLS_MS,
  offlineHealthCacheStorageKey,
} from './storage/offlineHealthCacheStorage';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

describe('offlineCache health cache storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('stores generic health cache data through the TTL/minimization helper', async () => {
    await cacheData('insights', {
      wellness_score: 82,
      Authorization: 'Bearer secret',
      nested: { refresh_token: 'secret', kept: true },
    }, 'user-1');

    const raw = await AsyncStorage.getItem(offlineHealthCacheStorageKey('insights', 'user-1'));
    const parsed = JSON.parse(raw ?? '{}');
    const cached = await getCachedData<{ wellness_score: number; nested: { kept: boolean } }>('insights', 'user-1');

    expect(parsed.kind).toBe('offline_health_cache');
    expect(parsed.ttlMs).toBe(OFFLINE_HEALTH_CACHE_TTLS_MS.insights);
    expect(JSON.stringify(parsed)).not.toContain('Bearer secret');
    expect(JSON.stringify(parsed)).not.toContain('refresh_token');
    expect(cached).toEqual({
      wellness_score: 82,
      nested: { kept: true },
    });
  });

  it('reads legacy generic cache data and rewrites it into the current envelope', async () => {
    const key = offlineHealthCacheStorageKey('workout', 'user-1');
    await AsyncStorage.setItem(key, JSON.stringify({
      data: { workout: { title: 'Easy run' } },
      timestamp: Date.now(),
      expiresAt: Date.now() + OFFLINE_HEALTH_CACHE_TTLS_MS.workout,
    }));

    await expect(getCachedData('workout', 'user-1')).resolves.toEqual({
      workout: { title: 'Easy run' },
    });
    const rewritten = JSON.parse(await AsyncStorage.getItem(key) ?? '{}');
    expect(rewritten.kind).toBe('offline_health_cache');
  });

  it('drops malformed generic cache data safely', async () => {
    const key = offlineHealthCacheStorageKey('calendar', 'user-1');
    await AsyncStorage.setItem(key, '{not-json');

    await expect(getCachedData('calendar', 'user-1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem(key)).resolves.toBeNull();
  });

  it('stores pending sync items through the TTL policy helper', async () => {
    await addToPendingSync('tracking', {
      _endpoint: '/track/water',
      amount: 12,
      Authorization: 'Bearer secret',
    });

    const raw = await AsyncStorage.getItem(PENDING_SYNC_STORAGE_KEY);
    const parsed = JSON.parse(raw ?? '{}');
    const pending = await getPendingSync();

    expect(parsed.kind).toBe('pending_sync_queue');
    expect(parsed.items[0].expiresAt - parsed.items[0].createdAt).toBe(PENDING_SYNC_TTL_MS);
    expect(JSON.stringify(parsed)).not.toContain('Bearer secret');
    expect(pending).toHaveLength(1);
    expect(pending[0].data).toEqual({
      _endpoint: '/track/water',
      amount: 12,
    });
  });

  it('removes synced pending items through the policy helper', async () => {
    await addToPendingSync('tracking', { item: 1 });
    await addToPendingSync('tracking', { item: 2 });
    const [first] = await getPendingSync();

    await removeFromPendingSync(first.id);

    const remaining = await getPendingSync();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].data).toEqual({ item: 2 });
  });
});
