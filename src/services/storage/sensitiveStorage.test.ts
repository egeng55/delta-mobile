import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  getSensitiveItem,
  getSensitiveItemWithLegacyFallback,
  getSensitiveJson,
  setSensitiveItem,
  setSensitiveJson,
} from './sensitiveStorage';

type SecureStoreMock = typeof SecureStore & {
  __clearStore: () => void;
  setItemAsync: jest.Mock;
};

const secureStore = SecureStore as SecureStoreMock;

describe('sensitiveStorage', () => {
  beforeEach(async () => {
    secureStore.__clearStore();
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('stores and reads small sensitive string values with SecureStore', async () => {
    await setSensitiveItem('delta_sensitive_test', 'stored-value');

    await expect(getSensitiveItem('delta_sensitive_test')).resolves.toBe('stored-value');
  });

  it('stores and reads small sensitive JSON values with SecureStore', async () => {
    await setSensitiveJson('delta_sensitive_json', { enabled: true, count: 2 });

    await expect(getSensitiveJson<{ enabled: boolean; count: number }>('delta_sensitive_json')).resolves.toEqual({
      enabled: true,
      count: 2,
    });
  });

  it('migrates a legacy AsyncStorage value after a verified SecureStore write', async () => {
    await AsyncStorage.setItem('legacy-key', 'legacy-value');

    await expect(getSensitiveItemWithLegacyFallback('secure-key', 'legacy-key')).resolves.toBe('legacy-value');
    await expect(getSensitiveItem('secure-key')).resolves.toBe('legacy-value');
    await expect(AsyncStorage.getItem('legacy-key')).resolves.toBeNull();
  });

  it('keeps the legacy AsyncStorage value if SecureStore migration fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await AsyncStorage.setItem('legacy-key', 'legacy-value');
    secureStore.setItemAsync.mockRejectedValueOnce(new Error('secure write failed'));

    await expect(getSensitiveItemWithLegacyFallback('secure-key', 'legacy-key')).resolves.toBe('legacy-value');
    await expect(getSensitiveItem('secure-key')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('legacy-key')).resolves.toBe('legacy-value');

    warnSpy.mockRestore();
  });
});
