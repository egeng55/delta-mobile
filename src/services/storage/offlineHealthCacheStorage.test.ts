import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OFFLINE_HEALTH_CACHE_SCHEMA_VERSION,
  OFFLINE_HEALTH_CACHE_TTLS_MS,
  offlineHealthCacheStorageKey,
  readOfflineHealthCache,
  sanitizeOfflineHealthCachePayload,
  saveOfflineHealthCache,
} from './offlineHealthCacheStorage';

describe('offlineHealthCacheStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('wraps health cache payloads with TTL metadata and strips token-like fields', async () => {
    await saveOfflineHealthCache('insights', {
      score: 80,
      Authorization: 'Bearer secret',
      nested: {
        access_token: 'secret-access-token',
        value: true,
      },
    }, 'user-1', undefined, 1_000);

    const raw = await AsyncStorage.getItem(offlineHealthCacheStorageKey('insights', 'user-1'));
    const envelope = JSON.parse(raw ?? '{}');

    expect(envelope).toMatchObject({
      schemaVersion: OFFLINE_HEALTH_CACHE_SCHEMA_VERSION,
      kind: 'offline_health_cache',
      resource: 'insights',
      createdAt: 1_000,
      updatedAt: 1_000,
      ttlMs: OFFLINE_HEALTH_CACHE_TTLS_MS.insights,
      expiresAt: 1_000 + OFFLINE_HEALTH_CACHE_TTLS_MS.insights,
      sensitivity: 'high',
    });
    expect(envelope.classification).toEqual(['ttl_needed', 'minimization_needed']);
    expect(envelope.data).toEqual({
      score: 80,
      nested: { value: true },
    });
    expect(JSON.stringify(envelope)).not.toContain('Bearer secret');
    expect(JSON.stringify(envelope)).not.toContain('secret-access-token');
  });

  it('reads valid health cache payloads while they are fresh', async () => {
    await saveOfflineHealthCache('workout', { workout: { title: 'Easy run' } }, 'user-1', undefined, 1_000);

    await expect(readOfflineHealthCache('workout', 'user-1', 2_000)).resolves.toMatchObject({
      status: 'hit',
      data: { workout: { title: 'Easy run' } },
      fromLegacy: false,
    });
  });

  it('drops expired health cache payloads', async () => {
    await saveOfflineHealthCache('derivatives', { days_analyzed: 30 }, 'user-1', undefined, 1_000);

    await expect(readOfflineHealthCache('derivatives', 'user-1', 1_000 + OFFLINE_HEALTH_CACHE_TTLS_MS.derivatives)).resolves.toMatchObject({
      status: 'expired',
      data: null,
      storageCleared: true,
    });
    await expect(AsyncStorage.getItem(offlineHealthCacheStorageKey('derivatives', 'user-1'))).resolves.toBeNull();
  });

  it('handles legacy CachedData format and rewrites it into the envelope', async () => {
    await AsyncStorage.setItem(offlineHealthCacheStorageKey('calendar', 'user-1'), JSON.stringify({
      data: { logs: [{ date: '2026-06-21', meals: 2 }] },
      timestamp: 1_000,
      expiresAt: 1_000 + OFFLINE_HEALTH_CACHE_TTLS_MS.calendar,
    }));

    const result = await readOfflineHealthCache('calendar', 'user-1', 2_000);
    const raw = await AsyncStorage.getItem(offlineHealthCacheStorageKey('calendar', 'user-1'));
    const rewritten = JSON.parse(raw ?? '{}');

    expect(result).toMatchObject({
      status: 'legacy',
      fromLegacy: true,
      data: { logs: [{ date: '2026-06-21', meals: 2 }] },
    });
    expect(rewritten.kind).toBe('offline_health_cache');
    expect(rewritten.resource).toBe('calendar');
  });

  it('handles legacy raw object and array cache values', async () => {
    await AsyncStorage.setItem(offlineHealthCacheStorageKey('menstrual', 'user-1'), JSON.stringify([
      { date: '2026-06-01', event_type: 'period_start' },
    ]));

    const result = await readOfflineHealthCache('menstrual', 'user-1', 2_000);

    expect(result).toMatchObject({
      status: 'legacy',
      fromLegacy: true,
      data: [{ date: '2026-06-01', event_type: 'period_start' }],
    });
  });

  it('strips raw image/blob-like payload fields and trims large arrays conservatively', () => {
    const sanitized = sanitizeOfflineHealthCachePayload({
      items: Array.from({ length: 120 }, (_, index) => ({ index })),
      imageBase64: 'data:image/png;base64,abc123',
      nested: {
        rawPhoto: 'data:image/png;base64,abc123',
        keep: 'ok',
      },
    }, 50);

    expect((sanitized as { items: unknown[] }).items).toHaveLength(50);
    expect(sanitized).toMatchObject({
      nested: { keep: 'ok' },
    });
    expect(JSON.stringify(sanitized)).not.toContain('data:image');
  });

  it('handles malformed storage safely by clearing it', async () => {
    await AsyncStorage.setItem(offlineHealthCacheStorageKey('profile', 'user-1'), '{not-json');

    await expect(readOfflineHealthCache('profile', 'user-1')).resolves.toMatchObject({
      status: 'malformed',
      data: null,
      storageCleared: true,
    });
    await expect(AsyncStorage.getItem(offlineHealthCacheStorageKey('profile', 'user-1'))).resolves.toBeNull();
  });
});
