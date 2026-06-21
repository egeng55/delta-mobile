import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addToPendingSync,
  getPendingSync,
  removeFromPendingSync,
} from './offlineCache';
import {
  PENDING_SYNC_STORAGE_KEY,
  PENDING_SYNC_TTL_MS,
} from './storage/pendingSyncStorage';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

describe('offlineCache pending sync storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
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
