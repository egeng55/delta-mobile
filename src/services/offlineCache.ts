/**
 * Offline Cache Service - Handles data caching for offline support.
 *
 * Features:
 * - Cache API responses in AsyncStorage
 * - Detect network connectivity
 * - Serve cached data when offline
 * - Preserve pending work until safe, idempotent replay is supported
 * - Cache expiration management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase } from './supabase';
import {
  appendPendingSyncItem,
  loadPendingSyncItems,
  removePendingSyncItem,
  type PendingSyncItem,
} from './storage/pendingSyncStorage';
import {
  OFFLINE_HEALTH_CACHE_PREFIX,
  clearOfflineHealthCache,
  readOfflineHealthCache,
  saveOfflineHealthCache,
} from './storage/offlineHealthCacheStorage';

const CACHE_PREFIX = OFFLINE_HEALTH_CACHE_PREFIX;

// Default cache duration: 24 hours.
const DEFAULT_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// Cache durations for different data types (in milliseconds). The storage
// helper caps high-risk resources to these values and adds schema metadata.
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

export type { PendingSyncItem };

let isOnline = true;
let connectionListeners: Array<(isOnline: boolean) => void> = [];

/**
 * Initialize network monitoring.
 */
export function initNetworkMonitoring(): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    isOnline = state.isConnected === true && state.isInternetReachable !== false;

    // Notify listeners
    connectionListeners.forEach(listener => listener(isOnline));

    // Connectivity alone cannot authorize a mutation. Legacy tracking APIs do
    // not provide an idempotency receipt, so automatic replay stays disabled.
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
 * Cache data.
 */
export async function cacheData<T>(
  resource: string,
  data: T,
  userId?: string,
  customDuration?: number
): Promise<void> {
  try {
    const duration = customDuration ?? CACHE_DURATIONS[resource] ?? DEFAULT_CACHE_DURATION_MS;
    await saveOfflineHealthCache(resource, data, userId, duration);
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
    const cached = await readOfflineHealthCache<T>(resource, userId);
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
    await clearOfflineHealthCache(resource, userId);
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
  const owner = await pendingOwner();
  if (!owner) throw new Error('Sign in before saving pending work');
  if (data && typeof data === 'object' && 'user_id' in data && data.user_id !== owner) throw new Error('Pending work belongs to another account');
  await appendPendingSyncItem(type, data, Date.now(), owner);
}

async function pendingOwner(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  return error ? null : data.session?.user?.id ?? null;
}

export const pendingSyncPolicy = Object.freeze({ automaticReplay: false, reason: 'server_idempotency_required' });

/**
 * Get pending sync items.
 */
export async function getPendingSync(): Promise<PendingSyncItem[]> {
  try {
    const owner = await pendingOwner();
    if (!owner) return [];
    const result = await loadPendingSyncItems();
    return result.items.filter(item => item.ownerUserId === owner);
  } catch {
    return [];
  }
}

/**
 * Remove item from pending sync.
 */
export async function removeFromPendingSync(id: string): Promise<void> {
  try {
    if (!(await getPendingSync()).some(item => item.id === id)) throw new Error('Pending item unavailable');
    await removePendingSyncItem(id);
  } catch {
    // Silent fail
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
