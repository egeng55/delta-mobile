import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export function createSensitiveKey(...parts: string[]): string {
  return ['delta_sensitive', ...parts]
    .join('_')
    .replace(/[^A-Za-z0-9._-]/g, '_');
}

export async function getSensitiveItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    console.warn('[SensitiveStorage] Secure read failed');
    return null;
  }
}

export async function setSensitiveItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
  const verified = await SecureStore.getItemAsync(key);
  if (verified !== value) {
    throw new Error('Sensitive storage verification failed');
  }
}

export async function deleteSensitiveItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

export async function setSensitiveItemReplacingLegacy(
  key: string,
  value: string,
  legacyAsyncStorageKey: string
): Promise<void> {
  await setSensitiveItem(key, value);
  try {
    await AsyncStorage.removeItem(legacyAsyncStorageKey);
  } catch {
    console.warn('[SensitiveStorage] Legacy cleanup failed after secure write');
  }
}

export async function deleteSensitiveItemAndLegacy(
  key: string,
  legacyAsyncStorageKey: string
): Promise<void> {
  await SecureStore.deleteItemAsync(key);
  try {
    await AsyncStorage.removeItem(legacyAsyncStorageKey);
  } catch {
    console.warn('[SensitiveStorage] Legacy cleanup failed after secure delete');
  }
}

export async function getSensitiveJson<T>(key: string): Promise<T | null> {
  const value = await getSensitiveItem(key);
  if (value === null) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    console.warn('[SensitiveStorage] Secure JSON parse failed');
    return null;
  }
}

export async function setSensitiveJson<T>(key: string, value: T): Promise<void> {
  await setSensitiveItem(key, JSON.stringify(value));
}

export async function setSensitiveJsonReplacingLegacy<T>(
  key: string,
  value: T,
  legacyAsyncStorageKey: string
): Promise<void> {
  await setSensitiveItemReplacingLegacy(key, JSON.stringify(value), legacyAsyncStorageKey);
}

export async function getSensitiveItemWithLegacyFallback(
  key: string,
  legacyAsyncStorageKey: string
): Promise<string | null> {
  const secureValue = await getSensitiveItem(key);
  if (secureValue !== null) return secureValue;

  let legacyValue: string | null = null;
  try {
    legacyValue = await AsyncStorage.getItem(legacyAsyncStorageKey);
  } catch {
    return null;
  }

  if (legacyValue === null) return null;

  try {
    await setSensitiveItem(key, legacyValue);
    await AsyncStorage.removeItem(legacyAsyncStorageKey);
  } catch {
    console.warn('[SensitiveStorage] Legacy migration failed; keeping legacy value');
  }

  return legacyValue;
}

export async function getSensitiveJsonWithLegacyFallback<T>(
  key: string,
  legacyAsyncStorageKey: string
): Promise<T | null> {
  const value = await getSensitiveItemWithLegacyFallback(key, legacyAsyncStorageKey);
  if (value === null) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    console.warn('[SensitiveStorage] Legacy JSON parse failed');
    return null;
  }
}
