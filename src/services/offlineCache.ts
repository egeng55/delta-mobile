/**
 * Offline Cache Service - Handles data caching for offline support.
 *
 * Features:
 * - Cache API responses in AsyncStorage
 * - Detect network connectivity
 * - Serve cached data when offline
 * - Auto-sync when back online
 * - Cache expiration management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

const CACHE_PREFIX = 'delta_cache_';
const CACHE_EXPIRY_PREFIX = 'delta_cache_expiry_';
const PENDING_SYNC_KEY = 'delta_pending_sync';

// Default cache duration: 24 hours
const DEFAULT_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// Cache durations for different data types (in milliseconds)
const CACHE_DURATIONS: Record<string, number> = {
  insights: 30 * 60 * 1000, // 30 minutes
  workout: 60 * 60 * 1000, // 1 hour
  calendar: 24 * 60 * 60 * 1000, // 24 hours
  derivatives: 60 * 60 * 1000, // 1 hour
  profile: 24 * 60 * 60 * 1000, // 24 hours
  menstrual: 24 * 60 * 60 * 1000, // 24 hours
};

export interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface PendingSyncItem {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
  attempts: number;
}

let isOnline = true;
let connectionListeners: Array<(isOnline: boolean) => void> = [];

/**
 * Initialize network monitoring.
 */
export function initNetworkMonitoring(): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const wasOnline = isOnline;
    isOnline = state.isConnected === true && state.isInternetReachable !== false;

    // Notify listeners
    connectionListeners.forEach(listener => listener(isOnline));

    // If we just came back online, try to sync pending data
    if (isOnline && !wasOnline) {
      syncPendingData();
    }
  });

  return unsubscribe;
}

/**
 * Check if currently online.
 */
export function checkIsOnline(): boolean {
  return isOnline;
}

/**
 * Add a connection state listener.
 */
export function addConnectionListener(listener: (isOnline: boolean) => void): () => void {
  connectionListeners.push(listener);
  return () => {
    connectionListeners = connectionListeners.filter(l => l !== listener);
  };
}

/**
 * Get cache key for a resource.
 */
function getCacheKey(resource: string, userId?: string): string {
  return userId ? `${CACHE_PREFIX}${resource}_${userId}` : `${CACHE_PREFIX}${resource}`;
}

/**
 * Cache data.
 */
export async function cacheData<T>(
  resource: string,
  data: T,
  userId?: string,
  customDuration?: number
): Promise<void> {
  try {
    const key = getCacheKey(resource, userId);
    const duration = customDuration ?? CACHE_DURATIONS[resource] ?? DEFAULT_CACHE_DURATION_MS;
    const now = Date.now();

    const cachedData: CachedData<T> = {
      data,
      timestamp: now,
      expiresAt: now + duration,
    };

    await AsyncStorage.setItem(key, JSON.stringify(cachedData));
  } catch (error) {
    console.error('Error caching data:', error);
  }
}

/**
 * Get cached data if valid.
 */
export async function getCachedData<T>(
  resource: string,
  userId?: string
): Promise<T | null> {
  try {
    const key = getCacheKey(resource, userId);
    const stored = await AsyncStorage.getItem(key);

    if (stored === null) {
      return null;
    }

    const cached: CachedData<T> = JSON.parse(stored);

    // Check if cache is still valid
    if (Date.now() > cached.expiresAt) {
      // Cache expired, remove it
      await AsyncStorage.removeItem(key);
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
}

/**
 * Clear cached data for a resource.
 */
export async function clearCache(resource: string, userId?: string): Promise<void> {
  try {
    const key = getCacheKey(resource, userId);
    await AsyncStorage.removeItem(key);
  } catch {
    // Silent fail
  }
}

/**
 * Clear all cached data.
 */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch {
    // Silent fail
  }
}

/**
 * Add data to pending sync queue.
 */
export async function addToPendingSync(
  type: string,
  data: unknown
): Promise<void> {
  try {
    const pending = await getPendingSync();
    const item: PendingSyncItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      attempts: 0,
    };
    pending.push(item);
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
  } catch {
    // Silent fail
  }
}

/**
 * Get pending sync items.
 */
export async function getPendingSync(): Promise<PendingSyncItem[]> {
  try {
    const stored = await AsyncStorage.getItem(PENDING_SYNC_KEY);
    return stored !== null ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Remove item from pending sync.
 */
export async function removeFromPendingSync(id: string): Promise<void> {
  try {
    const pending = await getPendingSync();
    const filtered = pending.filter(item => item.id !== id);
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(filtered));
  } catch {
    // Silent fail
  }
}

/**
 * Sync pending data when back online.
 * This is a placeholder - actual sync logic depends on API structure.
 */
async function syncPendingData(): Promise<void> {
  const pending = await getPendingSync();

  for (const item of pending) {
    try {
      // Increment attempt count
      item.attempts += 1;

      // Skip items that have failed too many times
      if (item.attempts > 3) {
        await removeFromPendingSync(item.id);
        continue;
      }

      // Here you would implement the actual sync logic based on item.type
      // For example:
      // if (item.type === 'chat_message') {
      //   await chatApi.sendMessage(item.data.userId, item.data.message);
      // }

      // For now, just mark as synced
      await removeFromPendingSync(item.id);
    } catch {
      // Update the pending item with new attempt count
      const all = await getPendingSync();
      const updated = all.map(p => p.id === item.id ? { ...p, attempts: item.attempts } : p);
      await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(updated));
    }
  }
}

/**
 * Fetch data with cache fallback.
 * Tries to fetch fresh data, falls back to cache if offline or on error.
 */
export async function fetchWithCache<T>(
  resource: string,
  fetchFn: () => Promise<T>,
  userId?: string,
  options?: {
    forceRefresh?: boolean;
    cacheOnly?: boolean;
  }
): Promise<{ data: T; fromCache: boolean } | null> {
  const { forceRefresh = false, cacheOnly = false } = options ?? {};

  // If cache only, just return cached data
  if (cacheOnly) {
    const cached = await getCachedData<T>(resource, userId);
    return cached !== null ? { data: cached, fromCache: true } : null;
  }

  // Try to get cached data first
  const cached = await getCachedData<T>(resource, userId);

  // If offline, return cached data
  if (!isOnline) {
    return cached !== null ? { data: cached, fromCache: true } : null;
  }

  // If we have valid cache and don't need to force refresh, return cached
  if (cached !== null && !forceRefresh) {
    // Return cache immediately, but refresh in background
    fetchFn()
      .then(data => cacheData(resource, data, userId))
      .catch(() => { /* Silent fail for background refresh */ });

    return { data: cached, fromCache: true };
  }

  // Try to fetch fresh data
  try {
    const data = await fetchFn();
    await cacheData(resource, data, userId);
    return { data, fromCache: false };
  } catch {
    // Fallback to cache on error
    return cached !== null ? { data: cached, fromCache: true } : null;
  }
}

/**
 * Get cache statistics.
 */
export async function getCacheStats(): Promise<{
  itemCount: number;
  pendingSyncCount: number;
  totalSizeEstimate: number;
}> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    const pending = await getPendingSync();

    // Estimate total size (rough approximation)
    let totalSize = 0;
    for (const key of cacheKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value !== null) {
        totalSize += value.length * 2; // UTF-16 encoding
      }
    }

    return {
      itemCount: cacheKeys.length,
      pendingSyncCount: pending.length,
      totalSizeEstimate: totalSize,
    };
  } catch {
    return { itemCount: 0, pendingSyncCount: 0, totalSizeEstimate: 0 };
  }
}
