import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PENDING_SYNC_SCHEMA_VERSION,
  PENDING_SYNC_STORAGE_KEY,
  PENDING_SYNC_TTL_MS,
  appendPendingSyncItem,
  createPendingSyncItem,
  loadPendingSyncItems,
  removePendingSyncItem,
  sanitizePendingSyncPayload,
  savePendingSyncItems,
} from './pendingSyncStorage';

describe('pendingSyncStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('wraps pending payloads with TTL metadata and strips token-like fields', async () => {
    const now = 1_000;

    await appendPendingSyncItem('tracking', {
      _endpoint: '/track/water',
      amount: 16,
      access_token: 'secret-access-token',
      headers: { Authorization: 'Bearer secret' },
      nested: {
        refreshToken: 'secret-refresh-token',
        kept: true,
      },
    }, now);

    const raw = await AsyncStorage.getItem(PENDING_SYNC_STORAGE_KEY);
    const envelope = JSON.parse(raw ?? '{}');

    expect(envelope).toMatchObject({
      schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
      kind: 'pending_sync_queue',
      createdAt: now,
      updatedAt: now,
      ttlMs: PENDING_SYNC_TTL_MS,
    });
    expect(envelope.items).toHaveLength(1);
    expect(envelope.items[0]).toMatchObject({
      type: 'tracking',
      payloadKind: 'tracking',
      createdAt: now,
      expiresAt: now + PENDING_SYNC_TTL_MS,
    });
    expect(JSON.stringify(envelope)).not.toContain('secret-access-token');
    expect(JSON.stringify(envelope)).not.toContain('secret-refresh-token');
    expect(JSON.stringify(envelope)).not.toContain('Bearer secret');
    expect(envelope.items[0].data).toEqual({
      _endpoint: '/track/water',
      amount: 16,
      nested: { kept: true },
    });
  });

  it('reads valid pending payloads in queue order', async () => {
    const first = createPendingSyncItem('tracking', { item: 1 }, 1_000, 'first');
    const second = createPendingSyncItem('tracking', { item: 2 }, 2_000, 'second');

    await savePendingSyncItems([first, second], 2_000);

    const result = await loadPendingSyncItems(3_000);

    expect(result.items.map((item) => item.id)).toEqual(['first', 'second']);
    expect(result.expiredCount).toBe(0);
    expect(result.malformedCount).toBe(0);
    expect(result.fromLegacy).toBe(false);
  });

  it('drops expired pending payloads on read', async () => {
    const item = createPendingSyncItem('tracking', { stale: true }, 1_000, 'expired');
    await savePendingSyncItems([item], 1_000);

    const result = await loadPendingSyncItems(1_000 + PENDING_SYNC_TTL_MS);

    expect(result.items).toEqual([]);
    expect(result.expiredCount).toBe(1);
    expect(await AsyncStorage.getItem(PENDING_SYNC_STORAGE_KEY)).toBeNull();
  });

  it('handles legacy array format and rewrites to the TTL envelope', async () => {
    await AsyncStorage.setItem(PENDING_SYNC_STORAGE_KEY, JSON.stringify([
      {
        id: 'legacy-1',
        type: 'tracking',
        data: { _endpoint: '/track/mood', mood: 'ok' },
        timestamp: 1_000,
        attempts: 1,
      },
    ]));

    const result = await loadPendingSyncItems(2_000);
    const raw = await AsyncStorage.getItem(PENDING_SYNC_STORAGE_KEY);
    const rewritten = JSON.parse(raw ?? '{}');

    expect(result.fromLegacy).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'legacy-1',
      schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
      createdAt: 1_000,
      expiresAt: 1_000 + PENDING_SYNC_TTL_MS,
    });
    expect(rewritten.kind).toBe('pending_sync_queue');
  });

  it('handles malformed storage safely by clearing the queue', async () => {
    await AsyncStorage.setItem(PENDING_SYNC_STORAGE_KEY, '{not-json');

    const result = await loadPendingSyncItems(2_000);

    expect(result.items).toEqual([]);
    expect(result.malformedCount).toBe(1);
    expect(result.storageCleared).toBe(true);
    expect(await AsyncStorage.getItem(PENDING_SYNC_STORAGE_KEY)).toBeNull();
  });

  it('removes synced payloads without reordering remaining items', async () => {
    const first = createPendingSyncItem('tracking', { item: 1 }, 1_000, 'first');
    const second = createPendingSyncItem('tracking', { item: 2 }, 2_000, 'second');
    const third = createPendingSyncItem('tracking', { item: 3 }, 3_000, 'third');
    await savePendingSyncItems([first, second, third], 3_000);

    await removePendingSyncItem('second', 4_000);
    const result = await loadPendingSyncItems(4_000);

    expect(result.items.map((item) => item.id)).toEqual(['first', 'third']);
  });

  it('sanitizes nested token-like fields without logging or throwing', () => {
    expect(sanitizePendingSyncPayload({
      value: 1,
      token: 'secret-token',
      nested: [{ Authorization: 'Bearer secret' }, { keep: 'yes' }],
    })).toEqual({
      value: 1,
      nested: [{}, { keep: 'yes' }],
    });
  });
});
